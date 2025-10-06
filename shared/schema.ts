import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const session = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  height: real("height"),
  weight: real("weight"),
  age: integer("age"),
  bmr: integer("bmr"),
  targetCalories: integer("target_calories"),
  nutritionGoal: text("nutrition_goal"),
  unitPreference: text("unit_preference").notNull().default("imperial"),
  equipment: text("equipment").array(),
  workoutDuration: integer("workout_duration"),
  daysPerWeek: integer("days_per_week"),
  selectedDays: integer("selected_days").array(),
  fitnessLevel: text("fitness_level"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const fitnessAssessments = pgTable("fitness_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  testDate: timestamp("test_date").notNull().defaultNow(),
  experienceLevel: text("experience_level"),
  pushups: integer("pushups"),
  pullups: integer("pullups"),
  squats: integer("squats"),
  mileTime: real("mile_time"),
  squat1rm: real("squat_1rm"),
  deadlift1rm: real("deadlift_1rm"),
  benchPress1rm: real("bench_press_1rm"),
  overheadPress1rm: real("overhead_press_1rm"),
  barbellRow1rm: real("barbell_row_1rm"),
});

export const insertFitnessAssessmentSchema = createInsertSchema(fitnessAssessments).omit({
  id: true,
  testDate: true,
});

export type InsertFitnessAssessment = z.infer<typeof insertFitnessAssessmentSchema>;
export type FitnessAssessment = typeof fitnessAssessments.$inferSelect;

export const exercises = pgTable("exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  movementPattern: text("movement_pattern").notNull(),
  equipment: text("equipment").array().notNull(),
  difficulty: text("difficulty").notNull(),
  primaryMuscles: text("primary_muscles").array().notNull(),
  secondaryMuscles: text("secondary_muscles").array(),
  isFunctional: integer("is_functional").notNull().default(1),
  isCorrective: integer("is_corrective").notNull().default(0),
  exerciseType: text("exercise_type").notNull().default("main"),
  videoUrl: text("video_url"),
  formTips: text("form_tips").array(),
});

export const insertExerciseSchema = createInsertSchema(exercises).omit({
  id: true,
}).extend({
  exerciseType: z.enum(["warmup", "main", "cooldown"]).optional(),
});

export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type Exercise = typeof exercises.$inferSelect;

export const workoutPrograms = pgTable("workout_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  createdDate: timestamp("created_date").notNull().defaultNow(),
  fitnessAssessmentId: varchar("fitness_assessment_id"),
  programType: text("program_type").notNull(),
  weeklyStructure: text("weekly_structure").notNull(),
  durationWeeks: integer("duration_weeks").notNull(),
  isActive: integer("is_active").notNull().default(1),
  archivedDate: timestamp("archived_date"),
  archivedReason: text("archived_reason"),
});

export const programWorkouts = pgTable("program_workouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: varchar("program_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  workoutName: text("workout_name").notNull(),
  movementFocus: text("movement_focus").array().notNull(),
  workoutType: text("workout_type").notNull().default("workout"),
});

export const programExercises = pgTable("program_exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workoutId: varchar("workout_id").notNull(),
  exerciseId: varchar("exercise_id").notNull(),
  orderIndex: integer("order_index").notNull(),
  sets: integer("sets").notNull(),
  repsMin: integer("reps_min"),
  repsMax: integer("reps_max"),
  recommendedWeight: real("recommended_weight"),
  durationSeconds: integer("duration_seconds"),
  restSeconds: integer("rest_seconds").notNull(),
  targetRPE: integer("target_rpe"),
  targetRIR: integer("target_rir"),
  notes: text("notes"),
});

export const insertWorkoutProgramSchema = createInsertSchema(workoutPrograms).omit({
  id: true,
  createdDate: true,
});

export const insertProgramWorkoutSchema = createInsertSchema(programWorkouts).omit({
  id: true,
});

export const insertProgramExerciseSchema = createInsertSchema(programExercises).omit({
  id: true,
});

export type InsertWorkoutProgram = z.infer<typeof insertWorkoutProgramSchema>;
export type WorkoutProgram = typeof workoutPrograms.$inferSelect;
export type InsertProgramWorkout = z.infer<typeof insertProgramWorkoutSchema>;
export type ProgramWorkout = typeof programWorkouts.$inferSelect;
export type InsertProgramExercise = z.infer<typeof insertProgramExerciseSchema>;
export type ProgramExercise = typeof programExercises.$inferSelect;

export const workoutSessions = pgTable("workout_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  programWorkoutId: varchar("program_workout_id").notNull(),
  sessionDate: timestamp("session_date").notNull().defaultNow(),
  completed: integer("completed").notNull().default(0),
  status: text("status").notNull().default("in_progress"),
  durationMinutes: integer("duration_minutes"),
  notes: text("notes"),
});

export const workoutSets = pgTable("workout_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  programExerciseId: varchar("program_exercise_id").notNull(),
  setNumber: integer("set_number").notNull(),
  weight: real("weight"),
  reps: integer("reps"),
  rir: integer("rir"),
  durationSeconds: integer("duration_seconds"),
  completed: integer("completed").notNull().default(0),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertWorkoutSessionSchema = createInsertSchema(workoutSessions).omit({
  id: true,
  sessionDate: true,
});

export const insertWorkoutSetSchema = createInsertSchema(workoutSets).omit({
  id: true,
  timestamp: true,
});

export type InsertWorkoutSession = z.infer<typeof insertWorkoutSessionSchema>;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkoutSet = z.infer<typeof insertWorkoutSetSchema>;
export type WorkoutSet = typeof workoutSets.$inferSelect;
