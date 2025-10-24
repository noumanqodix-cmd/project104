CREATE TABLE "equipment" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "equipment_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"movement_pattern" text NOT NULL,
	"equipment" text[] NOT NULL,
	"difficulty" text NOT NULL,
	"primary_muscles" text[] NOT NULL,
	"secondary_muscles" text[],
	"exercise_category" text NOT NULL,
	"is_corrective" integer DEFAULT 0 NOT NULL,
	"is_olympic_lift" integer DEFAULT 0 NOT NULL,
	"tracking_type" text DEFAULT 'reps' NOT NULL,
	"recommended_tempo" text,
	"video_url" text,
	"form_tips" text[]
);
--> statement-breakpoint
CREATE TABLE "fitness_assessments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"test_date" timestamp DEFAULT now() NOT NULL,
	"experience_level" text,
	"pushups" integer,
	"pike_pushups" integer,
	"pullups" integer,
	"squats" integer,
	"walking_lunges" integer,
	"single_leg_rdl" integer,
	"plank_hold" integer,
	"mile_time" real,
	"squat_1rm" real,
	"deadlift_1rm" real,
	"bench_press_1rm" real,
	"overhead_press_1rm" real,
	"barbell_row_1rm" real,
	"dumbbell_lunge_1rm" real,
	"farmers_carry_1rm" real,
	"horizontal_push_override" text,
	"vertical_push_override" text,
	"vertical_pull_override" text,
	"horizontal_pull_override" text,
	"lower_body_override" text,
	"hinge_override" text,
	"core_override" text,
	"rotation_override" text,
	"carry_override" text,
	"cardio_override" text
);
--> statement-breakpoint
CREATE TABLE "program_exercises" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_id" varchar NOT NULL,
	"exercise_id" varchar NOT NULL,
	"equipment" text,
	"order_index" integer NOT NULL,
	"sets" integer NOT NULL,
	"reps_min" integer,
	"reps_max" integer,
	"recommended_weight" real,
	"duration_seconds" integer,
	"work_seconds" integer,
	"rest_seconds" integer NOT NULL,
	"tempo" text,
	"target_rpe" integer,
	"target_rir" integer,
	"notes" text,
	"superset_group" text,
	"superset_order" integer
);
--> statement-breakpoint
CREATE TABLE "program_workouts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" varchar NOT NULL,
	"day_of_week" integer,
	"workout_index" integer,
	"workout_name" text NOT NULL,
	"movement_focus" text[] NOT NULL,
	"workout_type" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"subscription_tier" text DEFAULT 'free' NOT NULL,
	"height" real,
	"weight" real,
	"date_of_birth" timestamp,
	"bmr" integer,
	"target_calories" integer,
	"nutrition_goal" text,
	"unit_preference" text DEFAULT 'imperial' NOT NULL,
	"equipment" text[],
	"workout_duration" integer,
	"days_per_week" integer,
	"selected_days" integer[],
	"selected_dates" text[],
	"cycle_number" integer DEFAULT 1,
	"total_workouts_completed" integer DEFAULT 0,
	"fitness_level" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workout_programs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"created_date" timestamp DEFAULT now() NOT NULL,
	"fitness_assessment_id" varchar,
	"program_type" text NOT NULL,
	"weekly_structure" text NOT NULL,
	"duration_weeks" integer NOT NULL,
	"intensity_level" text DEFAULT 'moderate' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"archived_date" timestamp,
	"archived_reason" text
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"program_workout_id" varchar,
	"workout_name" text,
	"session_date" timestamp DEFAULT now() NOT NULL,
	"scheduled_date" date,
	"session_day_of_week" integer,
	"session_type" text DEFAULT 'rest' NOT NULL,
	"workout_type" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"duration_minutes" integer,
	"elapsed_seconds" integer,
	"calories_burned" integer,
	"notes" text,
	"is_archived" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"program_exercise_id" varchar NOT NULL,
	"set_number" integer NOT NULL,
	"weight" real,
	"reps" integer,
	"rir" integer,
	"duration_seconds" integer,
	"completed" integer DEFAULT 0 NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_date_session" ON "workout_sessions" USING btree ("user_id","scheduled_date","is_archived");