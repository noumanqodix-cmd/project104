# FitForge - Personal Fitness Program Application

## Overview
FitForge is a mobile-first fitness application designed to create personalized workout programs. It guides users through an onboarding questionnaire, generates custom workout plans based on fitness levels, available equipment, and schedule, and provides tools for workout tracking and progress monitoring. The application adheres to Material Design principles, prioritizing quick data entry and functional clarity for an optimal gym experience. It also incorporates an AI-powered adaptive training system for intelligent program generation and progressive overload.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React 18 with TypeScript, Vite for fast development, and Wouter for client-side routing. Server state management is handled by React Query. The UI is built with Shadcn/ui and Radix UI primitives, styled using Tailwind CSS, featuring a custom theme with light/dark modes and a Material Design-inspired color palette. The application structure includes a multi-step onboarding flow and primary views like Home, Workout, History (Workouts/Programs tabs), Body metrics, Settings (with Workout Preferences), and Progress visualization, utilizing a bottom navigation pattern.

**Calendar-Based UI (October 2025)**: The entire application now displays actual calendar dates instead of abstract week/day numbers for improved clarity:
- **Home Page** (`client/src/pages/Home.tsx`): Current Program card shows week as date range (e.g., "Oct 7 - Oct 13 • 8 week program") instead of "Week X of Y"
- **Program Details** (`client/src/components/WorkoutProgramView.tsx`): Workout navigation displays day names (e.g., "Monday • Workout 1 of 3") instead of "Day 1 of 7"
- **Progress Chart** (`client/src/components/ProgressView.tsx`): X-axis labels show calendar date ranges (e.g., "Oct 7 - 13" for same-month weeks, "Nov 27 - Dec 3" for cross-month weeks) instead of "Week 1", "Week 2"
- **Onboarding Preview** (`client/src/components/ProgramPreviewPage.tsx`): Displays first week's scheduled date range (e.g., "Oct 7 - Oct 13 Preview") instead of "Week 1 Preview"

### Backend
The backend is an Express.js server developed with TypeScript, handling JSON requests/responses with CORS support and custom logging. It integrates with Vite for development HMR and serves static files in production. Replit-specific plugins are used for development tooling.

### Authentication
The application uses **Replit Auth (OpenID Connect)** for authentication, allowing users to sign in via multiple providers (Google, GitHub, X, Apple, Email). 
- **Onboarding Flow**: Users complete the multi-step questionnaire → fitness test → nutrition → equipment → availability → subscription → program preview → **Sign in with Replit** → callback handler saves all data
- **Implementation**: Uses Passport.js with OpenID Client strategy, database-backed sessions via `connect-pg-simple`
- **User Identification**: `req.user.claims.sub` (OIDC subject claim) stored as `users.id`
- **Session Management**: Persistent sessions with automatic refresh token rotation
- **Profile Management**: Settings page displays complete Replit Auth profile (profile image, full name, email) from OIDC claims
- **Logout**: `/api/logout` endpoint properly terminates Passport session and redirects to OIDC end session URL for complete sign-out

### Data Storage
PostgreSQL is used as the primary database, configured via Neon serverless and accessed using Drizzle ORM for type-safe operations. The schema includes tables for Users (with OIDC fields: email, firstName, lastName, profileImageUrl), Fitness Assessments, an Exercise Database (143 AI-generated exercises), Workout Programs (with history tracking), and Performance Tracking (workout sessions and sets). Session management is database-backed using `connect-pg-simple` for persistent, cookie-based authentication.

**Calendar-Based Scheduling (October 2025)**: The system now uses actual calendar dates (`scheduledDate`) instead of day-of-week numbers. When a program is created, all workout sessions for the entire program duration are pre-generated with specific scheduled dates, eliminating ambiguity about which workout belongs to which day and enabling accurate program completion detection.

### AI-Powered Adaptive Training System
FitForge features an AI (OpenAI GPT-4/GPT-4-mini) powered system for personalized workout program generation and adaptation.
- **Test Type Selection**: Users choose between Bodyweight or Weights tests during onboarding.
- **Intelligent Program Generation**: GPT-4 creates custom programs based on fitness level, equipment, duration, nutrition goals, and movement patterns, including corrective exercises. Programs are generated for one week of workouts (repeating weekly) with duration specified in weeks (typically 8 weeks).
- **Smart Weight Recommendations**: AI calculates recommended starting weights for all exercises, utilizing 1RM data or bodyweight test results as proxies. These recommendations are stored and displayed.
- **Master Exercise Database**: A pre-populated database of 143 exercises, categorized by equipment and movement pattern, is used for all program generations to avoid repeated OpenAI calls.
- **Automatic Program Generation**: Upon signup, the system automatically generates and saves a personalized workout program based on user input and assessment results.
- **Progressive Overload System**: Automatically adjusts exercise difficulty based on user performance and Reps in Reserve (RIR) data, both increasing and decreasing recommendations, and persists these updates to the database.
- **Smart Workout Input**: Dynamically adjusts input fields based on exercise equipment (e.g., weight input for weighted exercises, duration for cardio).
- **Program Management**: Users can modify workout preferences in settings to regenerate programs, with older programs being archived for history tracking.
- **Workout Progression Logic**: The home page shows the next actionable workout using calendar-based scheduling:
  - All workout sessions are pre-generated with specific scheduled dates when program is created
  - Home page displays the earliest incomplete session (by scheduledDate)
  - Missed workouts (past due) automatically show as priority until completed or skipped
  - Skip functionality updates the existing session with status="skipped" and completed=1
  - Program completion is detected when all pre-generated sessions are marked as completed
  - Sessions display actual calendar dates (e.g., "Monday, October 7") for clarity
  - **Workout Completion Fix (October 2025)**: POST /api/workout-sessions endpoint now finds and updates existing pre-scheduled sessions instead of creating duplicates, eliminating 409 conflict errors
  - **Backward Compatibility**: Home page includes fallback logic to handle sessions without scheduledDate (for users with data created before calendar-based scheduling), ensuring old user data remains accessible

### Calorie Tracking System (October 2025)
FitForge includes a comprehensive calorie expenditure tracking system using industry-standard MET (Metabolic Equivalent of Task) calculations.
- **MET-Based Calculation**: Calories burned = Duration (min) × ((MET × 3.5) × Weight (kg) / 200)
- **Automatic Intensity Mapping**: Program types are automatically assigned intensity levels:
  - Light programs: 3.5 METs
  - Moderate programs: 5.0 METs (typical strength training)
  - Vigorous programs: 6.0 METs
  - Circuit training: 8.0 METs
- **Dual Calculation Approach**: Frontend calculates calories for immediate display in workout summary; backend recalculates during save to ensure data consistency
- **Smart Unit Conversion**: Automatically converts between imperial (lbs) and metric (kg) for accurate calculations regardless of user's unit preference
- **Database Schema**: `workout_sessions` table includes `caloriesBurned` (integer) column; `workout_programs` table includes `intensityLevel` (text) column with default "moderate"
- **UI Display**: Calories shown with Flame icon in:
  - Workout Summary: Displays immediately after workout completion alongside duration, exercises, and volume
  - Workout History: Shows calories for each completed session
  - Progress View: Dedicated "Calories Burned" chart visualizes weekly calorie expenditure trends
- **Implementation Files**: 
  - Backend: `server/calorie-calculator.ts` (MET calculation logic)
  - Frontend: `client/src/lib/calorie-calculator.ts` (frontend calculation)
  - Components: `WorkoutSummary.tsx`, `WorkoutHistory.tsx`, `ProgressView.tsx`

### HIIT Interval Training System (October 2025)
FitForge includes High-Intensity Interval Training (HIIT) support with automated work/rest timers and multiple cardio equipment options.
- **Equipment Support**: 30 cardio exercises across 6 equipment types (assault bike, bike, rower, treadmill, elliptical, stair climber)
- **Database Schema**: `program_exercises.work_seconds` (integer, nullable) stores HIIT work interval duration; distinct from `rest_seconds` which stores rest intervals
- **AI Generation**: GPT-4 generates HIIT exercises with common protocols:
  - Tabata: 20s work / 10s rest × 8 sets (4 minutes)
  - Standard HIIT: 30s work / 30s rest × 10-12 sets (10-12 minutes)
  - Sprint Intervals: 40s work / 20s rest × 8-10 sets (8-10 minutes)
  - Custom intervals with varying work/rest ratios
- **HIITIntervalTimer Component** (`client/src/components/HIITIntervalTimer.tsx`):
  - Auto-cycling countdown timer with work/rest phases
  - Visual progress indicators (green for work, blue for rest)
  - Pause/resume functionality
  - Set tracking display ("Set X of Y")
  - Auto-completes all sets without manual input
- **Workout Integration**: `WorkoutSession.tsx` detects HIIT exercises via `workSeconds` field and renders `HIITIntervalTimer` instead of standard rep/weight inputs
- **Volume Tracking**: HIIT exercises contribute 0 to totalVolume (no weight tracking) but preserve volume from strength exercises in mixed workouts
- **Usage Patterns**:
  - Workout finishers: 1-2 HIIT exercises at end of strength workouts
  - Standalone cardio days: Multiple HIIT exercises for conditioning
  - Active recovery: Lower intensity with longer rest periods
- **Design Constraints**: HIIT exercises should NOT be in supersets (they have their own timing structure)

## External Dependencies

- **UI Libraries**: Radix UI primitives, Recharts (data visualization), date-fns, cmdk (command palette), Lucide React (icons).
- **Form & Validation**: React Hook Form, Zod, Drizzle-Zod.
- **Development Tools**: TypeScript, ESBuild, PostCSS (with Tailwind and Autoprefixer), Path aliases.
- **External Services**: OpenAI API (GPT-4 for program generation, GPT-4-mini for suggestions), Neon serverless (PostgreSQL).
- **Asset Management**: Stock images (attached_assets), Google Fonts (Inter, Roboto Mono).