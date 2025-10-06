import { 
  type User, 
  type InsertUser, 
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
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
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
  getWorkoutSession(id: string): Promise<WorkoutSession | undefined>;
  getUserSessions(userId: string): Promise<WorkoutSession[]>;
  updateWorkoutSession(id: string, updates: Partial<WorkoutSession>): Promise<WorkoutSession | undefined>;
  shiftRemainingSchedule(userId: string, completedDate: Date, programId: string): Promise<void>;
  
  createWorkoutSet(set: InsertWorkoutSet): Promise<WorkoutSet>;
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
import { eq, desc, and, inArray } from "drizzle-orm";

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
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
    const allExercises = await this.getAllExercises();
    return allExercises.filter((ex) =>
      ex.equipment?.some((eq) => equipment.includes(eq) || eq === "bodyweight")
    );
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

  async getWorkoutSession(id: string): Promise<WorkoutSession | undefined> {
    const result = await db.select().from(workoutSessions).where(eq(workoutSessions.id, id)).limit(1);
    return result[0];
  }

  async getUserSessions(userId: string): Promise<WorkoutSession[]> {
    return db.select().from(workoutSessions)
      .where(eq(workoutSessions.userId, userId))
      .orderBy(desc(workoutSessions.sessionDate));
  }

  async updateWorkoutSession(id: string, updates: Partial<WorkoutSession>): Promise<WorkoutSession | undefined> {
    const result = await db.update(workoutSessions).set(updates).where(eq(workoutSessions.id, id)).returning();
    return result[0];
  }

  async shiftRemainingSchedule(userId: string, completedDate: Date, programId: string): Promise<void> {
    // Get all program workouts for this program
    const programWorkouts = await this.getProgramWorkouts(programId);
    const programWorkoutIds = programWorkouts.map(pw => pw.id);
    
    if (programWorkoutIds.length === 0) {
      return;
    }

    // Get all incomplete sessions for this program that are scheduled after the completed date
    const sessions = await db.select().from(workoutSessions)
      .where(and(
        eq(workoutSessions.userId, userId),
        inArray(workoutSessions.programWorkoutId, programWorkoutIds),
        eq(workoutSessions.completed, 0)
      ));

    // Filter sessions with scheduledDate > completedDate and shift them
    const completedDateOnly = new Date(completedDate);
    completedDateOnly.setHours(0, 0, 0, 0);

    for (const session of sessions) {
      if (session.scheduledDate) {
        const sessionDate = new Date(session.scheduledDate);
        sessionDate.setHours(0, 0, 0, 0);
        
        if (sessionDate > completedDateOnly) {
          // Shift this session forward by 1 day
          const newDate = new Date(session.scheduledDate);
          newDate.setDate(newDate.getDate() - 1);
          
          await db.update(workoutSessions)
            .set({ scheduledDate: newDate })
            .where(eq(workoutSessions.id, session.id));
        }
      }
    }
  }

  async createWorkoutSet(insertSet: InsertWorkoutSet): Promise<WorkoutSet> {
    const result = await db.insert(workoutSets).values(insertSet).returning();
    return result[0];
  }

  async getSessionSets(sessionId: string): Promise<WorkoutSet[]> {
    return db.select().from(workoutSets)
      .where(eq(workoutSets.sessionId, sessionId))
      .orderBy(workoutSets.setNumber);
  }

  async getUserRecentSets(userId: string, exerciseId: string, limit: number): Promise<WorkoutSet[]> {
    const userSessions = await this.getUserSessions(userId);
    const sessionIds = userSessions.map((s) => s.id);
    
    if (sessionIds.length === 0) {
      return [];
    }

    const matchingProgramExercises = await db.select().from(programExercises)
      .where(eq(programExercises.exerciseId, exerciseId));
    const programExerciseIds = matchingProgramExercises.map((pe) => pe.id);
    
    if (programExerciseIds.length === 0) {
      return [];
    }

    return db.select().from(workoutSets)
      .where(and(
        inArray(workoutSets.sessionId, sessionIds),
        inArray(workoutSets.programExerciseId, programExerciseIds),
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
