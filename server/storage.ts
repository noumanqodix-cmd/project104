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
  
  createExercise(exercise: InsertExercise): Promise<Exercise>;
  getExercise(id: string): Promise<Exercise | undefined>;
  getAllExercises(): Promise<Exercise[]>;
  getExercisesByEquipment(equipment: string[]): Promise<Exercise[]>;
  
  createWorkoutProgram(program: InsertWorkoutProgram): Promise<WorkoutProgram>;
  getWorkoutProgram(id: string): Promise<WorkoutProgram | undefined>;
  getUserActiveProgram(userId: string): Promise<WorkoutProgram | undefined>;
  getUserPrograms(userId: string): Promise<WorkoutProgram[]>;
  
  createProgramWorkout(workout: InsertProgramWorkout): Promise<ProgramWorkout>;
  getProgramWorkouts(programId: string): Promise<ProgramWorkout[]>;
  
  createProgramExercise(exercise: InsertProgramExercise): Promise<ProgramExercise>;
  getWorkoutExercises(workoutId: string): Promise<ProgramExercise[]>;
  getProgramExercise(id: string): Promise<ProgramExercise | undefined>;
  
  createWorkoutSession(session: InsertWorkoutSession): Promise<WorkoutSession>;
  getWorkoutSession(id: string): Promise<WorkoutSession | undefined>;
  getUserSessions(userId: string): Promise<WorkoutSession[]>;
  updateWorkoutSession(id: string, updates: Partial<WorkoutSession>): Promise<WorkoutSession | undefined>;
  
  createWorkoutSet(set: InsertWorkoutSet): Promise<WorkoutSet>;
  getSessionSets(sessionId: string): Promise<WorkoutSet[]>;
  getUserRecentSets(userId: string, exerciseId: string, limit: number): Promise<WorkoutSet[]>;
  updateWorkoutSet(id: string, updates: Partial<WorkoutSet>): Promise<WorkoutSet | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private fitnessAssessments: Map<string, FitnessAssessment>;
  private exercises: Map<string, Exercise>;
  private workoutPrograms: Map<string, WorkoutProgram>;
  private programWorkouts: Map<string, ProgramWorkout>;
  private programExercises: Map<string, ProgramExercise>;
  private workoutSessions: Map<string, WorkoutSession>;
  private workoutSets: Map<string, WorkoutSet>;

  constructor() {
    this.users = new Map();
    this.fitnessAssessments = new Map();
    this.exercises = new Map();
    this.workoutPrograms = new Map();
    this.programWorkouts = new Map();
    this.programExercises = new Map();
    this.workoutSessions = new Map();
    this.workoutSets = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      subscriptionTier: "free",
      unitPreference: "imperial",
      phone: null,
      height: null,
      weight: null,
      bmr: null,
      targetCalories: null,
      nutritionGoal: null,
      equipment: null,
      workoutDuration: null,
      fitnessLevel: null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) {
      return undefined;
    }
    const updatedUser = { ...user, ...updates, id };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async createFitnessAssessment(insertAssessment: InsertFitnessAssessment): Promise<FitnessAssessment> {
    const id = randomUUID();
    const assessment: FitnessAssessment = {
      ...insertAssessment,
      id,
      testDate: new Date(),
      experienceLevel: insertAssessment.experienceLevel || null,
      pushups: insertAssessment.pushups || null,
      pullups: insertAssessment.pullups || null,
      squats: insertAssessment.squats || null,
      mileTime: insertAssessment.mileTime || null,
      squat1rm: insertAssessment.squat1rm || null,
      deadlift1rm: insertAssessment.deadlift1rm || null,
      benchPress1rm: insertAssessment.benchPress1rm || null,
      overheadPress1rm: insertAssessment.overheadPress1rm || null,
      barbellRow1rm: insertAssessment.barbellRow1rm || null,
    };
    this.fitnessAssessments.set(id, assessment);
    return assessment;
  }

  async getUserFitnessAssessments(userId: string): Promise<FitnessAssessment[]> {
    return Array.from(this.fitnessAssessments.values())
      .filter((assessment) => assessment.userId === userId)
      .sort((a, b) => b.testDate.getTime() - a.testDate.getTime());
  }

  async getLatestFitnessAssessment(userId: string): Promise<FitnessAssessment | undefined> {
    const assessments = await this.getUserFitnessAssessments(userId);
    return assessments[0];
  }

  async createExercise(insertExercise: InsertExercise): Promise<Exercise> {
    const id = randomUUID();
    const exercise: Exercise = {
      ...insertExercise,
      id,
      description: insertExercise.description || null,
      secondaryMuscles: insertExercise.secondaryMuscles || null,
      isFunctional: insertExercise.isFunctional !== undefined ? insertExercise.isFunctional : 1,
      isCorrective: insertExercise.isCorrective !== undefined ? insertExercise.isCorrective : 0,
      videoUrl: insertExercise.videoUrl || null,
      formTips: insertExercise.formTips || null,
    };
    this.exercises.set(id, exercise);
    return exercise;
  }

  async getExercise(id: string): Promise<Exercise | undefined> {
    return this.exercises.get(id);
  }

  async getAllExercises(): Promise<Exercise[]> {
    return Array.from(this.exercises.values());
  }

  async getExercisesByEquipment(equipment: string[]): Promise<Exercise[]> {
    return Array.from(this.exercises.values()).filter((ex) =>
      ex.equipment?.some((eq) => equipment.includes(eq) || eq === "bodyweight")
    );
  }

  async createWorkoutProgram(insertProgram: InsertWorkoutProgram): Promise<WorkoutProgram> {
    const id = randomUUID();
    const program: WorkoutProgram = {
      ...insertProgram,
      id,
      createdDate: new Date(),
      fitnessAssessmentId: insertProgram.fitnessAssessmentId || null,
      isActive: insertProgram.isActive !== undefined ? insertProgram.isActive : 1,
    };
    this.workoutPrograms.set(id, program);
    return program;
  }

  async getWorkoutProgram(id: string): Promise<WorkoutProgram | undefined> {
    return this.workoutPrograms.get(id);
  }

  async getUserActiveProgram(userId: string): Promise<WorkoutProgram | undefined> {
    return Array.from(this.workoutPrograms.values()).find(
      (p) => p.userId === userId && p.isActive === 1
    );
  }

  async getUserPrograms(userId: string): Promise<WorkoutProgram[]> {
    return Array.from(this.workoutPrograms.values())
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
  }

  async createProgramWorkout(insertWorkout: InsertProgramWorkout): Promise<ProgramWorkout> {
    const id = randomUUID();
    const workout: ProgramWorkout = { ...insertWorkout, id };
    this.programWorkouts.set(id, workout);
    return workout;
  }

  async getProgramWorkouts(programId: string): Promise<ProgramWorkout[]> {
    return Array.from(this.programWorkouts.values())
      .filter((w) => w.programId === programId)
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }

  async createProgramExercise(insertExercise: InsertProgramExercise): Promise<ProgramExercise> {
    const id = randomUUID();
    const exercise: ProgramExercise = {
      ...insertExercise,
      id,
      repsMin: insertExercise.repsMin || null,
      repsMax: insertExercise.repsMax || null,
      durationSeconds: insertExercise.durationSeconds || null,
      notes: insertExercise.notes || null,
    };
    this.programExercises.set(id, exercise);
    return exercise;
  }

  async getWorkoutExercises(workoutId: string): Promise<ProgramExercise[]> {
    return Array.from(this.programExercises.values())
      .filter((e) => e.workoutId === workoutId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async getProgramExercise(id: string): Promise<ProgramExercise | undefined> {
    return this.programExercises.get(id);
  }

  async createWorkoutSession(insertSession: InsertWorkoutSession): Promise<WorkoutSession> {
    const id = randomUUID();
    const session: WorkoutSession = {
      ...insertSession,
      id,
      sessionDate: new Date(),
      completed: insertSession.completed !== undefined ? insertSession.completed : 0,
      durationMinutes: insertSession.durationMinutes || null,
      notes: insertSession.notes || null,
    };
    this.workoutSessions.set(id, session);
    return session;
  }

  async getWorkoutSession(id: string): Promise<WorkoutSession | undefined> {
    return this.workoutSessions.get(id);
  }

  async getUserSessions(userId: string): Promise<WorkoutSession[]> {
    return Array.from(this.workoutSessions.values())
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime());
  }

  async updateWorkoutSession(id: string, updates: Partial<WorkoutSession>): Promise<WorkoutSession | undefined> {
    const session = this.workoutSessions.get(id);
    if (!session) {
      return undefined;
    }
    const updatedSession = { ...session, ...updates, id };
    this.workoutSessions.set(id, updatedSession);
    return updatedSession;
  }

  async createWorkoutSet(insertSet: InsertWorkoutSet): Promise<WorkoutSet> {
    const id = randomUUID();
    const set: WorkoutSet = {
      ...insertSet,
      id,
      weight: insertSet.weight || null,
      reps: insertSet.reps || null,
      rir: insertSet.rir || null,
      durationSeconds: insertSet.durationSeconds || null,
      completed: insertSet.completed !== undefined ? insertSet.completed : 0,
      timestamp: new Date(),
    };
    this.workoutSets.set(id, set);
    return set;
  }

  async getSessionSets(sessionId: string): Promise<WorkoutSet[]> {
    return Array.from(this.workoutSets.values())
      .filter((s) => s.sessionId === sessionId)
      .sort((a, b) => a.setNumber - b.setNumber);
  }

  async getUserRecentSets(userId: string, exerciseId: string, limit: number): Promise<WorkoutSet[]> {
    const userSessions = await this.getUserSessions(userId);
    const sessionIds = userSessions.map((s) => s.id);
    
    const matchingProgramExerciseIds = Array.from(this.programExercises.values())
      .filter((pe) => pe.exerciseId === exerciseId)
      .map((pe) => pe.id);
    
    return Array.from(this.workoutSets.values())
      .filter((set) => 
        sessionIds.includes(set.sessionId) && 
        matchingProgramExerciseIds.includes(set.programExerciseId) &&
        set.completed === 1
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async updateWorkoutSet(id: string, updates: Partial<WorkoutSet>): Promise<WorkoutSet | undefined> {
    const set = this.workoutSets.get(id);
    if (!set) {
      return undefined;
    }
    const updatedSet = { ...set, ...updates, id };
    this.workoutSets.set(id, updatedSet);
    return updatedSet;
  }
}

export const storage = new MemStorage();
