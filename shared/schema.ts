// ==========================================
// DATABASE SCHEMA - All Tables and Data Structures
// ==========================================
// This file defines the structure of every database table in Morphit
// Think of it as the blueprint for how data is organized and stored
//
// MAIN TABLES:
// 1. sessions - User login sessions (Supabase Auth)
// 2. users - User profiles (height, weight, preferences, goals)
// 3. fitnessAssessments - Fitness test results (push-ups, 1RMs, etc.)
// 4. exercises - Exercise library (196 exercises with details)
// 5. equipment - Equipment reference (auto-populated from exercises)
// 6. workoutPrograms - Generated workout plans (8-week programs)
// 7. programWorkouts - Individual workouts within a program (Mon workout, Wed workout, etc.)
// 8. programExercises - Exercises within each workout (sets, reps, weight)
// 9. workoutSessions - Scheduled daily workouts (pre-generated for 8 weeks)
// 10. workoutSets - Individual set completions (what user actually did)
//
// HOW THEY RELATE:
// User → creates → FitnessAssessment → generates → WorkoutProgram
// WorkoutProgram → contains → ProgramWorkouts → contains → ProgramExercises
// ProgramWorkouts → scheduled as → WorkoutSessions → tracked via → WorkoutSets
//
// VALIDATION:
// Each table has an "insert schema" (using Zod) that validates data before saving
// This prevents bad data from entering the database
// ==========================================

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp, date, json, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==========================================
// AUTHENTICATION TABLES
// ==========================================

// TABLE: sessions
// Stores user login sessions for Supabase Auth
// Sessions expire after a certain time for security
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),           // Session ID (unique identifier)
    sess: json("sess").notNull(),              // Session data (user info, etc.)
    expire: timestamp("expire").notNull(),      // When this session expires
  },
  (table) => [index("IDX_session_expire").on(table.expire)],  // Index for faster session cleanup
);

// TABLE: email_otp
// Stores email OTP codes for user verification during registration
// OTP codes expire after 10 minutes and can only be used once
export const emailOtp = pgTable("email_otp", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  otp: varchar("otp").notNull(),              // 6-digit OTP code
  expiresAt: timestamp("expires_at").notNull(), // When OTP expires
  isUsed: integer("is_used").notNull().default(0), // 0 = unused, 1 = used
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_email_otp_email").on(table.email),
  index("IDX_email_otp_expires_at").on(table.expiresAt),
]);

// TABLE: users
// Core user profile data - stores everything about a user
// Updated during onboarding and via Settings page
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: text("password"),
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
  selectedDays: integer("selected_days").array(),  // Legacy: Day-of-week selection (kept for backwards compatibility)
  selectedDates: text("selected_dates").array(),  // NEW: Array of YYYY-MM-DD strings for current 7-day cycle
  cycleNumber: integer("cycle_number").default(1),  // NEW: Tracks which 7-day cycle user is on
  totalWorkoutsCompleted: integer("total_workouts_completed").default(0),  // NEW: Total workouts completed across all cycles
  fitnessLevel: text("fitness_level"),
  signupDate: timestamp("signup_date").defaultNow(),
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

export const insertEmailOtpSchema = createInsertSchema(emailOtp).omit({
  id: true,
  createdAt: true,
});

export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertEmailOtp = z.infer<typeof insertEmailOtpSchema>;
export type EmailOtp = typeof emailOtp.$inferSelect;

// TABLE: fitnessAssessments
// Stores fitness test results from both onboarding and retakes
// Used to calculate movement pattern levels and generate workout programs
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
  // Manual level overrides for each movement pattern
  horizontalPushOverride: text("horizontal_push_override"),
  verticalPushOverride: text("vertical_push_override"),
  verticalPullOverride: text("vertical_pull_override"),
  horizontalPullOverride: text("horizontal_pull_override"),
  lowerBodyOverride: text("lower_body_override"),
  hingeOverride: text("hinge_override"),
  coreOverride: text("core_override"),
  rotationOverride: text("rotation_override"),
  carryOverride: text("carry_override"),
  cardioOverride: text("cardio_override"),
});

export const insertFitnessAssessmentSchema = createInsertSchema(fitnessAssessments).omit({
  id: true,
  testDate: true,
});

export type InsertFitnessAssessment = z.infer<typeof insertFitnessAssessmentSchema>;
export type FitnessAssessment = typeof fitnessAssessments.$inferSelect;

// ==========================================
// EXERCISE LIBRARY TABLES
// ==========================================

// TABLE: exercises
// Master exercise library with 196 exercises
// Each exercise has equipment, difficulty, movement pattern, and category
// Categories: warmup | power | compound | isolation | core | cardio
export const exercises = pgTable("exercises", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  movementPattern: text("movement_pattern").notNull(),
  equipment: text("equipment").array().notNull(),
  difficulty: text("difficulty").notNull(),
  primaryMuscles: text("primary_muscles").array().notNull(),
  secondaryMuscles: text("secondary_muscles").array(),
  exerciseCategory: text("exercise_category").notNull(), // Unified field: warmup | power | compound | isolation | core | cardio
  isCorrective: integer("is_corrective").notNull().default(0),
  isOlympicLift: integer("is_olympic_lift").notNull().default(0),
  trackingType: text("tracking_type").notNull().default("reps"),
  recommendedTempo: text("recommended_tempo"),
  videoUrl: text("video_url"),
  formTips: text("form_tips").array(),
});

export const insertExerciseSchema = createInsertSchema(exercises).omit({
  id: true,
}).extend({
  exerciseCategory: z.enum(["warmup", "power", "compound", "isolation", "core", "cardio"]),
  trackingType: z.enum(["reps", "duration", "both"]).default("reps"),
});

export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type Exercise = typeof exercises.$inferSelect;

// Equipment reference table - auto-populated from exercises database
export const equipment = pgTable("equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  category: text("category"), // 'cardio', 'weights', 'bodyweight', 'other'
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  createdAt: true,
});

export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;

// ==========================================
// PROGRAM STRUCTURE TABLES
// ==========================================
// These tables store the AI-generated 8-week workout programs

// TABLE: workoutPrograms
// The top-level program container - one per user at a time
// Links to the fitness assessment that generated it
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

// TABLE: programWorkouts
// Individual workouts within a program (one per training day)
// Example: Mon=Upper Power, Wed=Lower Strength, Fri=Full Body
// LEGACY: Uses dayOfWeek (1-7) for backwards compatibility
// NEW: Uses workoutIndex (1, 2, 3, ..., N) for date-based scheduling
export const programWorkouts = pgTable("program_workouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  programId: varchar("program_id").notNull(),
  dayOfWeek: integer("day_of_week"),  // LEGACY: Made optional for new approach
  workoutIndex: integer("workout_index"),  // NEW: Sequential workout number (1, 2, 3, ...)
  workoutName: text("workout_name").notNull(),
  movementFocus: text("movement_focus").array().notNull(),
  workoutType: text("workout_type"),
});

// TABLE: programExercises
// Exercises within each workout with sets/reps/weights
// Example: Bench Press - 4 sets of 8-12 reps at 135 lbs
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

// ==========================================
// WORKOUT TRACKING TABLES
// ==========================================
// These tables track actual workouts completed by users

// TABLE: workoutSessions
// Pre-scheduled daily workouts (generated for 8 weeks at program creation)
// User marks complete after finishing workout
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
  status: text("status").notNull().default("scheduled"), // scheduled → in_progress → partial/complete
  durationMinutes: integer("duration_minutes"),
  elapsedSeconds: integer("elapsed_seconds"), // Tracks timer state for partial workouts
  caloriesBurned: integer("calories_burned"),
  notes: text("notes"),
  isArchived: integer("is_archived").notNull().default(0),
}, (table) => ({
  // Ensure only one active session per user per date (prevents duplicates)
  uniqueUserDateSession: uniqueIndex("unique_user_date_session").on(table.userId, table.scheduledDate, table.isArchived),
}));

// TABLE: workoutSets
// Individual set completions during a workout
// Tracks actual performance: weight lifted, reps completed, RIR (Reps In Reserve)
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
  sessionType: z.enum(["workout", "rest"]).optional(),
  workoutType: z.enum(["strength", "cardio", "hiit", "mobility"]).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
});

export const patchWorkoutSessionSchema = z.object({
  status: z.enum(["scheduled", "in_progress", "partial", "complete", "skipped"]).optional(),
  sessionType: z.enum(["workout", "rest"]).optional(),
  workoutType: z.enum(["strength", "cardio", "hiit", "mobility"]).optional(),
  durationMinutes: z.number().optional(),
  caloriesBurned: z.number().optional(),
  notes: z.string().optional(),
  sessionDate: z.coerce.date().optional(), // Coerce ISO strings from client to Date
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
