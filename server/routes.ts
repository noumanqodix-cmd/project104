import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateWorkoutProgram, suggestExerciseSwap, generateProgressionRecommendation } from "./ai-service";
import { generateComprehensiveExerciseLibrary, generateMasterExerciseDatabase, generateExercisesForEquipment } from "./ai-exercise-generator";
import { insertFitnessAssessmentSchema, insertWorkoutSessionSchema, insertWorkoutSetSchema } from "@shared/schema";
import bcrypt from "bcrypt";

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
        const latestAssessment = await storage.getLatestFitnessAssessment(user.id);
        if (latestAssessment) {
          let programData;
          
          if (generatedProgram) {
            console.log("Using pre-generated program provided in signup request");
            programData = generatedProgram;
          } else {
            console.log("Generating new program using AI");
            programData = await generateWorkoutProgram({
              user: updatedUser,
              latestAssessment,
              availableExercises,
            });
          }

          const existingPrograms = await storage.getUserPrograms(user.id);
          for (const oldProgram of existingPrograms) {
            await storage.updateWorkoutProgram(oldProgram.id, { isActive: 0 });
          }

          const program = await storage.createWorkoutProgram({
            userId: user.id,
            fitnessAssessmentId: latestAssessment.id,
            programType: programData.programType,
            weeklyStructure: programData.weeklyStructure,
            durationWeeks: programData.durationWeeks,
            isActive: 1,
          });

          for (const workout of programData.workouts) {
            const programWorkout = await storage.createProgramWorkout({
              programId: program.id,
              dayOfWeek: workout.dayOfWeek,
              workoutName: workout.workoutName,
              movementFocus: workout.movementFocus,
            });

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
                  restSeconds: exercise.restSeconds,
                  notes: exercise.notes,
                });
              }
            }
          }
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

      const latestAssessment = await storage.getLatestFitnessAssessment(userId);
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

      const generatedProgram = await generateWorkoutProgram({
        user,
        latestAssessment,
        availableExercises,
      });

      const existingPrograms = await storage.getUserPrograms(userId);
      for (const oldProgram of existingPrograms) {
        await storage.updateWorkoutProgram(oldProgram.id, { isActive: 0 });
      }

      const program = await storage.createWorkoutProgram({
        userId,
        fitnessAssessmentId: latestAssessment.id,
        programType: generatedProgram.programType,
        weeklyStructure: generatedProgram.weeklyStructure,
        durationWeeks: generatedProgram.durationWeeks,
        isActive: 1,
      });

      for (const workout of generatedProgram.workouts) {
        const programWorkout = await storage.createProgramWorkout({
          programId: program.id,
          dayOfWeek: workout.dayOfWeek,
          workoutName: workout.workoutName,
          movementFocus: workout.movementFocus,
        });

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
              durationSeconds: exercise.durationSeconds,
              restSeconds: exercise.restSeconds,
              targetRPE: exercise.targetRPE,
              targetRIR: exercise.targetRIR,
              notes: exercise.notes,
            });
          }
        }
      }

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

  // Workout Session routes
  app.post("/api/workout-sessions", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const validatedData = insertWorkoutSessionSchema.parse({
        ...req.body,
        userId: (req as any).session.userId,
      });

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

  const httpServer = createServer(app);

  return httpServer;
}
