// ==========================================
// DATABASE STORAGE LAYER
// ==========================================
// This file provides all database operations (CRUD) for Morphit
// Think of it as the "data access layer" - it's the ONLY place that talks to the database
//
// ARCHITECTURE:
// - IStorage interface: Defines all available database operations
// - DbStorage class: Implements operations using Drizzle ORM + PostgreSQL
// - Routes call storage methods (routes.ts → storage.ts → database)
//
// MAIN OPERATION GROUPS:
// 1. User Operations: Get/update user profiles
// 2. Fitness Assessment Operations: Track test results (bodyweight/weights tests)
// 3. Exercise Operations: Manage exercise library (196 exercises)
// 4. Program Operations: Create/manage workout programs (8-week plans)
// 5. Session Operations: Track daily workout sessions (scheduled + completed)
// 6. Set Operations: Track individual exercise sets (actual performance)
// ==========================================

import { 
  type User, 
  type UpsertUser, 
  type FitnessAssessment, 
  type InsertFitnessAssessment,
  type Exercise,
  type InsertExercise,
  type WorkoutProgram,
  type InsertWorkoutProgram,
  type ProgramWorkout,
  type InsertProgramWorkout,
  type ProgramExercise,
  type InsertProgramExercise,
  type WorkoutSession,
  type InsertWorkoutSession,
  type WorkoutSet,
  type InsertWorkoutSet,
} from "@shared/schema";
import { randomUUID } from "crypto";

// ==========================================
// STORAGE INTERFACE
// ==========================================
// Defines all available database operations
// Any new database operation should be added here first
// ==========================================
export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  // Create a new user record. Implementations may upsert if needed.
  createUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  createFitnessAssessment(assessment: InsertFitnessAssessment): Promise<FitnessAssessment>;
  getUserFitnessAssessments(userId: string): Promise<FitnessAssessment[]>;
  getLatestFitnessAssessment(userId: string): Promise<FitnessAssessment | undefined>;
  getCompleteFitnessProfile(userId: string): Promise<FitnessAssessment | undefined>;
  
  createExercise(exercise: InsertExercise): Promise<Exercise>;
  getExercise(id: string): Promise<Exercise | undefined>;
  getAllExercises(): Promise<Exercise[]>;
  getExercisesByEquipment(equipment: string[]): Promise<Exercise[]>;
  deleteExercise(id: string): Promise<void>;
  
  createWorkoutProgram(program: InsertWorkoutProgram): Promise<WorkoutProgram>;
  getWorkoutProgram(id: string): Promise<WorkoutProgram | undefined>;
  getUserActiveProgram(userId: string): Promise<WorkoutProgram | undefined>;
  getUserPrograms(userId: string): Promise<WorkoutProgram[]>;
  updateWorkoutProgram(id: string, updates: Partial<WorkoutProgram>): Promise<WorkoutProgram | undefined>;
  
  createProgramWorkout(workout: InsertProgramWorkout): Promise<ProgramWorkout>;
  getProgramWorkout(id: string): Promise<ProgramWorkout | undefined>;
  getProgramWorkouts(programId: string): Promise<ProgramWorkout[]>;
  
  createProgramExercise(exercise: InsertProgramExercise): Promise<ProgramExercise>;
  getWorkoutExercises(workoutId: string): Promise<ProgramExercise[]>;
  getProgramExercise(id: string): Promise<ProgramExercise | undefined>;
  updateProgramExercise(id: string, updates: Partial<ProgramExercise>): Promise<ProgramExercise | undefined>;
  
  createWorkoutSession(session: InsertWorkoutSession): Promise<WorkoutSession>;
  createWorkoutSessionsBatch(sessions: InsertWorkoutSession[]): Promise<WorkoutSession[]>;
  getWorkoutSession(id: string): Promise<WorkoutSession | undefined>;
  getSessionByDate(userId: string, scheduledDate: string): Promise<WorkoutSession | undefined>;
  getUserSessions(userId: string): Promise<WorkoutSession[]>;
  getUserSessionsPaginated(userId: string, limit: number, offset: number, startDate?: string, endDate?: string): Promise<{ sessions: WorkoutSession[], total: number }>;
  getTodayCaloriesBurned(userId: string, startDate: Date, endDate: Date): Promise<number>;
  updateWorkoutSession(id: string, updates: Partial<WorkoutSession>): Promise<WorkoutSession | undefined>;
  deleteIncompleteProgramSessions(programId: string): Promise<void>;
  archiveCompletedSessions(userId: string, fromDate: string): Promise<number>;
  deleteIncompleteSessions(userId: string, fromDate: string): Promise<number>;
  cleanupSessionsForRegeneration(userId: string, fromDate: string): Promise<{ archived: number; deleted: number }>;
  removeDuplicateSessions(userId: string): Promise<number>;
  
  createWorkoutSet(set: InsertWorkoutSet): Promise<WorkoutSet>;
  getWorkoutSet(id: string): Promise<WorkoutSet | undefined>;
  getSessionSets(sessionId: string): Promise<WorkoutSet[]>;
  getUserRecentSets(userId: string, exerciseId: string, limit: number): Promise<WorkoutSet[]>;
  updateWorkoutSet(id: string, updates: Partial<WorkoutSet>): Promise<WorkoutSet | undefined>;
}


import { db } from "./db";
import { 
  users, 
  fitnessAssessments, 
  exercises, 
  workoutPrograms, 
  programWorkouts, 
  programExercises, 
  workoutSessions, 
  workoutSets 
} from "@shared/schema";
import { eq, desc, and, inArray, gte, sql } from "drizzle-orm";

// ==========================================
// DATABASE STORAGE IMPLEMENTATION
// ==========================================
// Implements all database operations using Drizzle ORM
// ==========================================

export class DbStorage implements IStorage {
  // ==========================================
  // USER OPERATIONS
  // ==========================================
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  // Convenience: createUser delegates to upsertUser so callers can rely on a
  // simple "create" API while the storage layer handles upsert semantics.
  async createUser(userData: UpsertUser): Promise<User> {
    // Ensure timestamps exist for databases that expect them
    const dataWithTimestamps = {
      ...userData,
      createdAt: (userData as any).createdAt || new Date(),
      updatedAt: (userData as any).updatedAt || new Date(),
    } as UpsertUser;

    return this.upsertUser(dataWithTimestamps);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  // ==========================================
  // FITNESS ASSESSMENT OPERATIONS
  // ==========================================
  // Tracks bodyweight test results (push-ups, squats, mile time)
  // and weights test results (1RMs for major lifts)
  // ==========================================
  async createFitnessAssessment(insertAssessment: InsertFitnessAssessment): Promise<FitnessAssessment> {
    const result = await db.insert(fitnessAssessments).values(insertAssessment).returning();
    return result[0];
  }

  async getUserFitnessAssessments(userId: string): Promise<FitnessAssessment[]> {
    return db.select().from(fitnessAssessments)
      .where(eq(fitnessAssessments.userId, userId))
      .orderBy(desc(fitnessAssessments.testDate));
  }

  async getLatestFitnessAssessment(userId: string): Promise<FitnessAssessment | undefined> {
    const result = await db.select().from(fitnessAssessments)
      .where(eq(fitnessAssessments.userId, userId))
      .orderBy(desc(fitnessAssessments.testDate))
      .limit(1);
    return result[0];
  }

  async getCompleteFitnessProfile(userId: string): Promise<FitnessAssessment | undefined> {
    const assessments = await db.select().from(fitnessAssessments)
      .where(eq(fitnessAssessments.userId, userId))
      .orderBy(desc(fitnessAssessments.testDate));
    
    if (assessments.length === 0) {
      return undefined;
    }
    
    // Get most recent bodyweight test data
    const bodyweightTest = assessments.find(a => a.pushups || a.pullups || a.squats || a.mileTime);
    
    // Get most recent weights test data
    const weightsTest = assessments.find(a => 
      a.squat1rm || a.deadlift1rm || a.benchPress1rm || a.overheadPress1rm || a.barbellRow1rm
    );
    
    // Merge the data, preferring the most recent overall assessment for metadata
    const latestAssessment = assessments[0];
    
    return {
      ...latestAssessment,
      // Override with bodyweight data if available
      pushups: bodyweightTest?.pushups ?? latestAssessment.pushups,
      pullups: bodyweightTest?.pullups ?? latestAssessment.pullups,
      squats: bodyweightTest?.squats ?? latestAssessment.squats,
      mileTime: bodyweightTest?.mileTime ?? latestAssessment.mileTime,
      // Override with weights data if available
      squat1rm: weightsTest?.squat1rm ?? latestAssessment.squat1rm,
      deadlift1rm: weightsTest?.deadlift1rm ?? latestAssessment.deadlift1rm,
      benchPress1rm: weightsTest?.benchPress1rm ?? latestAssessment.benchPress1rm,
      overheadPress1rm: weightsTest?.overheadPress1rm ?? latestAssessment.overheadPress1rm,
      barbellRow1rm: weightsTest?.barbellRow1rm ?? latestAssessment.barbellRow1rm,
    };
  }

  async getFitnessAssessmentById(id: string): Promise<FitnessAssessment | undefined> {
    const result = await db.select().from(fitnessAssessments).where(eq(fitnessAssessments.id, id)).limit(1);
    return result[0];
  }

  async updateFitnessAssessmentOverride(id: string, overrideData: Partial<FitnessAssessment>): Promise<FitnessAssessment | undefined> {
    const result = await db.update(fitnessAssessments).set(overrideData).where(eq(fitnessAssessments.id, id)).returning();
    return result[0];
  }

  // ==========================================
  // EXERCISE OPERATIONS
  // ==========================================
  // Manages the exercise library (196 exercises)
  // Filters by equipment, movement patterns, difficulty
  // ==========================================
  async createExercise(insertExercise: InsertExercise): Promise<Exercise> {
    const result = await db.insert(exercises).values(insertExercise).returning();
    return result[0];
  }

  async getExercise(id: string): Promise<Exercise | undefined> {
    const result = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
    return result[0];
  }

  async getAllExercises(): Promise<Exercise[]> {
    return db.select().from(exercises);
  }

  async getExercisesByEquipment(equipment: string[]): Promise<Exercise[]> {
    // Database-level filtering using array overlap operator
    // Equipment array includes bodyweight by default since it's always available
    const equipmentWithBodyweight = Array.from(new Set([...equipment, "bodyweight"]));
    
    return db.select()
      .from(exercises)
      .where(sql`${exercises.equipment} && ARRAY[${sql.join(equipmentWithBodyweight.map(eq => sql`${eq}`), sql`, `)}]::text[]`);
  }

  async deleteExercise(id: string): Promise<void> {
    await db.delete(exercises).where(eq(exercises.id, id));
  }

  // ==========================================
  // PROGRAM OPERATIONS
  // ==========================================
  // Creates and manages workout programs (8-week plans)
  // Programs → ProgramWorkouts → ProgramExercises hierarchy
  // ==========================================
  async createWorkoutProgram(insertProgram: InsertWorkoutProgram): Promise<WorkoutProgram> {
    const result = await db.insert(workoutPrograms).values(insertProgram).returning();
    return result[0];
  }

  async getWorkoutProgram(id: string): Promise<WorkoutProgram | undefined> {
    const result = await db.select().from(workoutPrograms).where(eq(workoutPrograms.id, id)).limit(1);
    return result[0];
  }

  async getUserActiveProgram(userId: string): Promise<WorkoutProgram | undefined> {
    const result = await db.select().from(workoutPrograms)
      .where(and(eq(workoutPrograms.userId, userId), eq(workoutPrograms.isActive, 1)))
      .limit(1);
    return result[0];
  }

  async getUserPrograms(userId: string): Promise<WorkoutProgram[]> {
    return db.select().from(workoutPrograms)
      .where(eq(workoutPrograms.userId, userId))
      .orderBy(desc(workoutPrograms.createdDate));
  }

  async updateWorkoutProgram(id: string, updates: Partial<WorkoutProgram>): Promise<WorkoutProgram | undefined> {
    const result = await db.update(workoutPrograms).set(updates).where(eq(workoutPrograms.id, id)).returning();
    return result[0];
  }

  async createProgramWorkout(insertWorkout: InsertProgramWorkout): Promise<ProgramWorkout> {
    const result = await db.insert(programWorkouts).values(insertWorkout).returning();
    return result[0];
  }

  async getProgramWorkout(id: string): Promise<ProgramWorkout | undefined> {
    const result = await db.select().from(programWorkouts).where(eq(programWorkouts.id, id)).limit(1);
    return result[0];
  }

  async getProgramWorkouts(programId: string): Promise<ProgramWorkout[]> {
    return db.select().from(programWorkouts)
      .where(eq(programWorkouts.programId, programId))
      .orderBy(programWorkouts.dayOfWeek);
  }

  async createProgramExercise(insertExercise: InsertProgramExercise): Promise<ProgramExercise> {
    const result = await db.insert(programExercises).values(insertExercise).returning();
    return result[0];
  }

  async getWorkoutExercises(workoutId: string): Promise<ProgramExercise[]> {
    return db.select().from(programExercises)
      .where(eq(programExercises.workoutId, workoutId))
      .orderBy(programExercises.orderIndex);
  }

  async getProgramExercise(id: string): Promise<ProgramExercise | undefined> {
    const result = await db.select().from(programExercises).where(eq(programExercises.id, id)).limit(1);
    return result[0];
  }

  async updateProgramExercise(id: string, updates: Partial<ProgramExercise>): Promise<ProgramExercise | undefined> {
    const result = await db.update(programExercises).set(updates).where(eq(programExercises.id, id)).returning();
    return result[0];
  }

  // ==========================================
  // WORKOUT SESSION OPERATIONS
  // ==========================================
  // Manages daily workout sessions (scheduled & completed)
  // Includes archival, pagination, calorie tracking
  // ==========================================
  async createWorkoutSession(insertSession: InsertWorkoutSession): Promise<WorkoutSession> {
    // VALIDATION: Prevent NULL scheduledDate to avoid duplicate session bugs
    // NULL dates bypass the unique constraint (userId, scheduledDate, isArchived)
    if (!insertSession.scheduledDate) {
      throw new Error("scheduledDate is required - cannot create session with NULL date");
    }
    
    const result = await db.insert(workoutSessions).values(insertSession).returning();
    return result[0];
  }

  async createWorkoutSessionsBatch(insertSessions: InsertWorkoutSession[]): Promise<WorkoutSession[]> {
    if (insertSessions.length === 0) {
      return [];
    }
    
    // VALIDATION: Prevent NULL scheduledDate to avoid duplicate session bugs
    // NULL dates bypass the unique constraint (userId, scheduledDate, isArchived)
    const invalidSessions = insertSessions.filter(s => !s.scheduledDate);
    if (invalidSessions.length > 0) {
      throw new Error(`Cannot create ${invalidSessions.length} session(s) with NULL scheduledDate`);
    }
    
    const result = await db.insert(workoutSessions).values(insertSessions).returning();
    return result;
  }

  async getWorkoutSession(id: string): Promise<WorkoutSession | undefined> {
    const result = await db.select().from(workoutSessions).where(eq(workoutSessions.id, id)).limit(1);
    return result[0];
  }

  async getUserSessions(userId: string): Promise<WorkoutSession[]> {
    return db.select().from(workoutSessions)
      .where(and(
        eq(workoutSessions.userId, userId),
        eq(workoutSessions.isArchived, 0)
      ))
      .orderBy(desc(workoutSessions.sessionDate));
  }

  async getUserSessionsPaginated(
    userId: string, 
    limit: number, 
    offset: number, 
    startDate?: string, 
    endDate?: string
  ): Promise<{ sessions: WorkoutSession[], total: number }> {
    // Build where conditions - exclude archived sessions
    const conditions = [
      eq(workoutSessions.userId, userId),
      eq(workoutSessions.isArchived, 0)
    ];
    
    if (startDate) {
      conditions.push(gte(workoutSessions.scheduledDate, startDate));
    }
    
    if (endDate) {
      const { lte } = await import("drizzle-orm");
      conditions.push(lte(workoutSessions.scheduledDate, endDate));
    }
    
    // Get paginated sessions
    const sessions = await db.select()
      .from(workoutSessions)
      .where(and(...conditions))
      .orderBy(desc(workoutSessions.sessionDate))
      .limit(limit)
      .offset(offset);
    
    // Get total count for pagination
    const { count } = await import("drizzle-orm");
    const totalResult = await db.select({ count: count() })
      .from(workoutSessions)
      .where(and(...conditions));
    
    return {
      sessions,
      total: totalResult[0]?.count || 0
    };
  }

  async getTodayCaloriesBurned(userId: string, startDate: Date, endDate: Date): Promise<number> {
    const sessions = await db.select().from(workoutSessions)
      .where(and(
        eq(workoutSessions.userId, userId),
        eq(workoutSessions.status, 'complete')
      ));
    
    // Filter by date and sum calories
    let totalCalories = 0;
    for (const session of sessions) {
      // Check sessionDate (when workout was actually completed)
      const sessionDateTime = session.sessionDate ? new Date(session.sessionDate) : null;
      if (sessionDateTime && sessionDateTime >= startDate && sessionDateTime < endDate) {
        totalCalories += session.caloriesBurned || 0;
      }
    }
    
    return totalCalories;
  }

  async updateWorkoutSession(id: string, updates: Partial<WorkoutSession>): Promise<WorkoutSession | undefined> {
    const result = await db.update(workoutSessions).set(updates).where(eq(workoutSessions.id, id)).returning();
    return result[0];
  }

  async deleteIncompleteProgramSessions(programId: string): Promise<void> {
    // Get all program workouts for this program
    const programWorkouts = await this.getProgramWorkouts(programId);
    const programWorkoutIds = programWorkouts.map(pw => pw.id);
    
    if (programWorkoutIds.length === 0) {
      return;
    }

    // Delete all incomplete sessions for this program
    const { inArray: inArrayOp } = await import("drizzle-orm");
    await db.delete(workoutSessions)
      .where(and(
        inArrayOp(workoutSessions.programWorkoutId, programWorkoutIds),
        inArrayOp(workoutSessions.status, ['scheduled', 'partial'])
      ));
  }

  async archiveCompletedSessions(userId: string, fromDate: string): Promise<number> {
    // Archive only COMPLETED sessions from the specified date onwards
    // This preserves historical workout data while cleaning up for program regeneration
    // Skip sessions that are already archived to avoid duplicate key constraint violation
    const result = await db.update(workoutSessions)
      .set({ isArchived: 1 })
      .where(and(
        eq(workoutSessions.userId, userId),
        gte(workoutSessions.scheduledDate, fromDate),
        eq(workoutSessions.status, 'complete'),
        eq(workoutSessions.isArchived, 0) // Only archive non-archived sessions
      ))
      .returning();
    
    return result.length;
  }

  async deleteIncompleteSessions(userId: string, fromDate: string): Promise<number> {
    // Delete all INCOMPLETE sessions from the specified date onwards
    // This cleans up pending workouts when regenerating a program
    const { inArray: inArrayOp } = await import("drizzle-orm");
    const result = await db.delete(workoutSessions)
      .where(and(
        eq(workoutSessions.userId, userId),
        gte(workoutSessions.scheduledDate, fromDate),
        inArrayOp(workoutSessions.status, ['scheduled', 'partial'])
      ))
      .returning();
    
    return result.length;
  }

  async cleanupSessionsForRegeneration(userId: string, fromDate: string): Promise<{ archived: number; deleted: number }> {
    // Three-phase cleanup for program regeneration:
    // 1. DELETE existing archived sessions to avoid unique constraint violations
    // 2. Archive completed sessions to preserve workout history
    // 3. Delete incomplete sessions to make room for new program
    
    // First, delete any already-archived sessions from this date onwards
    // This prevents duplicate key errors when archiving
    await db.delete(workoutSessions)
      .where(and(
        eq(workoutSessions.userId, userId),
        gte(workoutSessions.scheduledDate, fromDate),
        eq(workoutSessions.isArchived, 1)
      ));
    
    const archived = await this.archiveCompletedSessions(userId, fromDate);
    const deleted = await this.deleteIncompleteSessions(userId, fromDate);
    
    return { archived, deleted };
  }

  async removeDuplicateSessions(userId: string): Promise<number> {
    // Find and remove duplicate sessions for the same date (including NULL dates)
    // Keep the most recent session (by sessionDate timestamp) for each scheduled_date
    
    // Get all non-archived sessions for the user
    const allSessions = await db.select().from(workoutSessions)
      .where(and(
        eq(workoutSessions.userId, userId),
        eq(workoutSessions.isArchived, 0)
      ))
      .orderBy(workoutSessions.scheduledDate, desc(workoutSessions.sessionDate));
    
    // Group by scheduled_date to find duplicates (use "NULL" as key for null dates)
    const sessionsByDate = new Map<string, WorkoutSession[]>();
    for (const session of allSessions) {
      const dateKey = session.scheduledDate || "NULL";
      
      if (!sessionsByDate.has(dateKey)) {
        sessionsByDate.set(dateKey, []);
      }
      sessionsByDate.get(dateKey)!.push(session);
    }
    
    // Find and delete duplicates (keep most recent)
    const idsToDelete: string[] = [];
    for (const [date, sessions] of Array.from(sessionsByDate.entries())) {
      if (sessions.length > 1) {
        // Sort by sessionDate descending (most recent first)
        sessions.sort((a: WorkoutSession, b: WorkoutSession) => {
          const aTime = a.sessionDate ? new Date(a.sessionDate).getTime() : 0;
          const bTime = b.sessionDate ? new Date(b.sessionDate).getTime() : 0;
          return bTime - aTime;
        });
        
        // Keep the first (most recent), delete the rest
        for (let i = 1; i < sessions.length; i++) {
          idsToDelete.push(sessions[i].id);
        }
        
        console.log(`[DUPLICATE-CLEANUP] Found ${sessions.length} sessions for ${date}, keeping most recent (${sessions[0].id}), removing ${sessions.length - 1} older session(s)`);
      }
    }
    
    // Delete all duplicate sessions in one query
    if (idsToDelete.length > 0) {
      await db.delete(workoutSessions)
        .where(inArray(workoutSessions.id, idsToDelete));
      
      console.log(`[DUPLICATE-CLEANUP] Removed ${idsToDelete.length} duplicate session(s) for user ${userId}`);
    }
    
    return idsToDelete.length;
  }

  async getSessionByDate(userId: string, scheduledDate: string): Promise<WorkoutSession | undefined> {
    // Get the active (non-archived) session for a specific date
    // Ensures only one session per day is returned
    const result = await db.select().from(workoutSessions)
      .where(and(
        eq(workoutSessions.userId, userId),
        eq(workoutSessions.scheduledDate, scheduledDate),
        eq(workoutSessions.isArchived, 0)
      ))
      .limit(1);
    
    return result[0];
  }

  // ==========================================
  // WORKOUT SET OPERATIONS
  // ==========================================
  // Tracks individual set completions (actual performance)
  // Records weight, reps, RIR for progressive overload
  // ==========================================
  async createWorkoutSet(insertSet: InsertWorkoutSet): Promise<WorkoutSet> {
    const result = await db.insert(workoutSets).values(insertSet).returning();
    return result[0];
  }

  async getWorkoutSet(id: string): Promise<WorkoutSet | undefined> {
    const result = await db.select().from(workoutSets).where(eq(workoutSets.id, id)).limit(1);
    return result[0];
  }

  async getSessionSets(sessionId: string): Promise<WorkoutSet[]> {
    return db.select().from(workoutSets)
      .where(eq(workoutSets.sessionId, sessionId))
      .orderBy(workoutSets.setNumber);
  }

  async getUserRecentSets(userId: string, exerciseId: string, limit: number): Promise<WorkoutSet[]> {
    // Optimize with database-level JOIN instead of fetching all sessions first
    // This reduces data transfer and filtering on the client side
    return db.select({
      id: workoutSets.id,
      sessionId: workoutSets.sessionId,
      programExerciseId: workoutSets.programExerciseId,
      setNumber: workoutSets.setNumber,
      reps: workoutSets.reps,
      weight: workoutSets.weight,
      durationSeconds: workoutSets.durationSeconds,
      rir: workoutSets.rir,
      completed: workoutSets.completed,
      timestamp: workoutSets.timestamp,
    })
      .from(workoutSets)
      .innerJoin(workoutSessions, eq(workoutSets.sessionId, workoutSessions.id))
      .innerJoin(programExercises, eq(workoutSets.programExerciseId, programExercises.id))
      .where(and(
        eq(workoutSessions.userId, userId),
        eq(programExercises.exerciseId, exerciseId),
        eq(workoutSets.completed, 1)
      ))
      .orderBy(desc(workoutSets.timestamp))
      .limit(limit);
  }

  async updateWorkoutSet(id: string, updates: Partial<WorkoutSet>): Promise<WorkoutSet | undefined> {
    const result = await db.update(workoutSets).set(updates).where(eq(workoutSets.id, id)).returning();
    return result[0];
  }
}

export const storage = new DbStorage();
