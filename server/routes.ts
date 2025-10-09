import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateWorkoutProgram, suggestExerciseSwap, generateProgressionRecommendation } from "./ai-service";
import { generateComprehensiveExerciseLibrary, generateMasterExerciseDatabase, generateExercisesForEquipment } from "./ai-exercise-generator";
import { insertFitnessAssessmentSchema, overrideFitnessAssessmentSchema, insertWorkoutSessionSchema, patchWorkoutSessionSchema, insertWorkoutSetSchema, type FitnessAssessment, type ProgramWorkout, type Exercise } from "@shared/schema";
import { determineIntensityFromProgramType, calculateCaloriesBurned, poundsToKg } from "./calorie-calculator";
import { z } from "zod";
import { calculateAge } from "@shared/utils";

// Guard against duplicate route registration (e.g., from HMR)
let routesRegistered = false;

// Helper function to generate workout schedule for entire program duration
async function generateWorkoutSchedule(programId: string, userId: string, programWorkouts: ProgramWorkout[], durationWeeks: number) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Create a map of dayOfWeek to programWorkout for quick lookup
    const workoutsByDay = new Map<number, ProgramWorkout>();
    programWorkouts.forEach(pw => {
      workoutsByDay.set(pw.dayOfWeek, pw);
    });
    
    // Generate sessions starting from TODAY for the entire duration
    const sessions = [];
    const totalDays = durationWeeks * 7;
    
    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      const scheduledDate = new Date(today);
      scheduledDate.setDate(today.getDate() + dayOffset);
      
      // Get calendar day-of-week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const calendarDay = scheduledDate.getDay();
      
      // Convert to our schema format: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
      const schemaDayOfWeek = calendarDay === 0 ? 7 : calendarDay;
      
      // Find the programWorkout for this day
      const programWorkout = workoutsByDay.get(schemaDayOfWeek);
      
      if (programWorkout) {
        sessions.push({
          userId,
          programWorkoutId: programWorkout.id,
          workoutName: programWorkout.workoutName,
          scheduledDate,
          sessionDayOfWeek: schemaDayOfWeek,
          sessionType: (programWorkout.workoutType ? 'workout' : 'rest') as 'workout' | 'rest',
          workoutType: programWorkout.workoutType as 'strength' | 'cardio' | 'hiit' | 'mobility' | undefined,
          completed: 0,
          status: "scheduled" as const,
        });
      }
    }
    
    console.log(`Creating ${sessions.length} workout sessions for program ${programId}`);
    
    // Create all sessions in database
    for (const session of sessions) {
      await storage.createWorkoutSession(session);
    }
    
    console.log(`Successfully created ${sessions.length} workout sessions`);
    return sessions.length;
  } catch (error) {
    console.error("Error in generateWorkoutSchedule:", error);
    throw error;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Guard against duplicate route registration
  if (routesRegistered) {
    console.log("[ROUTES] Routes already registered, skipping duplicate registration");
    return createServer(app);
  }
  console.log("[ROUTES] Registering routes for the first time");
  
  // Setup Replit Auth
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user metrics (height and weight)
  app.patch('/api/auth/user/metrics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { height, weight } = req.body;

      if (!height && !weight) {
        return res.status(400).json({ error: "At least one metric (height or weight) is required" });
      }

      const updateData: any = {};
      if (height !== undefined) updateData.height = height;
      if (weight !== undefined) updateData.weight = weight;

      // Recalculate BMR if weight and height are being updated
      const user = await storage.getUser(userId);
      if (user && user.dateOfBirth && (updateData.height || updateData.weight)) {
        const h = updateData.height || user.height;
        const w = updateData.weight || user.weight;
        
        if (h && w && user.dateOfBirth) {
          const age = Math.floor((new Date().getTime() - new Date(user.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          const bmr = Math.round(10 * w + 6.25 * h - 5 * age + 5);
          updateData.bmr = bmr;
        }
      }

      await storage.updateUser(userId, updateData);
      const updatedUser = await storage.getUser(userId);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user metrics:", error);
      res.status(500).json({ message: "Failed to update metrics" });
    }
  });

  // Complete onboarding after OIDC login - saves assessment and program data
  app.post("/api/auth/complete-onboarding", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { fitnessTest, weightsTest, experienceLevel, generatedProgram, ...profileData } = req.body;
      
      // Check if user already has existing programs or assessments
      const existingPrograms = await storage.getUserPrograms(userId);
      const existingAssessments = await storage.getUserFitnessAssessments(userId);
      const hasActiveProgram = existingPrograms.some(p => p.isActive === 1);
      
      // If user has existing data, warn them before overwriting
      if (hasActiveProgram || existingAssessments.length > 0) {
        return res.status(200).json({ 
          existingData: true,
          hasPrograms: hasActiveProgram,
          hasAssessments: existingAssessments.length > 0
        });
      }
      
      // Update user profile with onboarding data
      if (Object.keys(profileData).length > 0) {
        await storage.updateUser(userId, profileData);
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(500).json({ error: "Failed to retrieve user after profile update" });
      }
      
      // Save fitness assessment if provided (best effort - don't fail if this errors)
      let savedAssessmentId: string | undefined;
      if (fitnessTest || weightsTest) {
        try {
          const assessmentData = {
            userId,
            experienceLevel: experienceLevel || profileData.fitnessLevel,
            ...fitnessTest,
            ...weightsTest,
          };
          const savedAssessment = await storage.createFitnessAssessment(assessmentData);
          savedAssessmentId = savedAssessment.id;
        } catch (assessmentError) {
          console.error("Failed to save fitness assessment during onboarding:", assessmentError);
          // Continue without assessment - program can still be created
        }
      }
      
      // Check if master exercise database has been populated
      const availableExercises = await storage.getAllExercises();
      if (availableExercises.length === 0) {
        console.error("Master exercise database is empty. Admin must populate via /api/admin/populate-master-exercises");
        return res.status(500).json({ 
          error: "Exercise database not initialized. Please contact support." 
        });
      }
      
      // Require pre-generated workout program
      if (!generatedProgram) {
        console.log("No pre-generated program provided in signup request");
        return res.status(400).json({ 
          error: "No workout program provided. Please generate a program before signing up." 
        });
      }
      
      // Save the pre-generated workout program - this MUST succeed
      console.log("Saving pre-generated program provided in onboarding request");
      const programData = generatedProgram;

      // Archive any existing active programs (fetch again in case they were just created)
      const programsToArchive = await storage.getUserPrograms(userId);
      for (const oldProgram of programsToArchive) {
        if (oldProgram.isActive === 1) {
          await storage.deleteIncompleteProgramSessions(oldProgram.id);
          await storage.updateWorkoutProgram(oldProgram.id, { 
            isActive: 0,
            archivedDate: new Date(),
            archivedReason: "replaced"
          });
        }
      }

      // Create the workout program
      const program = await storage.createWorkoutProgram({
        userId,
        fitnessAssessmentId: savedAssessmentId, // Will be undefined if assessment save failed
        programType: programData.programType,
        weeklyStructure: programData.weeklyStructure,
        durationWeeks: programData.durationWeeks,
        intensityLevel: determineIntensityFromProgramType(programData.programType),
        isActive: 1,
      });

      const scheduledDays = new Set<number>();
      const createdProgramWorkouts: ProgramWorkout[] = [];
      
      // Create all workout days
      for (const workout of programData.workouts) {
        scheduledDays.add(workout.dayOfWeek);
        
        const programWorkout = await storage.createProgramWorkout({
          programId: program.id,
          dayOfWeek: workout.dayOfWeek,
          workoutName: workout.workoutName,
          movementFocus: workout.movementFocus,
          workoutType: workout.workoutType,
        });
        createdProgramWorkouts.push(programWorkout);

        // Create exercises for this workout
        for (let i = 0; i < workout.exercises.length; i++) {
          const exercise = workout.exercises[i];
          const matchingExercise = availableExercises.find(
            ex => ex.name.toLowerCase() === exercise.exerciseName.toLowerCase()
          );

          if (matchingExercise) {
            await storage.createProgramExercise({
              workoutId: programWorkout.id,
              exerciseId: matchingExercise.id,
              equipment: exercise.equipment || null,
              orderIndex: i,
              sets: exercise.sets,
              repsMin: exercise.repsMin,
              repsMax: exercise.repsMax,
              recommendedWeight: exercise.recommendedWeight,
              restSeconds: exercise.restSeconds,
              notes: exercise.notes,
              supersetGroup: exercise.supersetGroup || null,
              supersetOrder: exercise.supersetOrder || null,
            });
          } else {
            console.warn(`Exercise not found in database: ${exercise.exerciseName}`);
          }
        }
      }
      
      // Create rest days for any days not scheduled
      for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
        if (!scheduledDays.has(dayOfWeek)) {
          const restDay = await storage.createProgramWorkout({
            programId: program.id,
            dayOfWeek,
            workoutName: "Rest Day",
            movementFocus: [],
            workoutType: null,
          });
          createdProgramWorkouts.push(restDay);
        }
      }
      
      // Generate workout schedule for entire program duration
      await generateWorkoutSchedule(program.id, userId, createdProgramWorkouts, programData.durationWeeks);
      
      console.log(`Successfully created program ${program.id} with ${createdProgramWorkouts.length} workouts for user ${userId}`);
      
      res.json(user);
    } catch (error) {
      console.error("Onboarding completion error:", error);
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  });

  // Force complete onboarding - bypasses existing data check (user confirmed replacement)
  app.post("/api/auth/complete-onboarding-force", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { fitnessTest, weightsTest, experienceLevel, generatedProgram, ...profileData } = req.body;
      
      // Update user profile with onboarding data
      if (Object.keys(profileData).length > 0) {
        await storage.updateUser(userId, profileData);
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(500).json({ error: "Failed to retrieve user after profile update" });
      }
      
      // Save fitness assessment if provided (best effort - don't fail if this errors)
      let savedAssessmentId: string | undefined;
      if (fitnessTest || weightsTest) {
        try {
          const assessmentData = {
            userId,
            experienceLevel: experienceLevel || profileData.fitnessLevel,
            ...fitnessTest,
            ...weightsTest,
          };
          const savedAssessment = await storage.createFitnessAssessment(assessmentData);
          savedAssessmentId = savedAssessment.id;
        } catch (assessmentError) {
          console.error("Failed to save fitness assessment during onboarding:", assessmentError);
          // Continue without assessment - program can still be created
        }
      }
      
      // Check if master exercise database has been populated
      const availableExercises = await storage.getAllExercises();
      if (availableExercises.length === 0) {
        console.error("Master exercise database is empty. Admin must populate via /api/admin/populate-master-exercises");
        return res.status(500).json({ 
          error: "Exercise database not initialized. Please contact support." 
        });
      }
      
      // Require pre-generated workout program
      if (!generatedProgram) {
        console.log("No pre-generated program provided in signup request");
        return res.status(400).json({ 
          error: "No workout program provided. Please generate a program before signing up." 
        });
      }
      
      // Save the pre-generated workout program - this MUST succeed
      console.log("Saving pre-generated program provided in onboarding request (force mode)");
      const programData = generatedProgram;

      // Archive any existing active programs
      const programsToArchive = await storage.getUserPrograms(userId);
      for (const oldProgram of programsToArchive) {
        if (oldProgram.isActive === 1) {
          await storage.deleteIncompleteProgramSessions(oldProgram.id);
          await storage.updateWorkoutProgram(oldProgram.id, { 
            isActive: 0,
            archivedDate: new Date(),
            archivedReason: "replaced"
          });
        }
      }

      // Create the workout program
      const program = await storage.createWorkoutProgram({
        userId,
        fitnessAssessmentId: savedAssessmentId,
        programType: programData.programType,
        weeklyStructure: programData.weeklyStructure,
        durationWeeks: programData.durationWeeks,
        intensityLevel: determineIntensityFromProgramType(programData.programType),
        isActive: 1,
      });

      const scheduledDays = new Set<number>();
      const createdProgramWorkouts: ProgramWorkout[] = [];
      
      // Create all workout days
      for (const workout of programData.workouts) {
        scheduledDays.add(workout.dayOfWeek);
        
        const programWorkout = await storage.createProgramWorkout({
          programId: program.id,
          dayOfWeek: workout.dayOfWeek,
          workoutName: workout.workoutName,
          movementFocus: workout.movementFocus,
          workoutType: workout.workoutType,
        });
        createdProgramWorkouts.push(programWorkout);

        // Create exercises for this workout
        for (let i = 0; i < workout.exercises.length; i++) {
          const exercise = workout.exercises[i];
          const matchingExercise = availableExercises.find(
            ex => ex.name.toLowerCase() === exercise.exerciseName.toLowerCase()
          );

          if (matchingExercise) {
            await storage.createProgramExercise({
              workoutId: programWorkout.id,
              exerciseId: matchingExercise.id,
              equipment: exercise.equipment || null,
              orderIndex: i,
              sets: exercise.sets,
              repsMin: exercise.repsMin,
              repsMax: exercise.repsMax,
              recommendedWeight: exercise.recommendedWeight,
              restSeconds: exercise.restSeconds,
              notes: exercise.notes,
              supersetGroup: exercise.supersetGroup || null,
              supersetOrder: exercise.supersetOrder || null,
            });
          } else {
            console.warn(`Exercise not found in database: ${exercise.exerciseName}`);
          }
        }
      }
      
      // Create rest days for any days not scheduled
      for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
        if (!scheduledDays.has(dayOfWeek)) {
          const restDay = await storage.createProgramWorkout({
            programId: program.id,
            dayOfWeek,
            workoutName: "Rest Day",
            movementFocus: [],
            workoutType: null,
          });
          createdProgramWorkouts.push(restDay);
        }
      }
      
      // Generate workout schedule for entire program duration
      await generateWorkoutSchedule(program.id, userId, createdProgramWorkouts, programData.durationWeeks);
      
      console.log(`Successfully created program ${program.id} with ${createdProgramWorkouts.length} workouts for user ${userId} (force mode)`);
      
      res.json(user);
    } catch (error) {
      console.error("Onboarding completion error (force mode):", error);
      res.status(500).json({ error: "Failed to complete onboarding" });
    }
  });

  app.put("/api/user/profile", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const updates = req.body;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (updates.age !== undefined && (updates.age < 18 || updates.age > 100)) {
        return res.status(400).json({ error: "Age must be between 18 and 100" });
      }
      
      delete updates.bmr;
      delete updates.targetCalories;
      
      const hasPhysicalStatChange = updates.height !== undefined || updates.weight !== undefined || updates.age !== undefined;
      const hasGoalChange = updates.nutritionGoal !== undefined;
      
      if (hasPhysicalStatChange || hasGoalChange) {
        const finalHeight = updates.height !== undefined ? updates.height : user.height;
        const finalWeight = updates.weight !== undefined ? updates.weight : user.weight;
        const finalAge = updates.age !== undefined ? updates.age : (user.dateOfBirth ? calculateAge(user.dateOfBirth) : null);
        const finalGoal = updates.nutritionGoal !== undefined ? updates.nutritionGoal : user.nutritionGoal;
        
        if (finalHeight && finalWeight && finalAge) {
          const bmr = Math.round(10 * finalWeight + 6.25 * finalHeight - 5 * finalAge + 5);
          const targetCalories = finalGoal === "gain" ? bmr + 500 
                               : finalGoal === "lose" ? bmr - 500 
                               : bmr;
          
          updates.bmr = bmr;
          updates.targetCalories = targetCalories;
        }
      }
      
      const updatedUser = await storage.updateUser(userId, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.put("/api/user/unit-preference", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { unitPreference } = req.body;
      
      if (!unitPreference || !['imperial', 'metric'].includes(unitPreference)) {
        return res.status(400).json({ error: "Invalid unit preference. Must be 'imperial' or 'metric'" });
      }

      const updatedUser = await storage.updateUser(userId, {
        unitPreference
      });
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Update unit preference error:", error);
      res.status(500).json({ error: "Failed to update unit preference" });
    }
  });


  // Fitness Assessment routes
  app.post("/api/fitness-assessments", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      console.log("Fitness assessment request. UserID:", userId);

      const validatedData = insertFitnessAssessmentSchema.parse({
        ...req.body,
        userId,
      });

      const assessment = await storage.createFitnessAssessment(validatedData);
      res.json(assessment);
    } catch (error) {
      console.error("Create assessment error:", error);
      res.status(500).json({ error: "Failed to create fitness assessment" });
    }
  });

  app.get("/api/fitness-assessments", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const assessments = await storage.getUserFitnessAssessments(userId);
      res.json(assessments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assessments" });
    }
  });

  app.get("/api/fitness-assessments/latest", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const assessment = await storage.getLatestFitnessAssessment(userId);
      res.json(assessment || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch latest assessment" });
    }
  });

  app.patch("/api/fitness-assessments/:id/override", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const assessment = await storage.getFitnessAssessmentById(id);
      if (!assessment || assessment.userId !== userId) {
        return res.status(404).json({ error: "Assessment not found" });
      }

      const validatedData = overrideFitnessAssessmentSchema.parse(req.body);
      const updated = await storage.updateFitnessAssessmentOverride(id, validatedData);
      res.json(updated);
    } catch (error) {
      console.error("Update assessment override error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid override data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update assessment override" });
    }
  });

  // Exercise routes
  app.post("/api/exercises/seed", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const existingExercises = await storage.getAllExercises();
      if (existingExercises.length > 0) {
        return res.json({ count: existingExercises.length, exercises: existingExercises, message: "Exercises already seeded" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let equipmentList = user.equipment || [];
      
      if (!equipmentList.includes("bodyweight")) {
        equipmentList = ["bodyweight", ...equipmentList];
      }

      if (equipmentList.length === 0 || (equipmentList.length === 1 && equipmentList[0] === "bodyweight")) {
        equipmentList = ["bodyweight"];
      }

      console.log(`Generating exercises for ${equipmentList.length} equipment types: ${equipmentList.join(", ")}`);
      const generatedExercises = await generateComprehensiveExerciseLibrary(equipmentList);
      console.log(`Generated ${generatedExercises.length} exercises`);

      const exercises = await Promise.all(
        generatedExercises.map(ex => storage.createExercise(ex))
      );
      
      res.json({ count: exercises.length, exercises });
    } catch (error) {
      console.error("Seed exercises error:", error);
      if (error instanceof Error && error.message.includes("API key")) {
        return res.status(500).json({ error: "AI API configuration error. Please check OpenAI API key." });
      }
      res.status(500).json({ error: "Failed to seed exercises. Please try again or contact support." });
    }
  });

  // Admin endpoint to populate master exercise database (ONE-TIME USE)
  app.post("/api/admin/populate-master-exercises", async (req: Request, res: Response) => {
    try {
      console.log("🔧 ADMIN: Starting master exercise database population...");
      
      const equipmentTypes = [
        "bodyweight", "dumbbells", "barbell", "kettlebell", "resistance bands",
        "cable machine", "pull-up bar", "trx", "medicine ball", "box", "jump rope", "foam roller", "yoga mat"
      ];

      // Generate ALL exercises first before touching the database
      console.log("  Generating all exercises (this may take 2-3 minutes)...");
      const allGeneratedExercises: any[] = [];
      
      for (const equipment of equipmentTypes) {
        try {
          console.log(`    Generating for ${equipment}...`);
          const exercises = await generateExercisesForEquipment(equipment);
          allGeneratedExercises.push(...exercises);
          console.log(`      ✓ ${exercises.length} exercises generated`);
          
          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`      ✗ Failed for ${equipment}:`, error);
          throw new Error(`Exercise generation failed for ${equipment}: ${error}`);
        }
      }
      
      if (allGeneratedExercises.length === 0) {
        throw new Error("No exercises were generated");
      }
      
      console.log(`\n  ✓ Generation complete: ${allGeneratedExercises.length} exercises generated`);
      console.log("  Now replacing database contents...");
      
      // Only NOW clear and replace - all generation succeeded
      const existingExercises = await storage.getAllExercises();
      console.log(`  Clearing ${existingExercises.length} existing exercises...`);
      for (const ex of existingExercises) {
        await storage.deleteExercise(ex.id);
      }
      
      // Save all new exercises
      console.log(`  Saving ${allGeneratedExercises.length} new exercises...`);
      await Promise.all(
        allGeneratedExercises.map(ex => storage.createExercise(ex))
      );
      
      console.log(`\n✅ Master database population complete: ${allGeneratedExercises.length} exercises saved`);
      
      res.json({ 
        success: true,
        count: allGeneratedExercises.length, 
        message: `Successfully populated ${allGeneratedExercises.length} exercises across all equipment types`
      });
    } catch (error) {
      console.error("❌ Master exercise population error:", error);
      if (error instanceof Error && error.message.includes("API key")) {
        return res.status(500).json({ error: "AI API configuration error. Please check OpenAI API key." });
      }
      res.status(500).json({ error: `Failed to populate master exercises: ${error}` });
    }
  });

  app.get("/api/exercises", async (req: Request, res: Response) => {
    try {
      const exercises = await storage.getAllExercises();
      res.json(exercises);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch exercises" });
    }
  });

  app.get("/api/exercises/by-equipment", async (req: Request, res: Response) => {
    try {
      const equipment = req.query.equipment as string;
      const equipmentArray = equipment ? equipment.split(",") : [];
      const exercises = await storage.getExercisesByEquipment(equipmentArray);
      res.json(exercises);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch exercises" });
    }
  });

  // Helper function to estimate recommended weight based on bodyweight test
  function estimateWeightFromBodyweightTest(
    exerciseEquipment: string[],
    movementPattern: string,
    assessment: FitnessAssessment
  ): number | undefined {
    // Only estimate for exercises that require weight
    const needsWeight = exerciseEquipment.some(eq => 
      ['dumbbells', 'barbell', 'kettlebell', 'medicine ball', 'resistance bands'].includes(eq.toLowerCase())
    );
    
    if (!needsWeight) {
      return undefined;
    }
    
    const pushups = assessment.pushups || 0;
    const pullups = assessment.pullups || 0;
    const squats = assessment.squats || 0;
    
    // Categorize by movement pattern
    const isPressing = ['push', 'press'].some(p => movementPattern.toLowerCase().includes(p));
    const isPulling = ['pull', 'row'].some(p => movementPattern.toLowerCase().includes(p));
    const isLowerBody = ['squat', 'lunge', 'hinge', 'leg'].some(p => movementPattern.toLowerCase().includes(p));
    
    // Estimate weights for dumbbells (per hand) in lbs
    if (isPressing && pushups > 0) {
      if (pushups < 15) return 17.5; // 15-20 lbs average
      if (pushups < 30) return 25;   // 20-30 lbs average
      return 35;                      // 30-40 lbs average
    }
    
    if (isPulling && pullups > 0) {
      if (pullups < 5) return 17.5;  // 15-20 lbs average
      if (pullups < 10) return 25;   // 20-30 lbs average
      return 35;                      // 30-40 lbs average
    }
    
    if (isLowerBody && squats > 0) {
      if (squats < 25) return 17.5;  // 15-20 lbs average
      if (squats < 50) return 30;    // 25-35 lbs average
      return 42.5;                    // 35-50 lbs average
    }
    
    // Default conservative estimate if we can't categorize
    return 20;
  }

  // Workout Program routes
  app.post("/api/programs/generate", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const latestAssessment = await storage.getCompleteFitnessProfile(userId);
      if (!latestAssessment) {
        return res.status(400).json({ error: "No fitness assessment found. Please complete assessment first." });
      }

      const availableExercises = await storage.getAllExercises();
      if (availableExercises.length === 0) {
        console.error("Master exercise database is empty. Admin must populate via /api/admin/populate-master-exercises");
        return res.status(500).json({ 
          error: "Exercise database not initialized. Please contact support." 
        });
      }

      console.log("Generating program with complete fitness profile:", {
        hasPushups: !!latestAssessment.pushups,
        hasPullups: !!latestAssessment.pullups,
        hasBenchPress1RM: !!latestAssessment.benchPress1rm,
        hasSquat1RM: !!latestAssessment.squat1rm,
        nutritionGoal: user.nutritionGoal,
      });

      console.log("[TEMPLATE] Starting program generation with nutrition goal:", user.nutritionGoal);
      const generatedProgram = await generateWorkoutProgram({
        user,
        latestAssessment,
        availableExercises,
      });
      console.log("[TEMPLATE] Program generation completed successfully");

      const existingPrograms = await storage.getUserPrograms(userId);
      for (const oldProgram of existingPrograms) {
        if (oldProgram.isActive === 1) {
          // Delete incomplete workout sessions from old program before archiving
          await storage.deleteIncompleteProgramSessions(oldProgram.id);
          
          await storage.updateWorkoutProgram(oldProgram.id, { 
            isActive: 0,
            archivedDate: new Date(),
            archivedReason: "replaced"
          });
        }
      }

      const program = await storage.createWorkoutProgram({
        userId,
        fitnessAssessmentId: latestAssessment.id,
        programType: generatedProgram.programType,
        weeklyStructure: generatedProgram.weeklyStructure,
        durationWeeks: generatedProgram.durationWeeks,
        intensityLevel: determineIntensityFromProgramType(generatedProgram.programType),
        isActive: 1,
      });

      const scheduledDays = new Set<number>();
      const createdProgramWorkouts: ProgramWorkout[] = [];
      
      for (const workout of generatedProgram.workouts) {
        scheduledDays.add(workout.dayOfWeek);
        
        const programWorkout = await storage.createProgramWorkout({
          programId: program.id,
          dayOfWeek: workout.dayOfWeek,
          workoutName: workout.workoutName,
          movementFocus: workout.movementFocus,
          workoutType: workout.workoutType,
        });
        createdProgramWorkouts.push(programWorkout);

        for (let i = 0; i < workout.exercises.length; i++) {
          const exercise = workout.exercises[i];
          const matchingExercise = availableExercises.find(
            ex => ex.name.toLowerCase() === exercise.exerciseName.toLowerCase()
          );

          if (matchingExercise) {
            // Use AI-provided weight, or fallback to estimation if not provided
            let recommendedWeight = exercise.recommendedWeight;
            if (!recommendedWeight && !exercise.isWarmup) {
              recommendedWeight = estimateWeightFromBodyweightTest(
                matchingExercise.equipment || [],
                matchingExercise.movementPattern,
                latestAssessment
              );
            }
            
            await storage.createProgramExercise({
              workoutId: programWorkout.id,
              exerciseId: matchingExercise.id,
              orderIndex: i,
              sets: exercise.sets,
              repsMin: exercise.repsMin,
              repsMax: exercise.repsMax,
              recommendedWeight,
              durationSeconds: exercise.durationSeconds,
              workSeconds: exercise.workSeconds,
              restSeconds: exercise.restSeconds,
              targetRPE: exercise.targetRPE,
              targetRIR: exercise.targetRIR,
              notes: exercise.notes,
              supersetGroup: exercise.supersetGroup || null,
              supersetOrder: exercise.supersetOrder || null,
            });
          }
        }
      }
      
      for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
        if (!scheduledDays.has(dayOfWeek)) {
          const restDay = await storage.createProgramWorkout({
            programId: program.id,
            dayOfWeek,
            workoutName: "Rest Day",
            movementFocus: [],
            workoutType: null,
          });
          createdProgramWorkouts.push(restDay);
        }
      }

      // Generate workout schedule for entire program duration
      await generateWorkoutSchedule(program.id, userId, createdProgramWorkouts, generatedProgram.durationWeeks);

      res.json({ program, generatedProgram });
    } catch (error) {
      console.error("Generate program error:", error);
      res.status(500).json({ error: "Failed to generate workout program" });
    }
  });

  // Regenerate program endpoint (alias to generate for Settings page)
  app.post("/api/programs/regenerate", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const latestAssessment = await storage.getCompleteFitnessProfile(userId);
      if (!latestAssessment) {
        return res.status(400).json({ error: "No fitness assessment found. Please complete assessment first." });
      }

      const availableExercises = await storage.getAllExercises();
      if (availableExercises.length === 0) {
        console.error("Master exercise database is empty. Admin must populate via /api/admin/populate-master-exercises");
        return res.status(500).json({ 
          error: "Exercise database not initialized. Please contact support." 
        });
      }

      console.log("Regenerating program with complete fitness profile:", {
        hasPushups: !!latestAssessment.pushups,
        hasPullups: !!latestAssessment.pullups,
        hasBenchPress1RM: !!latestAssessment.benchPress1rm,
        hasSquat1RM: !!latestAssessment.squat1rm,
        nutritionGoal: user.nutritionGoal,
      });

      console.log("[TEMPLATE] Starting program regeneration with nutrition goal:", user.nutritionGoal);
      const generatedProgram = await generateWorkoutProgram({
        user,
        latestAssessment,
        availableExercises,
      });
      console.log("[TEMPLATE] Program regeneration completed successfully");

      const existingPrograms = await storage.getUserPrograms(userId);
      for (const oldProgram of existingPrograms) {
        if (oldProgram.isActive === 1) {
          // Delete incomplete workout sessions from old program before archiving
          await storage.deleteIncompleteProgramSessions(oldProgram.id);
          
          await storage.updateWorkoutProgram(oldProgram.id, { 
            isActive: 0,
            archivedDate: new Date(),
            archivedReason: "replaced"
          });
        }
      }

      const program = await storage.createWorkoutProgram({
        userId,
        fitnessAssessmentId: latestAssessment.id,
        programType: generatedProgram.programType,
        weeklyStructure: generatedProgram.weeklyStructure,
        durationWeeks: generatedProgram.durationWeeks,
        intensityLevel: determineIntensityFromProgramType(generatedProgram.programType),
        isActive: 1,
      });

      const scheduledDays = new Set<number>();
      const createdProgramWorkouts: ProgramWorkout[] = [];
      
      for (const workout of generatedProgram.workouts) {
        scheduledDays.add(workout.dayOfWeek);
        
        const programWorkout = await storage.createProgramWorkout({
          programId: program.id,
          dayOfWeek: workout.dayOfWeek,
          workoutName: workout.workoutName,
          movementFocus: workout.movementFocus,
          workoutType: workout.workoutType,
        });
        createdProgramWorkouts.push(programWorkout);

        for (let i = 0; i < workout.exercises.length; i++) {
          const exercise = workout.exercises[i];
          const matchingExercise = availableExercises.find(
            ex => ex.name.toLowerCase() === exercise.exerciseName.toLowerCase()
          );

          if (matchingExercise) {
            // Use AI-provided weight, or fallback to estimation if not provided
            let recommendedWeight = exercise.recommendedWeight;
            if (!recommendedWeight && !exercise.isWarmup) {
              recommendedWeight = estimateWeightFromBodyweightTest(
                matchingExercise.equipment || [],
                matchingExercise.movementPattern,
                latestAssessment
              );
            }
            
            await storage.createProgramExercise({
              workoutId: programWorkout.id,
              exerciseId: matchingExercise.id,
              orderIndex: i,
              sets: exercise.sets,
              repsMin: exercise.repsMin,
              repsMax: exercise.repsMax,
              recommendedWeight,
              durationSeconds: exercise.durationSeconds,
              workSeconds: exercise.workSeconds,
              restSeconds: exercise.restSeconds,
              targetRPE: exercise.targetRPE,
              targetRIR: exercise.targetRIR,
              notes: exercise.notes,
              supersetGroup: exercise.supersetGroup || null,
              supersetOrder: exercise.supersetOrder || null,
            });
          }
        }
      }
      
      for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
        if (!scheduledDays.has(dayOfWeek)) {
          const restDay = await storage.createProgramWorkout({
            programId: program.id,
            dayOfWeek,
            workoutName: "Rest Day",
            movementFocus: [],
            workoutType: null,
          });
          createdProgramWorkouts.push(restDay);
        }
      }

      // Generate workout schedule for entire program duration
      await generateWorkoutSchedule(program.id, userId, createdProgramWorkouts, generatedProgram.durationWeeks);

      res.json({ program, generatedProgram });
    } catch (error) {
      console.error("Regenerate program error:", error);
      res.status(500).json({ error: "Failed to regenerate workout program" });
    }
  });

  app.post("/api/programs/preview", async (req: Request, res: Response) => {
    try {
      const { 
        experienceLevel, 
        fitnessTest, 
        weightsTest, 
        nutritionGoal,
        equipment, 
        workoutDuration,
        daysPerWeek,
        unitPreference,
        height,
        weight,
        dateOfBirth
      } = req.body;

      if (!equipment || !Array.isArray(equipment)) {
        return res.status(400).json({ error: "Equipment must be an array" });
      }

      // If no equipment selected, default to bodyweight
      const finalEquipment = equipment.length === 0 ? ["bodyweight"] : equipment;

      const tempUser = {
        id: "temp-preview-user",
        username: "preview",
        equipment: finalEquipment,
        workoutDuration: workoutDuration || 60,
        daysPerWeek: daysPerWeek || 3,
        nutritionGoal: nutritionGoal || "maintain",
        unitPreference: unitPreference || "imperial",
        fitnessLevel: experienceLevel || "beginner",
        weight: weight,
        height: height,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      };

      const tempAssessment = {
        id: "temp-preview-assessment",
        userId: "temp-preview-user",
        experienceLevel: experienceLevel || "beginner",
        ...fitnessTest,
        ...weightsTest,
        createdAt: new Date(),
      };

      const availableExercises = await storage.getAllExercises();
      if (availableExercises.length === 0) {
        console.error("Master exercise database is empty. Admin must populate via /api/admin/populate-master-exercises");
        return res.status(500).json({ 
          error: "Exercise database not initialized. Please try again later." 
        });
      }

      const generatedProgram = await generateWorkoutProgram({
        user: tempUser as any,
        latestAssessment: tempAssessment as any,
        availableExercises,
      });

      const workoutsWithExercises = generatedProgram.workouts.map((workout) => {
        const exercisesWithDetails = workout.exercises.map((ex) => {
          const matchingExercise = availableExercises.find(
            exercise => exercise.name.toLowerCase() === ex.exerciseName.toLowerCase()
          );
          
          return {
            ...ex,
            exercise: matchingExercise || {
              id: 'unknown',
              name: ex.exerciseName,
              description: '',
              movementPattern: 'unknown',
              equipment: [],
              difficulty: 'beginner',
              primaryMuscles: [],
              secondaryMuscles: [],
              exerciseType: 'main',
              liftType: 'compound',
              isCorrective: 0,
              formTips: []
            }
          };
        });
        
        return { ...workout, exercises: exercisesWithDetails };
      });

      const enrichedProgram = {
        ...generatedProgram,
        workouts: workoutsWithExercises
      };

      res.json(enrichedProgram);
    } catch (error) {
      console.error("Generate preview program error:", error);
      res.status(500).json({ error: "Failed to generate workout program preview" });
    }
  });

  app.get("/api/programs/active", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const program = await storage.getUserActiveProgram(userId);
      res.json(program || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active program" });
    }
  });

  app.get("/api/programs/archived", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const allPrograms = await storage.getUserPrograms(userId);
      const archivedPrograms = allPrograms.filter(p => p.isActive === 0 && p.archivedDate !== null);
      res.json(archivedPrograms);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch archived programs" });
    }
  });

  app.get("/api/program-workouts/:programId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const program = await storage.getWorkoutProgram(req.params.programId);
      if (!program) {
        return res.status(404).json({ error: "Program not found" });
      }

      if (program.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to access this program" });
      }

      const workouts = await storage.getProgramWorkouts(req.params.programId);
      res.json(workouts);
    } catch (error) {
      console.error("Fetch program workouts error:", error);
      res.status(500).json({ error: "Failed to fetch program workouts" });
    }
  });

  app.get("/api/programs/:programId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const program = await storage.getWorkoutProgram(req.params.programId);
      if (!program) {
        return res.status(404).json({ error: "Program not found" });
      }

      const workouts = await storage.getProgramWorkouts(program.id);
      const workoutsWithExercises = await Promise.all(
        workouts.map(async (workout) => {
          const exercises = await storage.getWorkoutExercises(workout.id);
          const exercisesWithDetails = await Promise.all(
            exercises.map(async (ex) => {
              const exercise = await storage.getExercise(ex.exerciseId);
              return { ...ex, exercise };
            })
          );
          return { ...workout, exercises: exercisesWithDetails };
        })
      );

      res.json({ ...program, workouts: workoutsWithExercises });
    } catch (error) {
      console.error("Fetch program error:", error);
      res.status(500).json({ error: "Failed to fetch program" });
    }
  });

  app.patch("/api/programs/exercises/:exerciseId/update-weight", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const { recommendedWeight, repsMin, repsMax } = req.body;
      
      const exercise = await storage.getProgramExercise(req.params.exerciseId);
      if (!exercise) {
        return res.status(404).json({ error: "Exercise not found" });
      }

      const updates: Partial<any> = {};
      if (recommendedWeight !== undefined) {
        updates.recommendedWeight = parseFloat(recommendedWeight);
      }
      if (repsMin !== undefined) {
        updates.repsMin = parseInt(repsMin);
      }
      if (repsMax !== undefined) {
        updates.repsMax = parseInt(repsMax);
      }

      const updatedExercise = await storage.updateProgramExercise(req.params.exerciseId, updates);

      res.json(updatedExercise);
    } catch (error) {
      console.error("Update exercise error:", error);
      res.status(500).json({ error: "Failed to update exercise" });
    }
  });

  app.patch("/api/programs/exercises/:exerciseId/swap", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const { newExerciseId, equipment } = req.body;
      
      if (!newExerciseId) {
        return res.status(400).json({ error: "New exercise ID is required" });
      }

      const programExercise = await storage.getProgramExercise(req.params.exerciseId);
      if (!programExercise) {
        return res.status(404).json({ error: "Program exercise not found" });
      }

      const newExercise = await storage.getExercise(newExerciseId);
      if (!newExercise) {
        return res.status(404).json({ error: "New exercise not found" });
      }

      const updates: any = { 
        exerciseId: newExerciseId,
        equipment: equipment || null, // Always update equipment field, clear if not provided
      };

      const updatedExercise = await storage.updateProgramExercise(req.params.exerciseId, updates);

      res.json(updatedExercise);
    } catch (error) {
      console.error("Swap exercise error:", error);
      res.status(500).json({ error: "Failed to swap exercise" });
    }
  });

  // Workout Session routes
  app.post("/api/workout-sessions", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      // Calculate current day of week in ISO format (1=Monday, 7=Sunday)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayOfWeek = today.getDay();
      const sessionDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

      const validatedData = insertWorkoutSessionSchema.parse({
        ...req.body,
        userId,
        sessionDayOfWeek,
      });

      // Validate that the programWorkoutId exists and belongs to user's program
      let workoutName: string | undefined;
      if (validatedData.programWorkoutId) {
        const programWorkout = await storage.getProgramWorkout(validatedData.programWorkoutId);
        if (!programWorkout) {
          return res.status(404).json({ error: "Program workout not found" });
        }

        workoutName = programWorkout.workoutName;

        // Verify the workout belongs to a program owned by the user
        const program = await storage.getWorkoutProgram(programWorkout.programId);
        if (!program || program.userId !== userId) {
          return res.status(403).json({ error: "Unauthorized access to program workout" });
        }

        // Look for existing pre-scheduled session (calendar-based system)
        const userSessions = await storage.getUserSessions(userId);
        
        // Find the earliest incomplete pre-scheduled session for this workout
        // Pre-scheduled sessions have status="scheduled" and scheduledDate set
        const incompleteSessions = userSessions
          .filter((s: any) => {
            return s.programWorkoutId === validatedData.programWorkoutId && 
                   s.completed === 0 && 
                   s.scheduledDate !== null &&
                   s.status === 'scheduled'; // Only pre-scheduled sessions
          })
          .sort((a: any, b: any) => {
            const dateA = new Date(a.scheduledDate).getTime();
            const dateB = new Date(b.scheduledDate).getTime();
            return dateA - dateB; // Ascending order - earliest first
          });
        
        const existingScheduledSession = incompleteSessions[0];

        // If we found a pre-scheduled session, update it instead of creating new
        if (existingScheduledSession) {
          const wasIncomplete = existingScheduledSession.completed === 0;
          
          const updatedSession = await storage.updateWorkoutSession(existingScheduledSession.id, {
            ...validatedData,
            sessionDate: new Date(),
          });
          
          // If session was just completed, shift the remaining schedule
          if (wasIncomplete && validatedData.completed === 1 && updatedSession && existingScheduledSession.programWorkoutId) {
            const programWorkout = await storage.getProgramWorkout(existingScheduledSession.programWorkoutId);
            if (programWorkout && existingScheduledSession.scheduledDate) {
              await storage.shiftRemainingSchedule(
                userId,
                existingScheduledSession.scheduledDate,
                programWorkout.programId
              );
            }
          }
          
          return res.json(updatedSession);
        }

        // If no incomplete sessions found, this workout is complete - don't create duplicates
        if (validatedData.completed === 1) {
          return res.status(400).json({ 
            error: "No incomplete sessions available for this workout" 
          });
        }
      }

      const session = await storage.createWorkoutSession({
        ...validatedData,
        workoutName,
      });
      res.json(session);
    } catch (error) {
      console.error("Create session error:", error);
      res.status(500).json({ error: "Failed to create workout session" });
    }
  });

  // Convert rest day session to Zone 2 cardio session
  app.post("/api/programs/sessions/cardio/:date", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const scheduledDate = req.params.date;
      const suggestedDuration = req.body?.suggestedDuration;

      if (!scheduledDate) {
        return res.status(400).json({ error: "date parameter is required" });
      }

      // Get user's active program
      const activeProgram = await storage.getUserActiveProgram(userId);
      if (!activeProgram) {
        return res.status(404).json({ error: "No active program found" });
      }

      // Parse the scheduled date
      const sessionScheduledDate = new Date(scheduledDate);

      // Find the existing session on this date (exclude archived sessions)
      const existingSessions = await storage.getUserSessions(userId);
      const sessionOnDate = existingSessions.find((s: any) => {
        if (!s.scheduledDate || s.status === 'archived') return false;
        const existingDate = new Date(s.scheduledDate);
        return existingDate.toISOString().split('T')[0] === sessionScheduledDate.toISOString().split('T')[0];
      });

      console.log('[CARDIO] Date:', scheduledDate, 'Session found:', sessionOnDate ? { id: sessionOnDate.id, type: sessionOnDate.sessionType, workoutName: sessionOnDate.workoutName } : 'none');

      if (!sessionOnDate) {
        return res.status(404).json({ error: "No session found for this date" });
      }

      if (sessionOnDate.sessionType === 'workout') {
        console.log('[CARDIO] Session is already a workout (not a rest day)');
        return res.status(400).json({ error: "This is a workout day, not a rest day. You can only add cardio to rest days." });
      }

      // Update the existing rest day session to become a cardio workout session
      const duration = suggestedDuration || 30; // Default 30 minutes
      const updatedSession = await storage.updateWorkoutSession(sessionOnDate.id, {
        sessionType: "workout",
        workoutType: "cardio",
        workoutName: "Zone 2 Cardio",
        notes: `Low-impact steady-state cardio session. Target: ${duration} minutes at Zone 2 heart rate (60-70% max HR)`,
      });

      if (!updatedSession) {
        return res.status(500).json({ error: "Failed to update session" });
      }

      res.json(updatedSession);
    } catch (error) {
      console.error("Convert to cardio session error:", error);
      res.status(500).json({ error: "Failed to convert to cardio session" });
    }
  });

  app.put("/api/workout-sessions/:sessionId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const session = await storage.updateWorkoutSession(req.params.sessionId, req.body);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.patch("/api/workout-sessions/:sessionId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      // Get the old session to check if completion status is changing
      const oldSession = await storage.getWorkoutSession(req.params.sessionId);
      if (!oldSession) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Validate and transform the patch data (converts boolean completed to integer)
      const validatedData = patchWorkoutSessionSchema.parse(req.body);

      // Auto-archive sessions when completed
      if (validatedData.completed === 1 && !validatedData.status) {
        validatedData.status = "archived";
      }

      // Calculate calories burned if workout is being completed
      if (validatedData.completed === 1 && validatedData.durationMinutes && !validatedData.caloriesBurned) {
        try {
          // Get user data for weight
          const user = await storage.getUser(userId);
          
          // Get program data for intensity level
          let intensityLevel: "light" | "moderate" | "vigorous" | "circuit" = "moderate";
          if (oldSession.programWorkoutId) {
            const programWorkout = await storage.getProgramWorkout(oldSession.programWorkoutId);
            if (programWorkout) {
              const program = await storage.getWorkoutProgram(programWorkout.programId);
              if (program) {
                intensityLevel = program.intensityLevel as any;
                
                // Check if workout contains supersets - boost intensity
                const exercises = await storage.getWorkoutExercises(programWorkout.id);
                const hasSupersets = exercises.some((ex: any) => ex.supersetGroup !== null && ex.supersetGroup !== undefined);
                
                if (hasSupersets) {
                  // Supersets are more intense - boost the MET value
                  if (intensityLevel === "light") {
                    intensityLevel = "moderate";
                  } else if (intensityLevel === "moderate") {
                    intensityLevel = "vigorous";
                  } else if (intensityLevel === "vigorous") {
                    intensityLevel = "circuit";
                  }
                  // circuit stays circuit
                }
              }
            }
          }
          
          // Calculate calories if we have weight data
          if (user?.weight) {
            const weightKg = user.unitPreference === 'imperial' ? poundsToKg(user.weight) : user.weight;
            const calories = calculateCaloriesBurned(
              validatedData.durationMinutes,
              weightKg,
              intensityLevel
            );
            validatedData.caloriesBurned = calories;
          }
        } catch (calorieError) {
          console.error("Error calculating calories:", calorieError);
          // Continue without calories if calculation fails
        }
      }

      const session = await storage.updateWorkoutSession(req.params.sessionId, validatedData);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // If session was just completed, shift the remaining schedule
      if (oldSession.completed === 0 && validatedData.completed === 1 && session.programWorkoutId && session.scheduledDate) {
        const programWorkout = await storage.getProgramWorkout(session.programWorkoutId);
        if (programWorkout) {
          await storage.shiftRemainingSchedule(
            userId,
            session.scheduledDate,
            programWorkout.programId
          );
        }
      }

      res.json(session);
    } catch (error) {
      console.error("Patch session error:", error);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.get("/api/workout-sessions", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const sessions = await storage.getUserSessions(userId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.get("/api/workout-sessions/calories/today", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch completed sessions for today and sum calories
      const totalCalories = await storage.getTodayCaloriesBurned(userId, today, tomorrow);
      res.json({ calories: totalCalories || 0 });
    } catch (error) {
      console.error("Error fetching today's calories:", error);
      res.status(500).json({ error: "Failed to fetch calories" });
    }
  });

  // Workout Set routes
  app.post("/api/workout-sets", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const validatedData = insertWorkoutSetSchema.parse(req.body);
      const set = await storage.createWorkoutSet(validatedData);
      res.json(set);
    } catch (error) {
      console.error("Create set error:", error);
      res.status(500).json({ error: "Failed to create workout set" });
    }
  });

  app.put("/api/workout-sets/:setId", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const set = await storage.updateWorkoutSet(req.params.setId, req.body);
      if (!set) {
        return res.status(404).json({ error: "Set not found" });
      }

      res.json(set);
    } catch (error) {
      res.status(500).json({ error: "Failed to update set" });
    }
  });

  app.get("/api/workout-sessions/:sessionId/sets", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const sets = await storage.getSessionSets(req.params.sessionId);
      res.json(sets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sets" });
    }
  });

  app.get("/api/workout-sets", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const exerciseId = req.query.exerciseId as string;
      if (!exerciseId) {
        return res.status(400).json({ error: "exerciseId query parameter required" });
      }

      const sets = await storage.getUserRecentSets(userId, exerciseId, 10);
      res.json(sets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workout sets" });
    }
  });

  // AI Recommendation routes
  app.post("/api/ai/progression-recommendation", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const { exerciseName, recentPerformance } = req.body;
      const recommendation = await generateProgressionRecommendation(
        exerciseName,
        recentPerformance
      );
      res.json(recommendation);
    } catch (error) {
      console.error("Progression recommendation error:", error);
      res.status(500).json({ error: "Failed to generate recommendation" });
    }
  });

  app.post("/api/ai/exercise-swap", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const { currentExerciseName, targetMovementPattern, availableEquipment, reason } = req.body;
      const suggestions = await suggestExerciseSwap(
        currentExerciseName,
        targetMovementPattern,
        availableEquipment,
        reason
      );
      res.json({ suggestions });
    } catch (error) {
      console.error("Exercise swap error:", error);
      res.status(500).json({ error: "Failed to suggest exercise swap" });
    }
  });

  app.post("/api/exercises/similar", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      const { exerciseId, movementPattern, primaryMuscles, currentEquipment } = req.body;
      
      // Fetch user data and fitness assessment for difficulty filtering
      const user = await storage.getUser(userId);
      const latestAssessment = await storage.getLatestFitnessAssessment(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Calculate movement pattern levels and get allowed difficulties
      const { calculateMovementPatternLevels, getMovementDifficultiesMap, isExerciseAllowed: checkExerciseAllowed } = await import("@shared/utils");
      
      const fitnessLevel = latestAssessment?.experienceLevel || user.fitnessLevel || 'beginner';
      
      // Use assessment if available, otherwise default all patterns to user's declared fitness level
      const movementLevels = latestAssessment 
        ? calculateMovementPatternLevels(latestAssessment, user)
        : { 
            push: fitnessLevel as 'beginner' | 'intermediate' | 'advanced', 
            pull: fitnessLevel as 'beginner' | 'intermediate' | 'advanced', 
            lowerBody: fitnessLevel as 'beginner' | 'intermediate' | 'advanced', 
            hinge: fitnessLevel as 'beginner' | 'intermediate' | 'advanced', 
            cardio: fitnessLevel as 'beginner' | 'intermediate' | 'advanced' 
          };
      
      const movementDifficulties = getMovementDifficultiesMap(movementLevels, fitnessLevel);
      
      const allExercises = await storage.getAllExercises();
      
      // Filter by movement pattern, broad muscle groups, AND difficulty level
      // Note: primaryMuscles now contains broad groups (chest, shoulders, back, core, legs, arms, grip)
      // while secondaryMuscles contains specific anatomical details
      const similarExercises = allExercises.filter(ex => {
        // Include same exercise (for equipment variants) OR different exercises
        if (ex.movementPattern !== movementPattern) return false;
        
        // Match broad muscle groups (e.g., "chest" matches exercises with "chest" in primaryMuscles)
        const hasMatchingMuscle = primaryMuscles.some((muscle: string) => 
          ex.primaryMuscles.includes(muscle)
        );
        
        if (!hasMatchingMuscle) return false;
        
        // Apply difficulty filtering based on user's movement pattern level
        return checkExerciseAllowed(ex, movementDifficulties, fitnessLevel);
      });

      // Build results with equipment variants
      const results: Array<Exercise & { selectedEquipment?: string }> = [];
      
      for (const ex of similarExercises) {
        if (ex.id === exerciseId) {
          // Same exercise: show equipment variants different from current
          const userEquipment = user.equipment || [];
          const availableEquipment = ex.equipment.filter(eq => 
            userEquipment.includes(eq) && eq !== currentEquipment
          );
          
          // Add one entry per equipment variant
          for (const equipment of availableEquipment) {
            results.push({ ...ex, selectedEquipment: equipment });
          }
        } else {
          // Different exercise: show with first available equipment option
          const userEquipment = user.equipment || [];
          const firstAvailable = ex.equipment.find(eq => userEquipment.includes(eq));
          
          if (firstAvailable) {
            results.push({ ...ex, selectedEquipment: firstAvailable });
          }
        }
      }
      
      res.json(results);
    } catch (error) {
      console.error("Similar exercises error:", error);
      res.status(500).json({ error: "Failed to fetch similar exercises" });
    }
  });

  const httpServer = createServer(app);

  // Mark routes as registered only after successful setup
  routesRegistered = true;
  console.log("[ROUTES] Route registration completed successfully");

  return httpServer;
}
