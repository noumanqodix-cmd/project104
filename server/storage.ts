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

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
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

export class DbStorage implements IStorage {
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

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

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

  async createWorkoutSession(insertSession: InsertWorkoutSession): Promise<WorkoutSession> {
    const result = await db.insert(workoutSessions).values(insertSession).returning();
    return result[0];
  }

  async createWorkoutSessionsBatch(insertSessions: InsertWorkoutSession[]): Promise<WorkoutSession[]> {
    if (insertSessions.length === 0) {
      return [];
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
        eq(workoutSessions.completed, 1)
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
    await db.delete(workoutSessions)
      .where(and(
        inArray(workoutSessions.programWorkoutId, programWorkoutIds),
        eq(workoutSessions.completed, 0)
      ));
  }

  async archiveCompletedSessions(userId: string, fromDate: string): Promise<number> {
    // Archive only COMPLETED sessions from the specified date onwards
    // This preserves historical workout data while cleaning up for program regeneration
    const result = await db.update(workoutSessions)
      .set({ isArchived: 1 })
      .where(and(
        eq(workoutSessions.userId, userId),
        gte(workoutSessions.scheduledDate, fromDate),
        eq(workoutSessions.completed, 1)
      ))
      .returning();
    
    return result.length;
  }

  async deleteIncompleteSessions(userId: string, fromDate: string): Promise<number> {
    // Delete all INCOMPLETE sessions from the specified date onwards
    // This cleans up pending workouts when regenerating a program
    const result = await db.delete(workoutSessions)
      .where(and(
        eq(workoutSessions.userId, userId),
        gte(workoutSessions.scheduledDate, fromDate),
        eq(workoutSessions.completed, 0)
      ))
      .returning();
    
    return result.length;
  }

  async cleanupSessionsForRegeneration(userId: string, fromDate: string): Promise<{ archived: number; deleted: number }> {
    // Two-phase cleanup for program regeneration:
    // 1. Archive completed sessions to preserve workout history
    // 2. Delete incomplete sessions to make room for new program
    const archived = await this.archiveCompletedSessions(userId, fromDate);
    const deleted = await this.deleteIncompleteSessions(userId, fromDate);
    
    return { archived, deleted };
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
