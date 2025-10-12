// ==========================================
// API ROUTES - Server Endpoints for FitForge
// ==========================================
// This file defines all API endpoints that the frontend can call
// Think of it as the "menu" of actions the app can perform
//
// PRIMARY USER-FACING CATEGORIES:
// 1. Authentication - Login, get user info, update profile
// 2. Onboarding - Complete setup, generate first program
// 3. Programs - Create, retrieve, regenerate workout programs
// 4. Workouts - Get daily workouts, mark complete, track progress
// 5. Exercises - Exercise library, swaps, progressions
// 6. Fitness Tests - Save assessments, track progress
// 7. Calorie Tracking - Calculate and log calories burned
// 8. Settings - Update preferences, nutrition goals, program regeneration
//
// ADDITIONAL ENDPOINTS (Advanced/Admin):
// - Exercise generation (AI-powered exercise library creation)
// - Analytics and reporting
// - Timer utilities for HIIT/interval training
// - Database utilities and admin operations
//
// HOW IT WORKS:
// Frontend calls → API endpoint → Database operation → Response to frontend
// Example: "GET /api/auth/user" → Fetch user from DB → Return user data
//
// AUTHENTICATION:
// Most endpoints require authentication (isAuthenticated middleware)
// This ensures users can only access their own data
//
// NOTE: This is a large file (~2600 lines). Look for section headers (====) to navigate
// ==========================================

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { fitnessAssessments, exercises, programExercises, programWorkouts, workoutSessions, equipment, users, workoutPrograms, workoutSets } from "@shared/schema";
import { eq } from "drizzle-orm";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateWorkoutProgram, suggestExerciseSwap, generateProgressionRecommendation } from "./ai-service";
import { generateComprehensiveExerciseLibrary, generateMasterExerciseDatabase, generateExercisesForEquipment } from "./ai-exercise-generator";
import { insertFitnessAssessmentSchema, insertWorkoutSessionSchema, patchWorkoutSessionSchema, insertWorkoutSetSchema, type FitnessAssessment, type ProgramWorkout, type Exercise } from "@shared/schema";
import { determineIntensityFromProgramType, calculateCaloriesBurned, poundsToKg } from "./calorie-calculator";
import { z } from "zod";
import { calculateAge } from "@shared/utils";
import { parseLocalDate, formatLocalDate, isSameCalendarDay, isBeforeCalendarDay, isAfterCalendarDay } from "@shared/dateUtils";

// Guard against duplicate route registration (prevents errors during hot reload)
let routesRegistered = false;

// ==========================================
// HELPER: Generate Workout Schedule
// ==========================================
// Creates individual workout sessions for the entire program duration
// 
// NEW APPROACH (selectedDates):
// - Accepts selectedDates array (YYYY-MM-DD strings)
// - Creates sessions ONLY for those specific dates
// - Assigns workouts sequentially (workout 1 → date 1, workout 2 → date 2, etc.)
//
// LEGACY APPROACH (dayOfWeek):
// - Loops through all days in the program duration (durationWeeks × 7 days)
// - For each day, checks if there's a matching programWorkout template by dayOfWeek
// - Creates sessions for matching days
//
// INPUT:
//   - programId: Which program these sessions belong to
//   - userId: Who owns these sessions
//   - programWorkouts: Template workouts (indexed or dayOfWeek-based)
//   - durationWeeks: Program duration in weeks (passed explicitly by caller)
//   - startDateString: Start date in YYYY-MM-DD format
//   - selectedDates: (Optional) Array of YYYY-MM-DD strings for NEW approach
//
// OUTPUT: Number of sessions created
//
// IMPORTANT: Cleans up existing future sessions before creating new ones
// This prevents duplicate sessions if user regenerates their program
async function generateWorkoutSchedule(
  programId: string, 
  userId: string, 
  programWorkouts: ProgramWorkout[], 
  durationWeeks: number, 
  startDateString: string,
  selectedDates?: string[]
) {
  try {
    // CRITICAL: Clean up any existing future sessions before creating new ones
    // This prevents duplicate key violations when regenerating programs
    console.log(`[SESSION-CLEANUP] Cleaning up existing sessions from ${startDateString} before creating new ones`);
    const cleanupResult = await storage.cleanupSessionsForRegeneration(userId, startDateString);
    console.log(`[SESSION-CLEANUP] Archived ${cleanupResult.archived} completed sessions, deleted ${cleanupResult.deleted} incomplete sessions`);
    
    const sessions = [];
    
    // ==========================================
    // NEW APPROACH: Use selectedDates (date-based scheduling)
    // ==========================================
    if (selectedDates && selectedDates.length > 0) {
      console.log(`[SESSION-NEW] Creating sessions for ${selectedDates.length} selected dates`);
      
      // Filter workouts to only those with workoutIndex (new approach)
      const indexedWorkouts = programWorkouts.filter(pw => pw.workoutIndex !== null && pw.workoutIndex !== undefined);
      
      // Sort workouts by workoutIndex to ensure correct order
      indexedWorkouts.sort((a, b) => (a.workoutIndex || 0) - (b.workoutIndex || 0));
      
      // Create sessions for each selected date, assigning workouts sequentially
      for (let i = 0; i < selectedDates.length; i++) {
        const scheduledDateString = selectedDates[i];
        const workout = indexedWorkouts[i % indexedWorkouts.length]; // Cycle through workouts if needed
        
        if (workout) {
          const scheduledDate = parseLocalDate(scheduledDateString);
          const calendarDay = scheduledDate.getDay();
          const schemaDayOfWeek = calendarDay === 0 ? 7 : calendarDay;
          
          sessions.push({
            userId,
            programWorkoutId: workout.id,
            workoutName: workout.workoutName,
            scheduledDate: scheduledDateString,
            sessionDayOfWeek: schemaDayOfWeek,
            sessionType: (workout.workoutType ? 'workout' : 'rest') as 'workout' | 'rest',
            workoutType: workout.workoutType as 'strength' | 'cardio' | 'hiit' | 'mobility' | undefined,
            completed: 0,
            status: "scheduled" as const,
          });
        }
      }
      
      console.log(`[SESSION-NEW] Created ${sessions.length} sessions from selectedDates`);
    } 
    // ==========================================
    // LEGACY APPROACH: Use dayOfWeek (week-based scheduling)
    // ==========================================
    else {
      console.log(`[SESSION-LEGACY] Creating sessions using dayOfWeek approach for ${durationWeeks} weeks`);
      
      const today = parseLocalDate(startDateString);
      
      // Create a map of dayOfWeek to programWorkout for quick lookup
      const workoutsByDay = new Map<number, ProgramWorkout>();
      programWorkouts.forEach(pw => {
        if (pw.dayOfWeek !== null && pw.dayOfWeek !== undefined) {
          workoutsByDay.set(pw.dayOfWeek, pw);
        }
      });
      
      // Generate sessions starting from TODAY for the entire duration
      const totalDays = durationWeeks * 7;
      
      for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
        // Use a fresh Date object for each iteration to avoid mutation issues
        const scheduledDate = new Date(today.getTime());
        scheduledDate.setDate(scheduledDate.getDate() + dayOffset);
        
        // Convert Date to YYYY-MM-DD string using shared utility
        const scheduledDateString = formatLocalDate(scheduledDate);
        
        // Get calendar day-of-week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const calendarDay = scheduledDate.getDay();
        
        // Convert to our schema format: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
        // JavaScript: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
        // Schema: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
        const schemaDayOfWeek = calendarDay === 0 ? 7 : calendarDay;
        
        // Find the programWorkout for this day
        const programWorkout = workoutsByDay.get(schemaDayOfWeek);
        
        if (programWorkout) {
          sessions.push({
            userId,
            programWorkoutId: programWorkout.id,
            workoutName: programWorkout.workoutName,
            scheduledDate: scheduledDateString,
            sessionDayOfWeek: schemaDayOfWeek,
            sessionType: (programWorkout.workoutType ? 'workout' : 'rest') as 'workout' | 'rest',
            workoutType: programWorkout.workoutType as 'strength' | 'cardio' | 'hiit' | 'mobility' | undefined,
            completed: 0,
            status: "scheduled" as const,
          });
        }
      }
      
      console.log(`[SESSION-LEGACY] Created ${sessions.length} sessions from dayOfWeek mapping`);
    }
    
    console.log(`Creating ${sessions.length} workout sessions for program ${programId}`);
    
    // OPTIMIZATION: Use batch insert instead of loop for better performance
    await storage.createWorkoutSessionsBatch(sessions);
    
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
  
  // Setup Replit Auth (required for all protected endpoints)
  await setupAuth(app);

  // ==========================================
  // AUTHENTICATION ROUTES
  // ==========================================
  // Endpoints for user authentication and profile management
  
  // GET /api/auth/user - Get current user's profile
  // Returns: User object with all profile data (name, settings, metrics, etc.)
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

  // ==========================================
  // ONBOARDING ROUTES
  // ==========================================
  // Endpoints for new user setup and initial program generation
  
  // POST /api/onboarding-assessment/complete - Complete onboarding with all collected data
  // Receives: User profile, nutrition data, fitness test results (optional)
  // Returns: Success status
  // Side effect: Automatically generates first workout program
  app.post("/api/onboarding-assessment/complete", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { fitnessTest, weightsTest, experienceLevel, startDate, ...profileData} = req.body;
      
      // Convert dateOfBirth string to Date object if present
      if (profileData.dateOfBirth && typeof profileData.dateOfBirth === 'string') {
        profileData.dateOfBirth = new Date(profileData.dateOfBirth);
      }
      
      // Map frontend 'tdee' field to backend 'targetCalories' field
      if (profileData.tdee !== undefined) {
        profileData.targetCalories = profileData.tdee;
        delete profileData.tdee;
      }
      
      // Map experienceLevel to user.fitnessLevel for consistency with AI service
      if (experienceLevel) {
        profileData.fitnessLevel = experienceLevel;
      }
      
      // Update user profile with onboarding data
      if (Object.keys(profileData).length > 0) {
        await storage.updateUser(userId, profileData);
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(500).json({ error: "Failed to retrieve user after profile update" });
      }
      
      // Save fitness assessment (delete any same-day assessments first for idempotency)
      if (fitnessTest || weightsTest) {
        const assessmentData = {
          userId,
          experienceLevel: experienceLevel || profileData.fitnessLevel || "beginner",
          ...fitnessTest,
          ...weightsTest,
        };
        
        // Delete any existing same-day assessments to prevent duplicates on retry
        const existingAssessments = await storage.getUserFitnessAssessments(userId);
        const today = new Date();
        const todayAssessments = existingAssessments.filter(a => {
          const testDate = new Date(a.testDate);
          return testDate.toDateString() === today.toDateString();
        });
        
        // Delete same-day assessments via SQL to ensure idempotency
        if (todayAssessments.length > 0) {
          console.log(`[ONBOARDING] Removing ${todayAssessments.length} existing same-day assessment(s) to prevent duplicates`);
          for (const assessment of todayAssessments) {
            await db.delete(fitnessAssessments).where(eq(fitnessAssessments.id, assessment.id));
          }
        }
        
        await storage.createFitnessAssessment(assessmentData);
      }
      
      // Automatically generate workout program after onboarding
      console.log("[ONBOARDING] Automatically generating workout program after assessment completion");
      
      let latestAssessment = await storage.getCompleteFitnessProfile(userId);
      
      // If no assessment exists (user skipped test), create conservative defaults based on experience level
      if (!latestAssessment) {
        console.log("[ONBOARDING] No fitness assessment found. Using conservative defaults based on experience level:", user.fitnessLevel || "beginner");
        
        const conservativeExperienceLevel = user.fitnessLevel || "beginner";
        const conservativeDefaults: any = {
          userId,
          experienceLevel: conservativeExperienceLevel,
          testDate: new Date(),
        };
        
        // Set conservative bodyweight test defaults based on experience level
        if (conservativeExperienceLevel === "advanced") {
          conservativeDefaults.pushups = 15;
          conservativeDefaults.pullups = 5;
          conservativeDefaults.squats = 30;
          conservativeDefaults.mileTime = 9;
        } else if (conservativeExperienceLevel === "intermediate") {
          conservativeDefaults.pushups = 10;
          conservativeDefaults.pullups = 3;
          conservativeDefaults.squats = 20;
          conservativeDefaults.mileTime = 11;
        } else {
          conservativeDefaults.pushups = 5;
          conservativeDefaults.pullups = 0;
          conservativeDefaults.squats = 10;
          conservativeDefaults.mileTime = 15;
        }
        
        latestAssessment = conservativeDefaults;
      }

      const availableExercises = await storage.getAllExercises();
      if (availableExercises.length === 0) {
        console.error("[ONBOARDING] Master exercise database is empty. Returning success without program generation.");
        return res.json({ success: true });
      }

      // Calculate selectedDates from user.selectedDates if available (NEW approach)
      let selectedDates: string[] | undefined;
      if (user.selectedDates && user.selectedDates.length > 0) {
        selectedDates = user.selectedDates;
        console.log(`[ONBOARDING] Using selectedDates from user profile: ${selectedDates.join(', ')}`);
      } else {
        console.log(`[ONBOARDING] No selectedDates in user profile, using legacy selectedDays approach`);
      }

      console.log("[ONBOARDING] Generating program for user:", userId);
      const generatedProgram = await generateWorkoutProgram({
        user,
        latestAssessment,
        availableExercises,
        selectedDates,  // Pass selectedDates for new approach
      });

      // Archive any existing active programs
      const existingPrograms = await storage.getUserPrograms(userId);
      for (const oldProgram of existingPrograms) {
        if (oldProgram.isActive === 1) {
          await storage.updateWorkoutProgram(oldProgram.id, { isActive: 0 });
        }
      }

      // Save the generated program
      const newProgram = await storage.createWorkoutProgram({
        userId,
        programType: generatedProgram.programType || "AI Generated Program",
        weeklyStructure: generatedProgram.weeklyStructure || "Personalized training program",
        durationWeeks: generatedProgram.durationWeeks || 8,
        isActive: 1,
      });

      console.log("[ONBOARDING] Program generated successfully:", newProgram.id);

      // Save generated workout sessions and keep track of created programWorkouts
      const createdProgramWorkouts = [];
      for (const workout of generatedProgram.workouts) {
        const programWorkout = await storage.createProgramWorkout({
          programId: newProgram.id,
          workoutName: workout.workoutName,
          dayOfWeek: workout.dayOfWeek,           // LEGACY: may be undefined in new mode
          workoutIndex: workout.workoutIndex,     // NEW: sequential index (1, 2, 3, ...)
          workoutType: workout.workoutType || null,
          movementFocus: workout.movementFocus || [],
        });
        
        createdProgramWorkouts.push(programWorkout);

        for (const exercise of workout.exercises) {
          const matchingExercise = availableExercises.find(
            ex => ex.name.toLowerCase() === exercise.exerciseName.toLowerCase()
          );

          await storage.createProgramExercise({
            workoutId: programWorkout.id,
            exerciseId: matchingExercise?.id || null,
            equipment: exercise.equipment || "bodyweight",
            sets: exercise.sets,
            repsMin: exercise.repsMin || null,
            repsMax: exercise.repsMax || null,
            recommendedWeight: exercise.recommendedWeight || null,
            durationSeconds: exercise.durationSeconds || null,
            workSeconds: exercise.workSeconds || null,
            restSeconds: exercise.restSeconds,
            tempo: exercise.tempo || null,
            targetRPE: exercise.targetRPE || null,
            targetRIR: exercise.targetRIR || null,
            notes: exercise.notes || null,
            supersetGroup: exercise.supersetGroup || null,
            supersetOrder: exercise.supersetOrder || null,
            orderIndex: workout.exercises.indexOf(exercise),
          });
        }
      }

      console.log("[ONBOARDING] Workout sessions created, generating scheduled sessions");

      // Track which days have workouts to create rest days for remaining days (LEGACY only)
      const scheduledDays = new Set<number>();
      for (const workout of generatedProgram.workouts) {
        if (workout.dayOfWeek) {  // Only process if using legacy dayOfWeek approach
          scheduledDays.add(workout.dayOfWeek);
        }
      }
      
      // Create rest days for any days not scheduled (LEGACY only - new approach doesn't use rest days)
      if (scheduledDays.size > 0) {  // Only create rest days if using legacy approach
        for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
          if (!scheduledDays.has(dayOfWeek)) {
            const restDay = await storage.createProgramWorkout({
              programId: newProgram.id,
              dayOfWeek,
              workoutName: "Rest Day",
              movementFocus: [],
              workoutType: null,
            });
            createdProgramWorkouts.push(restDay);
          }
        }
      }

      // Generate workout schedule for entire program duration starting from TODAY
      // Use client-provided startDate (user's local timezone) with fallback to server date
      const startDateString = startDate || formatLocalDate(new Date());
      await generateWorkoutSchedule(
        newProgram.id, 
        userId, 
        createdProgramWorkouts, 
        newProgram.durationWeeks || 8, 
        startDateString,
        selectedDates  // Pass selectedDates for new approach
      );

      console.log("[ONBOARDING] Program generation complete");
      
      res.json({ success: true, programGenerated: true });
    } catch (error) {
      console.error("Complete onboarding assessment error:", error);
      res.status(500).json({ error: "Failed to complete onboarding assessment" });
    }
  });

  // Complete onboarding after OIDC login - saves assessment and program data
  app.post("/api/auth/complete-onboarding", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const { fitnessTest, weightsTest, experienceLevel, generatedProgram, startDate, ...profileData } = req.body;
      
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
              tempo: exercise.tempo || null,
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
      // Use provided startDate from frontend, or fallback to server's current date
      const startDateString = startDate || formatLocalDate(new Date());
      await generateWorkoutSchedule(program.id, userId, createdProgramWorkouts, programData.durationWeeks, startDateString);
      
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
      const { fitnessTest, weightsTest, experienceLevel, generatedProgram, startDate, ...profileData } = req.body;
      
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
              tempo: exercise.tempo || null,
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
      // Use provided startDate from frontend, or fallback to server's current date
      const startDateString = startDate || formatLocalDate(new Date());
      await generateWorkoutSchedule(program.id, userId, createdProgramWorkouts, programData.durationWeeks, startDateString);
      
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
      const assessmentId = req.params.id;
      const overrideData = req.body;

      // Verify the assessment belongs to the user
      const assessment = await storage.getFitnessAssessmentById(assessmentId);
      if (!assessment || assessment.userId !== userId) {
        return res.status(404).json({ error: "Assessment not found" });
      }

      // Update the assessment with override data
      const updatedAssessment = await storage.updateFitnessAssessmentOverride(assessmentId, overrideData);
      res.json(updatedAssessment);
    } catch (error) {
      console.error("Override assessment error:", error);
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

  // Admin endpoint to cleanup duplicate workout sessions (for testing environment)
  app.post("/api/admin/cleanup-duplicate-sessions", async (req: Request, res: Response) => {
    try {
      console.log("🔧 ADMIN: Starting duplicate session cleanup...");
      
      // Get all active (non-archived) sessions
      const allSessions = await db.query.workoutSessions.findMany({
        where: (sessions, { eq }) => eq(sessions.isArchived, 0),
        orderBy: (sessions, { desc }) => [desc(sessions.sessionDate)],
      });
      
      console.log(`  Found ${allSessions.length} total active sessions`);
      
      // Group sessions by userId + scheduledDate
      const sessionGroups = new Map<string, any[]>();
      
      for (const session of allSessions) {
        if (!session.scheduledDate) continue; // Skip sessions without scheduled dates
        
        const key = `${session.userId}|${session.scheduledDate}`;
        if (!sessionGroups.has(key)) {
          sessionGroups.set(key, []);
        }
        sessionGroups.get(key)!.push(session);
      }
      
      // Find duplicates (groups with more than one session)
      const duplicateGroups = Array.from(sessionGroups.entries())
        .filter(([_, sessions]) => sessions.length > 1);
      
      console.log(`  Found ${duplicateGroups.length} dates with duplicate sessions`);
      
      let deletedCount = 0;
      
      // For each duplicate group, keep the most recent one, delete the rest
      for (const [key, sessions] of duplicateGroups) {
        // Sort by sessionDate (most recent first)
        sessions.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
        
        const [toKeep, ...toDelete] = sessions;
        
        console.log(`  ${key}: Keeping session ${toKeep.id} (${toKeep.workoutName}), deleting ${toDelete.length} duplicates`);
        
        // Delete all but the first (most recent) session
        for (const session of toDelete) {
          await db.delete(workoutSessions).where(eq(workoutSessions.id, session.id));
          deletedCount++;
        }
      }
      
      console.log(`✅ Cleanup complete: Deleted ${deletedCount} duplicate sessions`);
      
      res.json({
        success: true,
        duplicateGroups: duplicateGroups.length,
        deletedSessions: deletedCount,
        message: `Successfully removed ${deletedCount} duplicate sessions from ${duplicateGroups.length} dates`
      });
    } catch (error) {
      console.error("❌ Duplicate session cleanup error:", error);
      res.status(500).json({ error: `Failed to cleanup duplicate sessions: ${error}` });
    }
  });

  // Admin endpoint to clear all user data (for fresh start with new system)
  // ⚠️ WARNING: This permanently deletes ALL user data
  // ✅ PRESERVES: Exercise database and equipment list (core app functionality)
  // 🔒 PROTECTED: Development mode only + authentication + confirmation key
  // 📝 USAGE: POST /api/admin/clear-all-user-data with body { "confirm": "DELETE_ALL_USER_DATA" }
  app.post("/api/admin/clear-all-user-data", isAuthenticated, async (req: any, res: Response) => {
    try {
      // Security check 1: Only allow in development environment
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ 
          error: "Forbidden",
          message: "This endpoint is only available in development mode"
        });
      }

      // Security check 2: Require explicit confirmation to prevent accidental deletion
      const { confirm } = req.body;
      if (confirm !== "DELETE_ALL_USER_DATA") {
        return res.status(400).json({ 
          error: "Missing or invalid confirmation key",
          message: "To proceed, send request with body: { \"confirm\": \"DELETE_ALL_USER_DATA\" }"
        });
      }

      const userId = req.user?.claims?.sub;
      console.log(`🔧 ADMIN: User ${userId} initiated complete user data wipe`);
      console.log("⚠️  This will delete ALL users, programs, sessions, and assessments");
      console.log("✅ Preserving: Exercise database and equipment list");
      
      // Track what gets deleted
      const deletionStats = {
        workoutSets: 0,
        workoutSessions: 0,
        programExercises: 0,
        programWorkouts: 0,
        workoutPrograms: 0,
        fitnessAssessments: 0,
        users: 0,
      };

      // STEP 1: Delete workout_sets (child of workout_sessions)
      console.log("  [1/7] Deleting workout sets...");
      const sets = await db.select().from(workoutSets);
      deletionStats.workoutSets = sets.length;
      if (sets.length > 0) {
        await db.delete(workoutSets);
      }
      console.log(`    ✓ Deleted ${deletionStats.workoutSets} workout sets`);

      // STEP 2: Delete workout_sessions (child of users and program_workouts)
      console.log("  [2/7] Deleting workout sessions...");
      const sessions = await db.select().from(workoutSessions);
      deletionStats.workoutSessions = sessions.length;
      if (sessions.length > 0) {
        await db.delete(workoutSessions);
      }
      console.log(`    ✓ Deleted ${deletionStats.workoutSessions} workout sessions`);

      // STEP 3: Delete program_exercises (child of program_workouts)
      console.log("  [3/7] Deleting program exercises...");
      const programExs = await db.select().from(programExercises);
      deletionStats.programExercises = programExs.length;
      if (programExs.length > 0) {
        await db.delete(programExercises);
      }
      console.log(`    ✓ Deleted ${deletionStats.programExercises} program exercises`);

      // STEP 4: Delete program_workouts (child of workout_programs)
      console.log("  [4/7] Deleting program workouts...");
      const programWos = await db.select().from(programWorkouts);
      deletionStats.programWorkouts = programWos.length;
      if (programWos.length > 0) {
        await db.delete(programWorkouts);
      }
      console.log(`    ✓ Deleted ${deletionStats.programWorkouts} program workouts`);

      // STEP 5: Delete workout_programs (child of users)
      console.log("  [5/7] Deleting workout programs...");
      const programs = await db.select().from(workoutPrograms);
      deletionStats.workoutPrograms = programs.length;
      if (programs.length > 0) {
        await db.delete(workoutPrograms);
      }
      console.log(`    ✓ Deleted ${deletionStats.workoutPrograms} workout programs`);

      // STEP 6: Delete fitness_assessments (child of users)
      console.log("  [6/7] Deleting fitness assessments...");
      const assessments = await db.select().from(fitnessAssessments);
      deletionStats.fitnessAssessments = assessments.length;
      if (assessments.length > 0) {
        await db.delete(fitnessAssessments);
      }
      console.log(`    ✓ Deleted ${deletionStats.fitnessAssessments} fitness assessments`);

      // STEP 7: Delete users (parent table)
      console.log("  [7/7] Deleting users...");
      const allUsers = await db.select().from(users);
      deletionStats.users = allUsers.length;
      if (allUsers.length > 0) {
        await db.delete(users);
      }
      console.log(`    ✓ Deleted ${deletionStats.users} users`);

      // Verify core data is preserved
      const exerciseCount = await db.select().from(exercises);
      const equipmentCount = await db.select().from(equipment);
      
      console.log("\n✅ User data wipe complete!");
      console.log(`✅ Preserved: ${exerciseCount.length} exercises, ${equipmentCount.length} equipment types`);
      console.log("📊 Deletion Summary:");
      console.log(`   - Users: ${deletionStats.users}`);
      console.log(`   - Programs: ${deletionStats.workoutPrograms}`);
      console.log(`   - Sessions: ${deletionStats.workoutSessions}`);
      console.log(`   - Sets: ${deletionStats.workoutSets}`);
      console.log(`   - Assessments: ${deletionStats.fitnessAssessments}`);
      console.log(`   - Total deleted: ${Object.values(deletionStats).reduce((a, b) => a + b, 0)} records`);

      res.json({
        success: true,
        deleted: deletionStats,
        preserved: {
          exercises: exerciseCount.length,
          equipment: equipmentCount.length,
        },
        message: "All user data successfully deleted. Exercise database and equipment preserved.",
      });
    } catch (error) {
      console.error("❌ User data wipe error:", error);
      res.status(500).json({ error: `Failed to clear user data: ${error}` });
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

  // Get all equipment from reference table (auto-populated from exercises database)
  app.get("/api/equipment", async (req: Request, res: Response) => {
    try {
      const allEquipment = await db
        .select()
        .from(equipment)
        .orderBy(equipment.displayOrder);
      res.json(allEquipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ error: "Failed to fetch equipment" });
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
      const { startDate } = req.body;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Validate days per week (only 3, 4, or 5 days supported for proper week-level programming)
      if (user.daysPerWeek && ![3, 4, 5].includes(user.daysPerWeek)) {
        return res.status(400).json({ 
          error: "Invalid daysPerWeek. Only 3, 4, or 5 days per week are supported." 
        });
      }

      let latestAssessment = await storage.getCompleteFitnessProfile(userId);
      
      // If no assessment exists (user skipped test), create conservative defaults based on experience level
      if (!latestAssessment) {
        console.log("[PROGRAM] No fitness assessment found. Using conservative defaults based on experience level:", user.fitnessLevel || "beginner");
        
        // Create a conservative default assessment based on user's experience level
        const experienceLevel = user.fitnessLevel || "beginner";
        const conservativeDefaults: any = {
          userId,
          experienceLevel,
          testDate: new Date(),
        };
        
        // Set conservative bodyweight test defaults based on experience level
        if (experienceLevel === "advanced") {
          conservativeDefaults.pushups = 15;
          conservativeDefaults.pullups = 5;
          conservativeDefaults.squats = 30;
          conservativeDefaults.mileTime = 9;
        } else if (experienceLevel === "intermediate") {
          conservativeDefaults.pushups = 10;
          conservativeDefaults.pullups = 3;
          conservativeDefaults.squats = 20;
          conservativeDefaults.mileTime = 11;
        } else {
          conservativeDefaults.pushups = 5;
          conservativeDefaults.pullups = 0;
          conservativeDefaults.squats = 10;
          conservativeDefaults.mileTime = 15;
        }
        
        latestAssessment = conservativeDefaults;
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

      // Calculate selectedDates from user.selectedDates if available (NEW approach)
      // This provides specific YYYY-MM-DD dates for the next N workouts
      let selectedDates: string[] | undefined;
      if (user.selectedDates && user.selectedDates.length > 0) {
        selectedDates = user.selectedDates;
        console.log(`[PROGRAM] Using selectedDates from user profile: ${selectedDates.join(', ')}`);
      } else {
        console.log(`[PROGRAM] No selectedDates in user profile, using legacy selectedDays approach`);
      }

      console.log("[TEMPLATE] Starting program generation with nutrition goal:", user.nutritionGoal);
      const generatedProgram = await generateWorkoutProgram({
        user,
        latestAssessment,
        availableExercises,
        selectedDates,  // Pass selectedDates to new approach
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
        // Track dayOfWeek for legacy rest day creation (if present)
        if (workout.dayOfWeek) {
          scheduledDays.add(workout.dayOfWeek);
        }
        
        const programWorkout = await storage.createProgramWorkout({
          programId: program.id,
          dayOfWeek: workout.dayOfWeek,         // LEGACY: may be undefined in new mode
          workoutIndex: workout.workoutIndex,   // NEW: sequential index (1, 2, 3, ...)
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
              tempo: exercise.tempo || null,
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

      // Clean up sessions from TODAY onwards only (never touch historical sessions)
      // Always use server's current date for cleanup, regardless of requested program start date
      const todayString = formatLocalDate(new Date());
      const { archived, deleted } = await storage.cleanupSessionsForRegeneration(userId, todayString);
      console.log(`[GENERATE] Archived ${archived} completed sessions, deleted ${deleted} incomplete sessions from ${todayString} onwards`);

      // Generate workout schedule starting from client-requested date
      const startDateString = startDate || todayString;
      await generateWorkoutSchedule(
        program.id, 
        userId, 
        createdProgramWorkouts, 
        generatedProgram.durationWeeks, 
        startDateString,
        selectedDates  // Pass selectedDates for new approach
      );

      // Remove any duplicate sessions that may have been created
      const duplicatesRemoved = await storage.removeDuplicateSessions(userId);
      if (duplicatesRemoved > 0) {
        console.log(`[GENERATE] Removed ${duplicatesRemoved} duplicate session(s) after schedule generation`);
      }

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
      const { startDate, selectedDates } = req.body;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let latestAssessment = await storage.getCompleteFitnessProfile(userId);
      
      // If no assessment exists (user skipped test), create conservative defaults based on experience level
      if (!latestAssessment) {
        console.log("[PROGRAM] No fitness assessment found. Using conservative defaults based on experience level:", user.fitnessLevel || "beginner");
        
        // Create a conservative default assessment based on user's experience level
        const experienceLevel = user.fitnessLevel || "beginner";
        const conservativeDefaults: any = {
          userId,
          experienceLevel,
          testDate: new Date(),
        };
        
        // Set conservative bodyweight test defaults based on experience level
        if (experienceLevel === "advanced") {
          conservativeDefaults.pushups = 15;
          conservativeDefaults.pullups = 5;
          conservativeDefaults.squats = 30;
          conservativeDefaults.mileTime = 9;
        } else if (experienceLevel === "intermediate") {
          conservativeDefaults.pushups = 10;
          conservativeDefaults.pullups = 3;
          conservativeDefaults.squats = 20;
          conservativeDefaults.mileTime = 11;
        } else {
          conservativeDefaults.pushups = 5;
          conservativeDefaults.pullups = 0;
          conservativeDefaults.squats = 10;
          conservativeDefaults.mileTime = 15;
        }
        
        latestAssessment = conservativeDefaults;
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
        // Track dayOfWeek for legacy rest day creation (if present)
        if (workout.dayOfWeek) {
          scheduledDays.add(workout.dayOfWeek);
        }
        
        const programWorkout = await storage.createProgramWorkout({
          programId: program.id,
          dayOfWeek: workout.dayOfWeek,         // LEGACY: may be undefined in new mode
          workoutIndex: workout.workoutIndex,   // NEW: sequential index (1, 2, 3, ...)
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
              tempo: exercise.tempo || null,
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

      // Save selectedDates to user profile if provided (for new 7-day cycle system)
      if (selectedDates && Array.isArray(selectedDates) && selectedDates.length > 0) {
        await storage.updateUser(userId, { selectedDates });
        console.log(`[REGENERATE] Saved selectedDates for new 7-day cycle:`, selectedDates);
      }

      // Clean up sessions from TODAY onwards only (never touch historical sessions)
      // Always use server's current date for cleanup, regardless of requested program start date
      const todayString = formatLocalDate(new Date());
      const { archived, deleted } = await storage.cleanupSessionsForRegeneration(userId, todayString);
      console.log(`[REGENERATE] Archived ${archived} completed sessions, deleted ${deleted} incomplete sessions from ${todayString} onwards`);

      // Generate workout schedule starting from client-requested date
      const startDateString = startDate || todayString;
      await generateWorkoutSchedule(
        program.id, 
        userId, 
        createdProgramWorkouts, 
        generatedProgram.durationWeeks, 
        startDateString,
        selectedDates  // Pass selectedDates for new approach
      );

      // Remove any duplicate sessions that may have been created
      const duplicatesRemoved = await storage.removeDuplicateSessions(userId);
      if (duplicatesRemoved > 0) {
        console.log(`[REGENERATE] Removed ${duplicatesRemoved} duplicate session(s) after schedule generation`);
      }

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

      // Validate days per week (only 3, 4, or 5 days supported for proper week-level programming)
      if (daysPerWeek && ![3, 4, 5].includes(daysPerWeek)) {
        return res.status(400).json({ 
          error: "Invalid daysPerWeek. Only 3, 4, or 5 days per week are supported." 
        });
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

  app.get("/api/home-data", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      // Remove any duplicate sessions before loading data (safety net)
      const duplicatesRemoved = await storage.removeDuplicateSessions(userId);
      if (duplicatesRemoved > 0) {
        console.log(`[HOME-DATA] Removed ${duplicatesRemoved} duplicate session(s) during home data load`);
      }

      // Fetch all home page data in parallel for optimal performance
      const [user, activeProgram, sessions, fitnessAssessments] = await Promise.all([
        storage.getUser(userId),
        storage.getUserActiveProgram(userId),
        storage.getUserSessions(userId),
        storage.getUserFitnessAssessments(userId),
      ]);

      res.json({
        user: user || null,
        activeProgram: activeProgram || null,
        sessions: sessions || [],
        fitnessAssessments: fitnessAssessments || [],
      });
    } catch (error) {
      console.error("Home data fetch error:", error);
      res.status(500).json({ error: "Failed to fetch home page data" });
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

  // ==========================================
  // ENDPOINT: Check 7-Day Cycle Completion
  // ==========================================
  // Detects when all workouts in the current 7-day cycle are complete
  // Used to trigger cycle completion prompt with options to repeat or create new program
  //
  // LOGIC:
  // 1. Get user's selectedDates array (current cycle's scheduled dates)
  // 2. Find all workout sessions scheduled on those dates
  // 3. Check if ALL are completed (excluding rest days/cardio-only days)
  // 4. Return shouldPrompt: true if cycle is complete
  //
  // RESPONSE:
  // {
  //   shouldPrompt: boolean,
  //   cycleNumber: number,
  //   completedWorkouts: number,
  //   totalCycleWorkouts: number,
  //   selectedDates: string[]
  // }
  app.get("/api/cycles/completion-check", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      // Get user data to access selectedDates (current cycle)
      const user = await storage.getUser(userId);
      if (!user) {
        return res.json({ shouldPrompt: false, reason: "no_user" });
      }

      // Check if user has selectedDates (new cycle system)
      if (!user.selectedDates || user.selectedDates.length === 0) {
        return res.json({ shouldPrompt: false, reason: "no_cycle_dates" });
      }

      // Get all user sessions
      const allSessions = await storage.getUserSessions(userId);

      // Filter to sessions scheduled on current cycle dates (non-archived)
      const cycleSessions = allSessions.filter(s => 
        user.selectedDates?.includes(s.scheduledDate || '') && 
        s.isArchived === 0
      );

      // Get only workout sessions (exclude rest days)
      const workoutSessions = cycleSessions.filter(s => s.sessionType === "workout");
      
      // Count completed workout sessions
      const completedWorkouts = workoutSessions.filter(s => s.completed === 1);

      // Cycle is complete when ALL workout sessions are completed
      const isCycleComplete = workoutSessions.length > 0 && completedWorkouts.length === workoutSessions.length;

      res.json({
        shouldPrompt: isCycleComplete,
        cycleNumber: user.cycleNumber || 1,
        completedWorkouts: completedWorkouts.length,
        totalCycleWorkouts: workoutSessions.length,
        selectedDates: user.selectedDates,
        reason: isCycleComplete ? "cycle_complete" : "not_yet"
      });
    } catch (error) {
      console.error("Cycle completion check error:", error);
      res.status(500).json({ error: "Failed to check cycle completion" });
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

      if (program.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to access this program" });
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

      // Verify ownership: exercise -> workout -> program -> userId
      const workout = await storage.getProgramWorkout(exercise.workoutId);
      if (!workout) {
        return res.status(404).json({ error: "Workout not found" });
      }

      const program = await storage.getWorkoutProgram(workout.programId);
      if (!program || program.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this exercise" });
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

      // Verify ownership: exercise -> workout -> program -> userId
      const workout = await storage.getProgramWorkout(programExercise.workoutId);
      if (!workout) {
        return res.status(404).json({ error: "Workout not found" });
      }

      const program = await storage.getWorkoutProgram(workout.programId);
      if (!program || program.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to swap this exercise" });
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

      // Use currentDate from frontend if provided, otherwise use server's date as fallback
      const currentDateString = req.body.currentDate || formatLocalDate(new Date());
      const today = parseLocalDate(currentDateString);
      
      // Calculate current day of week in ISO format (1=Monday, 7=Sunday)
      const dayOfWeek = today.getDay();
      const sessionDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

      const validatedData = insertWorkoutSessionSchema.parse({
        ...req.body,
        userId,
        sessionDayOfWeek,
        scheduledDate: req.body.scheduledDate || currentDateString,
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
            const dateA = parseLocalDate(a.scheduledDate).getTime();
            const dateB = parseLocalDate(b.scheduledDate).getTime();
            return dateA - dateB; // Ascending order - earliest first
          });
        
        const existingScheduledSession = incompleteSessions[0];

        // If we found a pre-scheduled session, update it instead of creating new
        if (existingScheduledSession) {
          // Don't update scheduledDate - keep the original scheduled date
          // Only update status, completed, session metadata
          const { scheduledDate, ...updateData } = validatedData;
          
          const updatedSession = await storage.updateWorkoutSession(existingScheduledSession.id, {
            ...updateData,
            // sessionDate now comes from client (user's local time)
          });
          
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

  // Convert rest day session to cardio session with user-selected type
  app.post("/api/programs/sessions/cardio/:date", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const scheduledDate = req.params.date;
      const cardioType = req.body?.cardioType || 'zone-2'; // Default to zone-2 if not specified

      if (!scheduledDate) {
        return res.status(400).json({ error: "date parameter is required" });
      }

      // Get user's active program
      const activeProgram = await storage.getUserActiveProgram(userId);
      if (!activeProgram) {
        return res.status(404).json({ error: "No active program found" });
      }

      // Parse the scheduled date
      const sessionScheduledDate = parseLocalDate(scheduledDate);

      // Find the existing session on this date (exclude archived and skipped sessions)
      const existingSessions = await storage.getUserSessions(userId);
      const sessionsOnDate = existingSessions.filter((s: any) => {
        if (!s.scheduledDate || s.status === 'archived' || s.status === 'skipped') return false;
        const existingDate = parseLocalDate(s.scheduledDate);
        return formatLocalDate(existingDate) === formatLocalDate(sessionScheduledDate);
      });

      console.log('[CARDIO] Date:', scheduledDate, 'Type:', cardioType, 'Sessions found for this date:', sessionsOnDate.length, sessionsOnDate.map((s: any) => ({ id: s.id, type: s.sessionType, name: s.workoutName })));
      
      // Filter to only REST sessions (sessionType === 'rest')
      const restSessions = sessionsOnDate.filter((s: any) => s.sessionType === 'rest');
      
      if (restSessions.length === 0) {
        // No rest sessions found - this date might already have cardio or a workout
        if (sessionsOnDate.length > 0) {
          console.log('[CARDIO] No rest sessions found, but found workout sessions');
          return res.status(400).json({ error: "This is already a workout day. You can only add cardio to rest days." });
        }
        console.log('[CARDIO] No sessions found for this date');
        return res.status(404).json({ error: "No session found for this date" });
      }
      
      // Select the rest session to convert (most recent one)
      const sessionToConvert = restSessions[0];
      
      // Delete ALL other sessions for this date except the one we're converting
      // This ensures only one session exists per date (enforced by unique constraint)
      const duplicatesToDelete = sessionsOnDate.filter((s: any) => s.id !== sessionToConvert.id);
      if (duplicatesToDelete.length > 0) {
        console.warn(`[CARDIO] Cleaning up ${duplicatesToDelete.length} duplicate sessions for date ${scheduledDate}. IDs:`, duplicatesToDelete.map((s: any) => s.id));
        for (const session of duplicatesToDelete) {
          await db.delete(workoutSessions).where(eq(workoutSessions.id, session.id));
        }
        console.log(`[CARDIO] Successfully deleted ${duplicatesToDelete.length} duplicate sessions`);
      }

      // Configure cardio based on selected type
      let workoutName: string;
      let duration: number;
      let notes: string;

      switch (cardioType) {
        case 'hiit':
          workoutName = 'HIIT Cardio';
          duration = 8; // 5-10 minutes
          notes = 'High-intensity interval training. Alternate between max effort and recovery periods for cardiovascular improvement and calorie burn.';
          break;
        case 'steady-state':
          workoutName = 'Steady State Cardio';
          duration = 12; // 10-15 minutes
          notes = 'Moderate continuous cardio. Maintain a steady, sustainable pace for endurance and heart health.';
          break;
        case 'zone-2':
        default:
          workoutName = 'Zone 2 Cardio';
          duration = 18; // 15-20 minutes
          notes = 'Low-intensity aerobic work. Target: Zone 2 heart rate (60-70% max HR) for fat burning and recovery.';
          break;
      }

      // Get user data for exercise selection
      const user = await storage.getUser(userId);
      const latestAssessment = await storage.getLatestFitnessAssessment(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const fitnessLevel = latestAssessment?.experienceLevel || user.fitnessLevel || 'beginner';
      
      // Fetch cardio exercises from database
      const allExercises = await db.select().from(exercises);
      const cardioExercises = allExercises.filter(ex => 
        ex.movementPattern === "cardio" &&
        ex.equipment?.some(eq => user.equipment?.includes(eq) || eq === "bodyweight")
      );

      // Filter by cardio type
      let selectedExercise: any;
      if (cardioType === 'hiit') {
        // HIIT: prefer exercises with duration tracking (intervals)
        selectedExercise = cardioExercises.find(ex => 
          ex.trackingType === "duration" || 
          ex.name.toLowerCase().includes("hiit") ||
          ex.name.toLowerCase().includes("sprint")
        ) || cardioExercises[0];
      } else if (cardioType === 'steady-state') {
        // Steady-state: prefer jogging, rowing, cycling
        selectedExercise = cardioExercises.find(ex =>
          ex.name.toLowerCase().includes("jog") ||
          ex.name.toLowerCase().includes("row") ||
          ex.name.toLowerCase().includes("cycle")
        ) || cardioExercises[0];
      } else {
        // Zone 2: prefer low-intensity options
        selectedExercise = cardioExercises.find(ex =>
          ex.name.toLowerCase().includes("walk") ||
          ex.name.toLowerCase().includes("zone")
        ) || cardioExercises[0];
      }

      // Create a programWorkout for this cardio session
      const programWorkout = await db.insert(programWorkouts).values({
        programId: activeProgram.id,
        dayOfWeek: new Date(scheduledDate).getDay() || 7,
        workoutName,
        movementFocus: ['cardio'],
        workoutType: 'cardio'
      }).returning();

      if (!programWorkout[0]) {
        return res.status(500).json({ error: "Failed to create program workout" });
      }

      // Create exercise parameters and link to programWorkout
      if (selectedExercise) {
        let sets, workSeconds, restSeconds, durationSeconds;
        
        if (cardioType === 'hiit' && selectedExercise.trackingType === 'duration') {
          // HIIT intervals
          workSeconds = fitnessLevel === 'beginner' ? 20 : fitnessLevel === 'intermediate' ? 30 : 40;
          restSeconds = fitnessLevel === 'beginner' ? 40 : fitnessLevel === 'intermediate' ? 30 : 20;
          const intervalDuration = workSeconds + restSeconds;
          sets = Math.floor((duration * 60) / intervalDuration);
          durationSeconds = workSeconds;
        } else {
          // Continuous cardio
          sets = 1;
          durationSeconds = duration * 60;
          restSeconds = 0;
        }

        // Create program exercise linked to the programWorkout
        await db.insert(programExercises).values({
          workoutId: programWorkout[0].id,
          exerciseId: selectedExercise.id,
          sets,
          durationSeconds,
          workSeconds: cardioType === 'hiit' ? workSeconds : undefined,
          restSeconds,
          orderIndex: 1,
          equipment: selectedExercise.equipment[0] || 'bodyweight'
        });

        console.log('[CARDIO] Created cardio exercise:', { 
          name: selectedExercise.name, 
          type: cardioType, 
          sets, 
          duration: cardioType === 'hiit' ? `${sets} x ${workSeconds}s work / ${restSeconds}s rest` : `${duration} min`
        });
      }

      // Update the session to link to the programWorkout
      console.log('[CARDIO] About to update session with:', { sessionType: "workout", workoutType: "cardio", workoutName, notes, status: "scheduled", programWorkoutId: programWorkout[0].id });
      
      const updatedSession = await storage.updateWorkoutSession(sessionToConvert.id, {
        sessionType: "workout",
        workoutType: "cardio",
        workoutName,
        notes,
        status: "scheduled",
        programWorkoutId: programWorkout[0].id
      });

      if (!updatedSession) {
        return res.status(500).json({ error: "Failed to update session to cardio" });
      }

      console.log('[CARDIO] Successfully converted rest session to', cardioType, 'cardio. Updated session:', { id: updatedSession.id, workoutName: updatedSession.workoutName, workoutType: updatedSession.workoutType });
      res.json(updatedSession);
    } catch (error) {
      console.error("Convert to cardio session error:", error);
      res.status(500).json({ error: "Failed to convert to cardio session" });
    }
  });

  app.post("/api/workout-sessions/archive-old", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      // Use currentDate from frontend if provided, otherwise use server's date as fallback
      const currentDateString = req.body.currentDate || formatLocalDate(new Date());
      const today = parseLocalDate(currentDateString);

      // Get all sessions for this user
      const allSessions = await storage.getUserSessions(userId);

      // Archive any completed or skipped sessions from previous dates
      const sessionsToArchive = allSessions.filter((session: any) => {
        if (!session.scheduledDate) return false;
        if (session.status === 'archived') return false; // Already archived
        
        const sessionDate = parseLocalDate(session.scheduledDate);
        
        // Archive if:
        // 1. Session is from a previous date (by calendar date) AND
        // 2. Session is completed (completed=1) OR skipped (status='skipped')
        if (isBeforeCalendarDay(sessionDate, today)) {
          return session.completed === 1 || session.status === 'skipped';
        }
        return false;
      });

      // Archive each session
      const archivedCount = await Promise.all(
        sessionsToArchive.map((session: any) =>
          storage.updateWorkoutSession(session.id, { status: 'archived' })
        )
      );

      console.log(`[ARCHIVE] Archived ${archivedCount.length} old sessions for user ${userId}`);
      
      res.json({ 
        archivedCount: archivedCount.length,
        message: `Archived ${archivedCount.length} old sessions`
      });
    } catch (error) {
      console.error("Archive old sessions error:", error);
      res.status(500).json({ error: "Failed to archive old sessions" });
    }
  });

  // Get missed workouts - detects pending workouts from past dates
  app.get("/api/workout-sessions/missed", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const currentDateString = req.query.currentDate || formatLocalDate(new Date());
      const today = parseLocalDate(currentDateString);

      // Get all sessions for this user
      const allSessions = await storage.getUserSessions(userId);

      // Find missed workouts: scheduled before today, still pending, not archived
      const missedWorkouts = allSessions.filter((session: any) => {
        if (!session.scheduledDate) return false;
        if (session.status === 'archived') return false;
        if (session.completed === 1 || session.status === 'skipped') return false;
        
        const sessionDate = parseLocalDate(session.scheduledDate);
        return isBeforeCalendarDay(sessionDate, today);
      });

      console.log(`[MISSED] Found ${missedWorkouts.length} missed workouts for user ${userId}`);
      res.json({ 
        missedWorkouts,
        count: missedWorkouts.length 
      });
    } catch (error) {
      console.error("Get missed workouts error:", error);
      res.status(500).json({ error: "Failed to get missed workouts" });
    }
  });

  // Reset program from today - reschedule all pending workouts starting from today
  app.post("/api/workout-sessions/reset-from-today", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const currentDateString = req.body.currentDate || formatLocalDate(new Date());
      const today = parseLocalDate(currentDateString);

      // STEP 1: Mark old missed sessions as skipped FIRST
      // This ensures they won't be included in the pending workouts snapshot
      const allSessions = await storage.getUserSessions(userId);
      const missedWorkouts = allSessions.filter((session: any) => {
        if (!session.scheduledDate) return false;
        if (session.status === 'archived') return false;
        if (session.completed === 1 || session.status === 'skipped') return false;
        const sessionDate = parseLocalDate(session.scheduledDate);
        return isBeforeCalendarDay(sessionDate, today);
      });
      
      if (missedWorkouts.length > 0) {
        await Promise.all(
          missedWorkouts.map((workout: any) => 
            storage.updateWorkoutSession(workout.id, { status: 'skipped' })
          )
        );
        console.log(`[RESET] Marked ${missedWorkouts.length} old missed workout(s) as skipped`);
      }

      // STEP 2: Snapshot all pending (incomplete) sessions AFTER skipping missed ones
      const updatedSessions = await storage.getUserSessions(userId);
      const pendingWorkouts = updatedSessions
        .filter((session: any) => {
          if (session.status === 'archived') return false;
          if (session.completed === 1 || session.status === 'skipped') return false;
          return true;
        })
        .sort((a: any, b: any) => {
          const dateA = parseLocalDate(a.scheduledDate);
          const dateB = parseLocalDate(b.scheduledDate);
          return dateA.getTime() - dateB.getTime();
        });
      
      // DEDUPLICATE: Remove sessions with same programWorkoutId AND same scheduledDate
      // Keeps multi-week schedule intact (same programWorkoutId can appear on different dates)
      // This prevents bug where clicking reset multiple times creates duplicates on same date
      const seenWorkoutDatePairs = new Set<string>();
      const uniquePendingWorkouts = pendingWorkouts.filter((session: any) => {
        const key = `${session.programWorkoutId || 'manual'}_${session.scheduledDate}`;
        if (seenWorkoutDatePairs.has(key)) {
          return false; // Skip if same workout on same date already exists
        }
        seenWorkoutDatePairs.add(key);
        return true;
      });

      if (uniquePendingWorkouts.length === 0) {
        return res.json({ message: "No pending workouts to reschedule", rescheduledCount: 0 });
      }

      // STEP 3: Clean up sessions from today onwards to prevent duplicates
      // This archives completed sessions and deletes incomplete ones
      await storage.cleanupSessionsForRegeneration(userId, currentDateString);

      // STEP 4: Recreate sessions starting from today using the snapshot
      let dayOffset = 0;
      const createdSessions = [];
      
      for (const workout of uniquePendingWorkouts) {
        const newScheduledDate = new Date(today);
        newScheduledDate.setDate(today.getDate() + dayOffset);
        const newScheduledDateString = formatLocalDate(newScheduledDate);
        
        // Calculate the calendar day-of-week to match the new date
        const calendarDay = newScheduledDate.getDay();
        const schemaDayOfWeek = calendarDay === 0 ? 7 : calendarDay;
        
        // Create a new session with the rescheduled date
        const newSession = await storage.createWorkoutSession({
          userId: workout.userId,
          programWorkoutId: workout.programWorkoutId,
          workoutName: workout.workoutName,
          workoutType: workout.workoutType as 'strength' | 'cardio' | 'hiit' | 'mobility' | undefined,
          scheduledDate: newScheduledDateString,
          sessionDayOfWeek: schemaDayOfWeek,
          sessionType: (workout.sessionType === 'rest' ? 'rest' : 'workout') as 'workout' | 'rest',
          status: 'scheduled',
          completed: 0,
          isArchived: 0
        });
        createdSessions.push(newSession);
        
        dayOffset++;
      }

      console.log(`[RESET] Rescheduled ${uniquePendingWorkouts.length} unique workouts starting from ${currentDateString}`);
      res.json({ 
        message: `Rescheduled ${uniquePendingWorkouts.length} workouts`,
        rescheduledCount: uniquePendingWorkouts.length 
      });
    } catch (error) {
      console.error("Reset from today error:", error);
      res.status(500).json({ error: "Failed to reset program" });
    }
  });

  // Skip missed workouts - mark all missed sessions as skipped
  app.post("/api/workout-sessions/skip-missed", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      const currentDateString = req.body.currentDate || formatLocalDate(new Date());
      const today = parseLocalDate(currentDateString);

      // Get all sessions for this user
      const allSessions = await storage.getUserSessions(userId);

      // Find missed workouts: scheduled before today, still pending, not archived
      const missedWorkouts = allSessions.filter((session: any) => {
        if (!session.scheduledDate) return false;
        if (session.status === 'archived') return false;
        if (session.completed === 1 || session.status === 'skipped') return false;
        
        const sessionDate = parseLocalDate(session.scheduledDate);
        return isBeforeCalendarDay(sessionDate, today);
      });

      if (missedWorkouts.length === 0) {
        return res.json({ message: "No missed workouts to skip", skippedCount: 0 });
      }

      // Mark all missed workouts as skipped
      const updates = missedWorkouts.map((workout: any) => 
        storage.updateWorkoutSession(workout.id, {
          status: 'skipped'
        })
      );

      await Promise.all(updates);

      console.log(`[SKIP] Marked ${missedWorkouts.length} missed workouts as skipped for user ${userId}`);
      res.json({ 
        message: `Skipped ${missedWorkouts.length} missed workouts`,
        skippedCount: missedWorkouts.length 
      });
    } catch (error) {
      console.error("Skip missed workouts error:", error);
      res.status(500).json({ error: "Failed to skip missed workouts" });
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

      // Verify ownership
      if (oldSession.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this session" });
      }

      // Validate and transform the patch data (converts boolean completed to integer)
      const validatedData = patchWorkoutSessionSchema.parse(req.body);

      // Do NOT auto-archive - sessions stay visible with their status until date changes
      // Archival happens automatically when viewing home page on a new day

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

      res.json(session);
    } catch (error) {
      console.error("Patch session error:", error);
      res.status(500).json({ error: "Failed to update session" });
    }
  });

  app.get("/api/workout-sessions/paginated", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;
      
      const limit = parseInt(req.query.limit as string) || 30;
      const offset = parseInt(req.query.offset as string) || 0;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const result = await storage.getUserSessionsPaginated(userId, limit, offset, startDate, endDate);
      res.json(result);
    } catch (error) {
      console.error("Paginated sessions error:", error);
      res.status(500).json({ error: "Failed to fetch paginated sessions" });
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

      // Use date from query parameter if provided, otherwise use server's date as fallback
      const currentDateString = (req.query.date as string) || formatLocalDate(new Date());
      const today = parseLocalDate(currentDateString);
      
      // Calculate tomorrow for date range
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

      // First get the set to verify ownership
      const existingSet = await storage.getWorkoutSet(req.params.setId);
      if (!existingSet) {
        return res.status(404).json({ error: "Set not found" });
      }

      // Verify ownership: set -> session -> userId
      const session = await storage.getWorkoutSession(existingSet.sessionId);
      if (!session || session.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this set" });
      }

      const set = await storage.updateWorkoutSet(req.params.setId, req.body);
      res.json(set);
    } catch (error) {
      res.status(500).json({ error: "Failed to update set" });
    }
  });

  app.get("/api/workout-sessions/:sessionId/sets", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user.claims.sub;

      // Verify ownership: session -> userId
      const session = await storage.getWorkoutSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to access this session's sets" });
      }

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
            horizontal_push: fitnessLevel as 'beginner' | 'intermediate' | 'advanced', 
            vertical_push: fitnessLevel as 'beginner' | 'intermediate' | 'advanced', 
            pull: fitnessLevel as 'beginner' | 'intermediate' | 'advanced', 
            squat: fitnessLevel as 'beginner' | 'intermediate' | 'advanced', 
            lunge: fitnessLevel as 'beginner' | 'intermediate' | 'advanced', 
            hinge: fitnessLevel as 'beginner' | 'intermediate' | 'advanced', 
            core: fitnessLevel as 'beginner' | 'intermediate' | 'advanced', 
            carry: fitnessLevel as 'beginner' | 'intermediate' | 'advanced', 
            cardio: fitnessLevel as 'beginner' | 'intermediate' | 'advanced', 
            rotation: fitnessLevel as 'beginner' | 'intermediate' | 'advanced' 
          };
      
      const movementDifficulties = getMovementDifficultiesMap(movementLevels, fitnessLevel);
      
      // Get allowed difficulty levels for this movement pattern
      const allowedDifficulties = movementDifficulties[movementPattern as keyof typeof movementDifficulties] || ['beginner'];
      
      // Database-level filtering: fetch only exercises matching movement pattern and difficulty
      const { sql: sqlFunc } = await import("drizzle-orm");
      
      const candidateExercises = await db.select()
        .from(exercises)
        .where(
          sqlFunc`${exercises.movementPattern} = ${movementPattern} 
              AND ${exercises.difficulty} = ANY(ARRAY[${sqlFunc.join(allowedDifficulties.map(d => sqlFunc`${d}`), sqlFunc`, `)}]::text[])`
        );
      
      // Client-side filtering: only filter by muscle groups now
      const similarExercises = candidateExercises.filter(ex => {
        // Match broad muscle groups
        const hasMatchingMuscle = primaryMuscles.some((muscle: string) => 
          ex.primaryMuscles.includes(muscle)
        );
        return hasMatchingMuscle;
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
