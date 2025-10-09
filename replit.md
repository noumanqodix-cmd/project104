# FitForge - Personal Fitness Program Application

## Overview
FitForge is a mobile-first fitness application designed to create personalized workout programs. It guides users through an onboarding questionnaire, generates custom workout plans based on fitness levels, available equipment, and schedule, and provides tools for workout tracking and progress monitoring. The application incorporates an AI-powered adaptive training system for intelligent program generation and progressive overload. Its core purpose is to offer quick data entry and functional clarity while supporting users in achieving their fitness goals through tailored, dynamic workout experiences.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 with TypeScript, Vite, and Wouter for routing, with React Query managing server state. The UI is built with Shadcn/ui and Radix UI, styled with Tailwind CSS, featuring a custom Material Design-inspired theme with light/dark modes. Key views include Home, Workout, History, Body Metrics, Settings, and Progress visualization, accessible via a bottom navigation. All UI components display actual calendar dates for clarity.

### Technical Implementations
The backend is an Express.js server developed with TypeScript, handling JSON requests/responses with CORS support. It integrates with Vite for HMR and serves static files in production. Replit Auth (OpenID Connect) is used for authentication, integrating with Passport.js for session management. PostgreSQL is the primary database, accessed via Drizzle ORM.

**Timezone-Safe Date Handling**: The application uses a dual approach for date/time handling:
- **Calendar Dates (scheduledDate)**: Stored as YYYY-MM-DD strings using PostgreSQL DATE type. All parsing and formatting is centralized in `shared/dateUtils.ts`, which provides timezone-safe helpers (`parseLocalDate()`, `formatLocalDate()`, comparison utilities). These interpret dates in the user's local timezone, avoiding UTC conversion bugs.
- **Completion Timestamps (sessionDate)**: Stored in UTC as full timestamps for consistency across timezones. The backend and logs display UTC time, which is standard practice for server-side timestamps.
- **Workout Completion Status**: The `completed` field uses numeric values (0 or 1) consistently across all session types to ensure proper status detection on the home page.

### Feature Specifications
- **Data Model**: The database schema includes Users, Fitness Assessments, an Exercise Database, Workout Programs (with history tracking), and Performance Tracking. Workout sessions are pre-generated with `scheduledDate` values, and session types (`workoutType`, `sessionType`) are clearly defined for data integrity. A date-based archival system archives completed or skipped sessions when the date changes, maintaining a clean workout queue while keeping status visible for the current day.
- **Comprehensive Fitness Assessment System**: The onboarding flow supports three assessment pathways:
    - **Bodyweight Test** (7 exercises): Push-ups, pull-ups, bodyweight squats, walking lunges, single-leg RDL, plank hold, and 1-mile run time
    - **Weights Test** (9 exercises): Squat 1RM, deadlift 1RM, bench press 1RM, overhead press 1RM, barbell row 1RM, dumbbell lunge 1RM, plank hold, farmer's carry 1RM, and 1-mile run time
    - **Skip Test Option**: Users can skip fitness testing entirely and receive conservative programs based solely on experience level (beginner/intermediate/advanced)
    - **Assessment Data Usage**: All test data maps to 8 independent movement patterns (push, pull, squat, lunge, hinge, core, carry, cardio) for precise difficulty filtering. The assessment supports upsert logic to prevent duplicate records on submission retries.
- **AI-Powered Adaptive Training System**: Utilizes OpenAI GPT-4/GPT-4-mini for personalized program generation and adaptation.
    - **Program Generation**: AI selects from prebuilt templates (Strength, Cardio, Hybrid Balance) and creates custom 8-week programs based on user input, including corrective exercises. It recommends starting weights based on 1RM data or bodyweight tests. Programs are automatically generated and saved upon signup.
    - **Exercise Database**: A streamlined database of 95 exercises, categorized by equipment and movement pattern, supports multi-equipment variations and includes both functional compound movements and isolation exercises. The AI explicitly generates both compound and isolation exercises, ensuring essential compound lifts are included when applicable.
    - **Isolation Exercise Integration**: Isolation exercises are strategically used for intermediate/advanced users, paired with compound movements (agonist supersets), or to target specific weaknesses, based on user fitness assessment data. They are skipped for beginners or users with limited time/equipment.
    - **Category-Specific Difficulty Filtering**: An advanced filtering system enables independent progression across movement patterns (push, pull, squat, lunge, hinge, cardio, core, rotation, carry). Exercise lists are pre-filtered by movement pattern before being sent to GPT-4, ensuring exercises match the user's pattern-specific fitness levels. This filtering is consistently applied across program generation, exercise swapping, and preview generation using shared utilities.
    - **Progressive Overload**: Automatically adjusts exercise difficulty based on user performance and Reps in Reserve (RIR).
    - **Daily Calendar Workflow (October 2025)**: The home page displays today's workout with a date-based archival system:
      - **Today's Display**: Shows completion states (Complete with green checkmark, Skipped with orange icon, or Pending with action buttons)
      - **Rest Day Actions**: "Add Cardio Session" (archives rest, creates cardio) or "Complete Rest Day" (marks completed)
      - **Workout Actions**: "Start Workout" or "Skip" (marks skipped with `completed=0`, `status='skipped'`)
      - **Next Workout Preview**: Always displays tomorrow's session (next calendar day), regardless of completion status or session type. Only excludes archived sessions. Shows rest days, completed workouts, or pending workouts scheduled for the next day.
      - **Date-Based Archival**: Sessions stay visible with their completion/skipped status all day. When date changes and Home page loads, previous day's completed/skipped sessions are automatically archived via POST `/api/workout-sessions/archive-old`. Archival happens on page load, not on completion/skip action. **Important:** Archived sessions can ONLY exist for past dates, never for today's date.
      - **Status Persistence**: Completed/skipped status remains visible for current day, only gets archived when viewing tomorrow's workout
      - **Home Page Session Logic**: Explicitly excludes archived sessions when finding today's workout to ensure current session is always displayed
- **Calorie Tracking System**: Incorporates MET (Metabolic Equivalent of Task) calculations for calorie expenditure. Calories are calculated on both frontend and backend, with automatic intensity mapping to MET values and unit conversion.
- **HIIT Interval Training System**: Supports HIIT with automated work/rest timers and multiple cardio equipment options. GPT-4 generates HIIT exercises with common protocols and custom intervals. A dedicated `HIITIntervalTimer` component handles the countdown and progress tracking for HIIT workouts.

## External Dependencies

- **UI Libraries**: Radix UI primitives, Recharts, date-fns, cmdk, Lucide React.
- **Form & Validation**: React Hook Form, Zod, Drizzle-Zod.
- **Development Tools**: TypeScript, ESBuild, PostCSS.
- **External Services**: OpenAI API (GPT-4/GPT-4-mini), Neon serverless (PostgreSQL).
- **Asset Management**: Stock images, Google Fonts (Inter, Roboto Mono).