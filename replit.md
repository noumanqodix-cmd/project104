# FitForge - Personal Fitness Program Application

## Overview
FitForge is a mobile-first fitness application designed to create personalized workout programs. It guides users through an onboarding questionnaire, generates custom workout plans based on fitness levels, available equipment, and schedule, and provides tools for workout tracking and progress monitoring. The application uses a template-based adaptive training system for intelligent program generation and progressive overload. Its core purpose is to offer quick data entry and functional clarity while supporting users in achieving their fitness goals through tailored, dynamic workout experiences.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 with TypeScript, Vite, and Wouter for routing, with React Query managing server state. The UI is built with Shadcn/ui and Radix UI, styled with Tailwind CSS, featuring a custom Material Design-inspired theme with light/dark modes. Key views include Home, Workout, History, Body Metrics, Settings, and Progress visualization, accessible via a bottom navigation. All UI components display actual calendar dates for clarity.

### Technical Implementations
The backend is an Express.js server developed with TypeScript, handling JSON requests/responses with CORS support. It integrates with Vite for HMR and serves static files in production. Replit Auth (OpenID Connect) is used for authentication, integrating with Passport.js for session management. PostgreSQL is the primary database, accessed via Drizzle ORM.

**Performance Optimizations**:
- **Database-Level Query Optimization**: Exercise filtering uses PostgreSQL array operators (`&&`) for equipment matching instead of client-side filtering. Strategic indexes added on workout_sessions (user_id, scheduled_date, program_workout_id), exercises (equipment GIN index, movement_pattern, difficulty_level), and program_workouts (program_id).
- **Paginated API Endpoints**: GET `/api/workout-sessions/paginated` supports limit/offset pagination with optional date range filtering (startDate/endDate). WorkoutHistory component uses "Load More" pattern with Set-based deduplication to prevent duplicates on React Query refetches.
- **Combined Home Data Endpoint**: GET `/api/home-data` fetches user, activeProgram, sessions, and fitnessAssessments in parallel using Promise.all, reducing 4 sequential API calls to 1 optimized request. All Home page mutations invalidate the combined cache key.
- **Recent Sets Optimization**: Similar exercises and recent sets endpoints use JOIN queries instead of separate database calls for better performance.
- **Historical Performance Display**: During active workouts, users see their previous workout data (sets, weights, reps, duration) for each exercise via the LastPerformance component. GET `/api/workout-sets?exerciseId=<id>` endpoint fetches recent sets with JOIN queries. The component groups sets by session, displays the most recent workout with relative timestamps ("3 days ago"), handles unit conversion (imperial/metric), shows RIR when available, and gracefully returns null when no historical data exists. Query keys use properly formatted URL strings to work with the default query function's `queryKey.join("/")` implementation.

**Login Flow**: After OAuth callback, the system checks `/api/programs/active` to determine user status. If an active program exists, user redirects to home. If no active program, user redirects to onboarding assessment. This prevents existing users from being forced through onboarding again.

**Timezone-Safe Date Handling**: The application uses a dual approach for date/time handling:
- **Calendar Dates (scheduledDate)**: Stored as YYYY-MM-DD strings using PostgreSQL DATE type. All parsing and formatting is centralized in `shared/dateUtils.ts`, which provides timezone-safe helpers (`parseLocalDate()`, `formatLocalDate()`, comparison utilities). These interpret dates in the user's local timezone, avoiding UTC conversion bugs.
- **Completion Timestamps (sessionDate)**: Stored in UTC as full timestamps for consistency across timezones. The backend and logs display UTC time, which is standard practice for server-side timestamps.
- **Workout Completion Status**: The `completed` field uses numeric values (0 or 1) consistently across all session types to ensure proper status detection on the home page.

### Feature Specifications
- **Data Model**: The database schema includes Users, Fitness Assessments, an Exercise Database, Workout Programs (with history tracking), and Performance Tracking. Workout sessions are pre-generated with `scheduledDate` values, and session types (`workoutType`, `sessionType`) are clearly defined for data integrity.
  - **Session Lifecycle Management (October 2025)**: The system enforces a strict one-session-per-day rule through a two-phase cleanup process:
    - **Archival of Completed Sessions**: When regenerating programs, completed sessions are archived (`is_archived = 1`) to preserve historical workout data for analytics and progress tracking
    - **Deletion of Incomplete Sessions**: Incomplete sessions from today onwards are deleted when regenerating programs to make room for the new program structure
    - **Cardio Session Replacement**: Adding cardio to a rest day replaces (updates) the existing rest session instead of creating a duplicate, ensuring only one session exists per day
    - **Query Filtering**: All session queries filter by `is_archived = 0` to exclude archived historical data from active workout views
- **Comprehensive Fitness Assessment System**: The onboarding flow supports three assessment pathways:
    - **Bodyweight Test** (7 exercises): Push-ups, pull-ups, bodyweight squats, walking lunges, single-leg RDL, plank hold, and 1-mile run time
    - **Weights Test** (9 exercises): Squat 1RM, deadlift 1RM, bench press 1RM, overhead press 1RM, barbell row 1RM, dumbbell lunge 1RM, plank hold, farmer's carry 1RM, and 1-mile run time
    - **Skip Test Option**: Users can skip fitness testing entirely and receive conservative programs based solely on experience level (beginner/intermediate/advanced)
    - **Assessment Data Usage**: All test data maps to 8 independent movement patterns (push, pull, squat, lunge, hinge, core, carry, cardio) for precise difficulty filtering. The assessment supports upsert logic to prevent duplicate records on submission retries.
    - **Workout Schedule Selection**: The onboarding questionnaire (QuestionnaireFlow) collects both `daysPerWeek` (3-7 days) and `selectedDays` (specific weekdays like Monday, Wednesday, Friday) to match the Settings page. Users select the number of workout days, then choose the exact days of the week via checkboxes.
    - **Equipment Selection**: The onboarding questionnaire includes comprehensive equipment selection organized by categories (Strength Equipment and Cardio Equipment) with 17 total options: bodyweight, dumbbells, kettlebell, barbell, resistance bands, cable machine, pull-up bar, TRX/suspension trainer, medicine ball, box/bench, jump rope, rower, bike, treadmill, elliptical, assault bike, and stair climber. The program generator filters exercises by all selected equipment types.
- **Template-Based Adaptive Training System**: Uses algorithmic program generation based on prebuilt templates and the exercise database.
    - **Program Generation**: System algorithmically selects from prebuilt templates (Strength Primary, Cardio Primary, Hybrid Balance) and creates custom 8-week programs based on user equipment, fitness level, and schedule. Exercise selection is filtered by movement pattern difficulty levels and available equipment. Starting weights are recommended based on 1RM data or bodyweight assessment results. Programs are automatically generated and saved upon signup.
    - **Time-Based Exercise Generation (October 2025)**: Program generation dynamically calculates exercise counts based on the user's selected `workoutDuration` (stored in users table). The system estimates time per exercise type (warmup: ~2min, main strength: ~8min, cardio finisher: ~8min) and generates enough exercises to properly fill the session duration. This ensures users with 30-minute sessions get 3-4 main exercises, while 60-minute sessions get 5-6 main exercises, properly scaling workout volume to available time. The `usedExerciseIds` set is reset per workout day (not shared globally) to prevent exercise depletion for users with limited equipment.
    - **Intelligent Workout Naming**: The `generateWorkoutName()` function creates descriptive workout names based on movement patterns and exercise content. Instead of generic template names, workouts are named according to their actual focus (e.g., "Monday - Upper Body Push", "Wednesday - Lower Body & Core", "Friday - Full Body Strength"). The naming system analyzes movement focus arrays and generates appropriate names including Full Body Strength, Upper Body Power, Lower Body Strength, Push & Core, Pull & Core, Total Body Conditioning, and Cardio & Conditioning.
      - **Calendar-Aligned Session Generation**: Programs always start on the user's current day (timezone-safe). Frontend sends the user's local date via `formatLocalDate(new Date())`, and the backend uses `generateWorkoutSchedule` helper to create sessions that align with actual calendar days. Each session's `dayOfWeek` matches the real calendar date, ensuring workout days and rest days appear on the correct dates. Rest day `ProgramWorkout` records are created for all non-workout days to maintain complete calendar coverage.
    - **Exercise Database**: A streamlined database of 95 exercises, categorized by equipment and movement pattern, supports multi-equipment variations and includes both functional compound movements and isolation exercises. The system explicitly generates both compound and isolation exercises, ensuring essential compound lifts are included when applicable.
    - **Isolation Exercise Integration**: Isolation exercises are strategically used for intermediate/advanced users, paired with compound movements (agonist supersets), or to target specific weaknesses, based on user fitness assessment data. They are skipped for beginners or users with limited time/equipment.
    - **Category-Specific Difficulty Filtering**: An advanced filtering system enables independent progression across movement patterns (push, pull, squat, lunge, hinge, cardio, core, rotation, carry). Exercise selection is pre-filtered by movement pattern difficulty levels derived from fitness assessments, ensuring exercises match the user's pattern-specific fitness levels. This filtering is consistently applied across program generation using shared utilities.
    - **Progressive Overload**: Automatically adjusts exercise difficulty based on user performance and Reps in Reserve (RIR).
    - **Daily Calendar Workflow (October 2025)**: The home page displays today's workout with strict one-session-per-day enforcement:
      - **Today's Display**: Shows completion states (Complete with green checkmark, Skipped with orange icon, or Pending with action buttons)
      - **Rest Day Actions**: "Add Cardio Session" (replaces rest session with cardio by updating in place) or "Complete Rest Day" (marks completed)
      - **Workout Actions**: "Start Workout" or "Skip" (marks skipped with `completed=0`, `status='skipped'`)
      - **Next Workout Preview**: Always displays tomorrow's session (next calendar day), regardless of completion status or session type. Only excludes archived sessions. Shows rest days, completed workouts, or pending workouts scheduled for the next day.
      - **Date-Based Archival**: Completed workout sessions from past dates can be archived for historical tracking. Incomplete sessions are deleted during program regeneration. All active session queries filter by `is_archived = 0`.
      - **Status Persistence**: Completed/skipped status remains visible for current day
      - **Home Page Session Logic**: Explicitly excludes archived sessions when finding today's workout to ensure current session is always displayed
      - **Missed Workout Detection & Recovery (October 2025)**: When users return after missing workouts, the system automatically detects pending workouts from past dates and prompts them with recovery options:
        - **Detection**: On home page load, GET `/api/workout-sessions/missed` checks for sessions where `scheduledDate < today AND status='scheduled' AND completed=0`
        - **Dialog Display**: Shows MissedWorkoutDialog with count, date range, and two recovery options
        - **Reset Program**: POST `/api/workout-sessions/reset-from-today` reschedules all pending workouts sequentially starting from today, maintaining program sequence integrity
        - **Skip Missed**: POST `/api/workout-sessions/skip-missed` marks all missed workouts as skipped (`completed=0, status='skipped'`), allowing continuation with originally scheduled workouts
        - **User Feedback**: Success toasts confirm actions, and React Query cache invalidation ensures UI updates immediately
        - **Timezone Safety**: All operations use `getTodayEDT()` for consistent date handling across frontend and backend
- **Calorie Tracking System**: Incorporates MET (Metabolic Equivalent of Task) calculations for calorie expenditure. Calories are calculated on both frontend and backend, with automatic intensity mapping to MET values and unit conversion.
- **HIIT Interval Training System**: Supports HIIT with automated work/rest timers and multiple cardio equipment options. The system generates HIIT exercises with common protocols and custom intervals based on user's cardio equipment. A dedicated `HIITIntervalTimer` component handles the countdown and progress tracking for HIIT workouts.

## External Dependencies

- **UI Libraries**: Radix UI primitives, Recharts, date-fns, cmdk, Lucide React.
- **Form & Validation**: React Hook Form, Zod, Drizzle-Zod.
- **Development Tools**: TypeScript, ESBuild, PostCSS.
- **External Services**: Neon serverless (PostgreSQL).
- **Asset Management**: Stock images, Google Fonts (Inter, Roboto Mono).