import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, date, json, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  height: real("height"),
  weight: real("weight"),
  dateOfBirth: timestamp("date_of_birth"),
  bmr: integer("bmr"),
  targetCalories: integer("target_calories"),
  nutritionGoal: text("nutrition_goal"),
  unitPreference: text("unit_preference").notNull().default("imperial"),
  equipment: text("equipment").array(),
  workoutDuration: integer("workout_duration"),
  daysPerWeek: integer("days_per_week"),
  selectedDays: integer("selected_days").array(),
  fitnessLevel: text("fitness_level"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

export const fitnessAssessments = pgTable("fitness_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  testDate: timestamp("test_date").notNull().defaultNow(),
  experienceLevel: text("experience_level"),
  pushups: integer("pushups"),
  pikePushups: integer("pike_pushups"),
  pullups: integer("pullups"),
  squats: integer("squats"),
  walkingLunges: integer("walking_lunges"),
  singleLegRdl: integer("single_leg_rdl"),
  plankHold: integer("plank_hold"),
  mileTime: real("mile_time"),
  squat1rm: real("squat_1rm"),
  deadlift1rm: real("deadlift_1rm"),
  benchPress1rm: real("bench_press_1rm"),
  overheadPress1rm: real("overhead_press_1rm"),
  barbellRow1rm: real("barbell_row_1rm"),
  dumbbellLunge1rm: real("dumbbell_lunge_1rm"),
  farmersCarry1rm: real("farmers_carry_1rm"),
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
  liftType: text("lift_type").notNull().default("compound"),
  isCorrective: integer("is_corrective").notNull().default(0),
  isPower: integer("is_power").notNull().default(0),
  exerciseType: text("exercise_type").notNull().default("main"),
  trackingType: text("tracking_type").notNull().default("reps"),
  workoutType: text("workout_type").notNull().default("strength"),
  recommendedTempo: text("recommended_tempo"),
  videoUrl: text("video_url"),
  formTips: text("form_tips").array(),
});

export const insertExerciseSchema = createInsertSchema(exercises).omit({
  id: true,
}).extend({
  liftType: z.enum(["compound", "isolation"]).default("compound"),
  exerciseType: z.enum(["warmup", "main", "cooldown"]).optional(),
  trackingType: z.enum(["reps", "duration", "both"]).default("reps"),
  workoutType: z.enum(["strength", "cardio", "hiit", "mobility"]).default("strength"),
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
  intensityLevel: text("intensity_level").notNull().default("moderate"),
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
  workoutType: text("workout_type"),
});

export const programExercises = pgTable("program_exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workoutId: varchar("workout_id").notNull(),
  exerciseId: varchar("exercise_id").notNull(),
  equipment: text("equipment"),
  orderIndex: integer("order_index").notNull(),
  sets: integer("sets").notNull(),
  repsMin: integer("reps_min"),
  repsMax: integer("reps_max"),
  recommendedWeight: real("recommended_weight"),
  durationSeconds: integer("duration_seconds"),
  workSeconds: integer("work_seconds"),
  restSeconds: integer("rest_seconds").notNull(),
  tempo: text("tempo"),
  targetRPE: integer("target_rpe"),
  targetRIR: integer("target_rir"),
  notes: text("notes"),
  supersetGroup: text("superset_group"),
  supersetOrder: integer("superset_order"),
});

export const insertWorkoutProgramSchema = createInsertSchema(workoutPrograms).omit({
  id: true,
  createdDate: true,
}).extend({
  intensityLevel: z.enum(["light", "moderate", "vigorous", "circuit"]).default("moderate"),
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
  programWorkoutId: varchar("program_workout_id"),
  workoutName: text("workout_name"),
  sessionDate: timestamp("session_date").notNull().defaultNow(),
  scheduledDate: date("scheduled_date"),
  sessionDayOfWeek: integer("session_day_of_week"),
  sessionType: text("session_type").notNull().default("rest"),
  workoutType: text("workout_type"),
  completed: integer("completed").notNull().default(0),
  status: text("status").notNull().default("in_progress"),
  durationMinutes: integer("duration_minutes"),
  caloriesBurned: integer("calories_burned"),
  notes: text("notes"),
  isArchived: integer("is_archived").notNull().default(0),
}, (table) => ({
  // Ensure only one active session per user per date (prevents duplicates)
  uniqueUserDateSession: uniqueIndex("unique_user_date_session").on(table.userId, table.scheduledDate, table.isArchived),
}));

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
}).extend({
  sessionType: z.enum(["workout", "rest"]).default("rest"),
  workoutType: z.enum(["strength", "cardio", "hiit", "mobility"]).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
});

export const patchWorkoutSessionSchema = z.object({
  completed: z.union([z.boolean(), z.number()]).transform(val => val ? 1 : 0).optional(),
  status: z.string().optional(),
  sessionType: z.enum(["workout", "rest"]).optional(),
  workoutType: z.enum(["strength", "cardio", "hiit", "mobility"]).optional(),
  durationMinutes: z.number().optional(),
  caloriesBurned: z.number().optional(),
  notes: z.string().optional(),
});

export const insertWorkoutSetSchema = createInsertSchema(workoutSets).omit({
  id: true,
  timestamp: true,
});

export type InsertWorkoutSession = z.infer<typeof insertWorkoutSessionSchema>;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type PatchWorkoutSession = z.infer<typeof patchWorkoutSessionSchema>;
export type InsertWorkoutSet = z.infer<typeof insertWorkoutSetSchema>;
export type WorkoutSet = typeof workoutSets.$inferSelect;
