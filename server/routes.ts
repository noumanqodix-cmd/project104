import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateWorkoutProgram, suggestExerciseSwap, generateProgressionRecommendation } from "./ai-service";
import { generateComprehensiveExerciseLibrary, generateMasterExerciseDatabase, generateExercisesForEquipment } from "./ai-exercise-generator";
import { insertFitnessAssessmentSchema, insertWorkoutSessionSchema, patchWorkoutSessionSchema, insertWorkoutSetSchema, type FitnessAssessment, type ProgramWorkout } from "@shared/schema";
import bcrypt from "bcrypt";

// Helper function to generate workout schedule for entire program duration
async function generateWorkoutSchedule(programId: string, userId: string, programWorkouts: ProgramWorkout[], durationWeeks: number) {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0); // Start of today
  
  // Calculate the first Monday of the program
  const dayOfWeek = startDate.getDay();
  const daysUntilMonday = (dayOfWeek === 0 ? 1 : (8 - dayOfWeek)) % 7;
  const firstMonday = new Date(startDate);
  if (daysUntilMonday > 0) {
    firstMonday.setDate(startDate.getDate() + daysUntilMonday);
  }
  
  // Generate sessions for all weeks
  const sessions = [];
  for (let week = 0; week < durationWeeks; week++) {
    for (const programWorkout of programWorkouts) {
      const scheduledDate = new Date(firstMonday);
      scheduledDate.setDate(firstMonday.getDate() + (week * 7) + (programWorkout.dayOfWeek - 1));
      
      sessions.push({
        userId,
        programWorkoutId: programWorkout.id,
        scheduledDate,
        sessionDayOfWeek: programWorkout.dayOfWeek,
        completed: 0,
        status: "scheduled" as const,
      });
    }
  }
  
  // Create all sessions in database
  for (const session of sessions) {
    await storage.createWorkoutSession(session);
  }
  
  return sessions.length;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const { email, password, fitnessTest, weightsTest, experienceLevel, generatedProgram, ...profileData } = req.body;
      
      const existingUser = await storage.getUserByUsername(email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      // Hash password before storing
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username: email, password: hashedPassword });
      
      if (Object.keys(profileData).length > 0) {
        await storage.updateUser(user.id, profileData);
      }

      (req as any).session.userId = user.id;
      
      await new Promise<void>((resolve, reject) => {
        (req as any).session.save((err: any) => {
          if (err) {
            console.error("Session save error:", err);
            reject(err);
          } else {
            console.log("Session saved successfully. SessionID:", (req as any).session.id, "UserID:", user.id);
            resolve();
          }
        });
      });
      
      const updatedUser = await storage.getUser(user.id);
      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to retrieve user after creation" });
      }
      
      // Save fitness assessment if provided
      if (fitnessTest || weightsTest) {
        try {
          const assessmentData = {
            userId: user.id,
            experienceLevel: experienceLevel || profileData.fitnessLevel,
            ...fitnessTest,
            ...weightsTest,
          };
          await storage.createFitnessAssessment(assessmentData);
        } catch (assessmentError) {
          console.error("Failed to save fitness assessment during signup:", assessmentError);
          // Don't fail signup, but log the error
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
      
      // Generate or use provided workout program
      try {
        const latestAssessment = await storage.getCompleteFitnessProfile(user.id);
        if (latestAssessment) {
          let programData;
          
          if (generatedProgram) {
            console.log("Using pre-generated program provided in signup request");
            programData = generatedProgram;
          } else {
            console.log("Generating new program using AI with complete fitness profile");
            programData = await generateWorkoutProgram({
              user: updatedUser,
              latestAssessment,
              availableExercises,
            });
          }

          const existingPrograms = await storage.getUserPrograms(user.id);
          for (const oldProgram of existingPrograms) {
            if (oldProgram.isActive === 1) {
              await storage.updateWorkoutProgram(oldProgram.id, { 
                isActive: 0,
                archivedDate: new Date(),
                archivedReason: "replaced"
              });
            }
          }

          const program = await storage.createWorkoutProgram({
            userId: user.id,
            fitnessAssessmentId: latestAssessment.id,
            programType: programData.programType,
            weeklyStructure: programData.weeklyStructure,
            durationWeeks: programData.durationWeeks,
            isActive: 1,
          });

          const scheduledDays = new Set<number>();
          const createdProgramWorkouts: ProgramWorkout[] = [];
          
          for (const workout of programData.workouts) {
            scheduledDays.add(workout.dayOfWeek);
            
            const programWorkout = await storage.createProgramWorkout({
              programId: program.id,
              dayOfWeek: workout.dayOfWeek,
              workoutName: workout.workoutName,
              movementFocus: workout.movementFocus,
              workoutType: "workout",
            });
            createdProgramWorkouts.push(programWorkout);

            for (let i = 0; i < workout.exercises.length; i++) {
              const exercise = workout.exercises[i];
              const matchingExercise = availableExercises.find(
                ex => ex.name.toLowerCase() === exercise.exerciseName.toLowerCase()
              );

              if (matchingExercise) {
                await storage.createProgramExercise({
                  workoutId: programWorkout.id,
                  exerciseId: matchingExercise.id,
                  orderIndex: i,
                  sets: exercise.sets,
                  repsMin: exercise.repsMin,
                  repsMax: exercise.repsMax,
                  recommendedWeight: exercise.recommendedWeight,
                  restSeconds: exercise.restSeconds,
                  notes: exercise.notes,
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
                workoutType: "rest",
              });
              createdProgramWorkouts.push(restDay);
            }
          }
          
          // Generate workout schedule for entire program duration
          await generateWorkoutSchedule(program.id, user.id, createdProgramWorkouts, programData.durationWeeks);
        }
      } catch (programError) {
        console.log("Failed to generate/save program during signup:", programError);
        // Don't fail signup, program can be generated later
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const user = await storage.getUserByUsername(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Verify password using bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Set up session
      (req as any).session.userId = user.id;

      await new Promise<void>((resolve, reject) => {
        (req as any).session.save((err: any) => {
          if (err) {
            console.error("Session save error during login:", err);
            reject(err);
          } else {
            console.log("Login session saved. SessionID:", (req as any).session.id, "UserID:", user.id);
            resolve();
          }
        });
      });

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to log in" });
    }
  });

  app.get("/api/auth/user", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser((req as any).session.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.put("/api/user/profile", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const updates = req.body;
      const user = await storage.getUser((req as any).session.userId);
      
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
        const finalAge = updates.age !== undefined ? updates.age : user.age;
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
      
      const updatedUser = await storage.updateUser((req as any).session.userId, updates);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.put("/api/user/unit-preference", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { unitPreference } = req.body;
      
      if (!unitPreference || !['imperial', 'metric'].includes(unitPreference)) {
        return res.status(400).json({ error: "Invalid unit preference. Must be 'imperial' or 'metric'" });
      }

      const updatedUser = await storage.updateUser((req as any).session.userId, {
        unitPreference
      });
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update unit preference error:", error);
      res.status(500).json({ error: "Failed to update unit preference" });
    }
  });

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    (req as any).session.destroy();
    res.json({ success: true });
  });

  // Fitness Assessment routes
  app.post("/api/fitness-assessments", async (req: Request, res: Response) => {
    try {
      console.log("Fitness assessment request. SessionID:", (req as any).session?.id, "UserID:", (req as any).session?.userId);
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const validatedData = insertFitnessAssessmentSchema.parse({
        ...req.body,
        userId: (req as any).session.userId,
      });

      const assessment = await storage.createFitnessAssessment(validatedData);
      res.json(assessment);
    } catch (error) {
      console.error("Create assessment error:", error);
      res.status(500).json({ error: "Failed to create fitness assessment" });
    }
  });

  app.get("/api/fitness-assessments", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const assessments = await storage.getUserFitnessAssessments((req as any).session.userId);
      res.json(assessments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assessments" });
    }
  });

  app.get("/api/fitness-assessments/latest", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const assessment = await storage.getLatestFitnessAssessment((req as any).session.userId);
      res.json(assessment || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch latest assessment" });
    }
  });

  // Exercise routes
  app.post("/api/exercises/seed", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const existingExercises = await storage.getAllExercises();
      if (existingExercises.length > 0) {
        return res.json({ count: existingExercises.length, exercises: existingExercises, message: "Exercises already seeded" });
      }

      const userId = (req as any).session.userId;
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
        "pull-up bar", "trx", "medicine ball", "box", "jump rope", "foam roller", "yoga mat"
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
  app.post("/api/programs/generate", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = (req as any).session.userId;
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
      });

      const generatedProgram = await generateWorkoutProgram({
        user,
        latestAssessment,
        availableExercises,
      });

      const existingPrograms = await storage.getUserPrograms(userId);
      for (const oldProgram of existingPrograms) {
        if (oldProgram.isActive === 1) {
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
          workoutType: "workout",
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
              restSeconds: exercise.restSeconds,
              targetRPE: exercise.targetRPE,
              targetRIR: exercise.targetRIR,
              notes: exercise.notes,
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
            workoutType: "rest",
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
        unitPreference 
      } = req.body;

      if (!equipment || !Array.isArray(equipment) || equipment.length === 0) {
        return res.status(400).json({ error: "Equipment array is required" });
      }

      const tempUser = {
        id: "temp-preview-user",
        username: "preview",
        password: "",
        equipment: equipment,
        workoutDuration: workoutDuration || 60,
        daysPerWeek: daysPerWeek || 3,
        nutritionGoal: nutritionGoal || "maintain",
        unitPreference: unitPreference || "imperial",
        fitnessLevel: experienceLevel || "beginner",
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
              isFunctional: 1,
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

  app.get("/api/programs/active", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const program = await storage.getUserActiveProgram((req as any).session.userId);
      res.json(program || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active program" });
    }
  });

  app.get("/api/programs/archived", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const allPrograms = await storage.getUserPrograms((req as any).session.userId);
      const archivedPrograms = allPrograms.filter(p => p.isActive === 0 && p.archivedDate !== null);
      res.json(archivedPrograms);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch archived programs" });
    }
  });

  app.get("/api/program-workouts/:programId", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const program = await storage.getWorkoutProgram(req.params.programId);
      if (!program) {
        return res.status(404).json({ error: "Program not found" });
      }

      if (program.userId !== (req as any).session.userId) {
        return res.status(403).json({ error: "Not authorized to access this program" });
      }

      const workouts = await storage.getProgramWorkouts(req.params.programId);
      res.json(workouts);
    } catch (error) {
      console.error("Fetch program workouts error:", error);
      res.status(500).json({ error: "Failed to fetch program workouts" });
    }
  });

  app.get("/api/programs/:programId", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

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

  app.patch("/api/programs/exercises/:exerciseId/update-weight", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

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

  app.patch("/api/programs/exercises/:exerciseId/swap", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { newExerciseId } = req.body;
      
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

      const updatedExercise = await storage.updateProgramExercise(req.params.exerciseId, {
        exerciseId: newExerciseId,
      });

      res.json(updatedExercise);
    } catch (error) {
      console.error("Swap exercise error:", error);
      res.status(500).json({ error: "Failed to swap exercise" });
    }
  });

  // Workout Session routes
  app.post("/api/workout-sessions", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Calculate current day of week in ISO format (1=Monday, 7=Sunday)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayOfWeek = today.getDay();
      const sessionDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

      const validatedData = insertWorkoutSessionSchema.parse({
        ...req.body,
        userId: (req as any).session.userId,
        sessionDayOfWeek,
      });

      // Validate that the programWorkoutId exists and belongs to user's program
      if (validatedData.programWorkoutId) {
        const programWorkout = await storage.getProgramWorkout(validatedData.programWorkoutId);
        if (!programWorkout) {
          return res.status(404).json({ error: "Program workout not found" });
        }

        // Verify the workout belongs to a program owned by the user
        const program = await storage.getWorkoutProgram(programWorkout.programId);
        if (!program || program.userId !== (req as any).session.userId) {
          return res.status(403).json({ error: "Unauthorized access to program workout" });
        }

        // Look for existing pre-scheduled session (calendar-based system)
        const userSessions = await storage.getUserSessions((req as any).session.userId);
        
        // Find the earliest incomplete pre-scheduled session for this workout
        // Filter: must be incomplete, have scheduledDate, AND sessionDate must be older (not created today)
        // This prevents finding duplicate sessions created by previous failed attempts
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);
        
        const incompleteSessions = userSessions
          .filter((s: any) => {
            const sessionDate = new Date(s.sessionDate);
            return s.programWorkoutId === validatedData.programWorkoutId && 
                   s.completed === 0 && 
                   s.scheduledDate !== null &&
                   sessionDate < todayStart; // Only pre-scheduled sessions (created before today)
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
          if (wasIncomplete && validatedData.completed === 1 && updatedSession) {
            const programWorkout = await storage.getProgramWorkout(existingScheduledSession.programWorkoutId);
            if (programWorkout && existingScheduledSession.scheduledDate) {
              await storage.shiftRemainingSchedule(
                (req as any).session.userId,
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

        // Fallback: Check for duplicate in current week (legacy behavior for old data)
        const isoDay = sessionDayOfWeek;
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - (isoDay - 1));
        startOfWeek.setHours(0, 0, 0, 0);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        
        const existingWeekSession = userSessions.find((s: any) => {
          const sessionDate = new Date(s.sessionDate);
          return s.programWorkoutId === validatedData.programWorkoutId && 
                 sessionDate >= startOfWeek &&
                 sessionDate <= endOfWeek;
        });

        if (existingWeekSession) {
          return res.status(409).json({ error: "Session already exists for this workout this week" });
        }
      }

      const session = await storage.createWorkoutSession(validatedData);
      res.json(session);
    } catch (error) {
      console.error("Create session error:", error);
      res.status(500).json({ error: "Failed to create workout session" });
    }
  });

  app.put("/api/workout-sessions/:sessionId", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const session = await storage.updateWorkoutSession(req.params.sessionId, req.body);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.patch("/api/workout-sessions/:sessionId", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Get the old session to check if completion status is changing
      const oldSession = await storage.getWorkoutSession(req.params.sessionId);
      if (!oldSession) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Validate and transform the patch data (converts boolean completed to integer)
      const validatedData = patchWorkoutSessionSchema.parse(req.body);

      const session = await storage.updateWorkoutSession(req.params.sessionId, validatedData);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // If session was just completed, shift the remaining schedule
      if (oldSession.completed === 0 && validatedData.completed === 1 && session.programWorkoutId && session.scheduledDate) {
        const programWorkout = await storage.getProgramWorkout(session.programWorkoutId);
        if (programWorkout) {
          await storage.shiftRemainingSchedule(
            (req as any).session.userId,
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

  app.get("/api/workout-sessions", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const sessions = await storage.getUserSessions((req as any).session.userId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  // Workout Set routes
  app.post("/api/workout-sets", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const validatedData = insertWorkoutSetSchema.parse(req.body);
      const set = await storage.createWorkoutSet(validatedData);
      res.json(set);
    } catch (error) {
      console.error("Create set error:", error);
      res.status(500).json({ error: "Failed to create workout set" });
    }
  });

  app.put("/api/workout-sets/:setId", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const set = await storage.updateWorkoutSet(req.params.setId, req.body);
      if (!set) {
        return res.status(404).json({ error: "Set not found" });
      }

      res.json(set);
    } catch (error) {
      res.status(500).json({ error: "Failed to update set" });
    }
  });

  app.get("/api/workout-sessions/:sessionId/sets", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const sets = await storage.getSessionSets(req.params.sessionId);
      res.json(sets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sets" });
    }
  });

  app.get("/api/workout-sets", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const exerciseId = req.query.exerciseId as string;
      if (!exerciseId) {
        return res.status(400).json({ error: "exerciseId query parameter required" });
      }

      const sets = await storage.getUserRecentSets((req as any).session.userId, exerciseId, 10);
      res.json(sets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workout sets" });
    }
  });

  // AI Recommendation routes
  app.post("/api/ai/progression-recommendation", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

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

  app.post("/api/ai/exercise-swap", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

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

  app.post("/api/exercises/similar", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { exerciseId, movementPattern, primaryMuscles } = req.body;
      
      const allExercises = await storage.getAllExercises();
      
      const similarExercises = allExercises.filter(ex => {
        if (ex.id === exerciseId) return false;
        if (ex.movementPattern !== movementPattern) return false;
        
        const hasMatchingMuscle = primaryMuscles.some((muscle: string) => 
          ex.primaryMuscles.includes(muscle)
        );
        
        return hasMatchingMuscle;
      });
      
      res.json(similarExercises);
    } catch (error) {
      console.error("Similar exercises error:", error);
      res.status(500).json({ error: "Failed to fetch similar exercises" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
