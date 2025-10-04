import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateWorkoutProgram, suggestExerciseSwap, generateProgressionRecommendation } from "./ai-service";
import { generateComprehensiveExerciseLibrary } from "./ai-exercise-generator";
import { insertFitnessAssessmentSchema, insertWorkoutSessionSchema, insertWorkoutSetSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const { email, password, ...profileData } = req.body;
      
      const existingUser = await storage.getUserByUsername(email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      const user = await storage.createUser({ username: email, password });
      
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
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Failed to create user" });
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

      const equipmentList = [
        "bodyweight",
        "dumbbells",
        "kettlebell",
        "barbell",
        "bands",
        "rack",
        "cable",
        "pullupbar",
        "medicineball",
        "trx",
        "slamball",
        "sandbag",
        "battleropes",
        "plyobox",
        "rower",
        "assaultbike"
      ];

      console.log("Generating comprehensive exercise library with AI...");
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
        return res.status(400).json({ error: "No exercises in database. Please seed exercises first." });
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
