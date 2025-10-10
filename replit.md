# FitForge - Personal Fitness Program Application

## Overview
FitForge is a mobile-first fitness application designed for personalized workout program generation. It guides users through an onboarding questionnaire, creates custom workout plans based on fitness levels, available equipment, and schedule, and provides tools for workout tracking and progress monitoring. The application utilizes a template-based adaptive training system for intelligent program generation and progressive overload, aiming for quick data entry and functional clarity to help users achieve their fitness goals.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 with TypeScript, Vite, Wouter for routing, and React Query for server state management. UI components are built with Shadcn/ui and Radix UI, styled with Tailwind CSS, featuring a custom Material Design-inspired theme with light/dark modes. Core views include Home, Workout, History, Body Metrics, Settings, and Progress visualization, accessible via bottom navigation. All UI components display actual calendar dates.

### Technical Implementations
The backend is an Express.js server developed with TypeScript, handling JSON requests/responses with CORS. It integrates with Vite for HMR and serves static files. Replit Auth (OpenID Connect) is used for authentication via Passport.js for session management. PostgreSQL is the primary database, accessed via Drizzle ORM.

**Performance Optimizations**:
- Database-level query optimization (e.g., PostgreSQL array operators, strategic indexing).
- Paginated API endpoints for lists like workout sessions.
- Combined home data endpoint (`/api/home-data`) to reduce multiple sequential API calls to one.
- Optimized recent sets and similar exercises endpoints using JOIN queries.
- Historical performance data display during active workouts.

**Login Flow**:
- Users are redirected to home if an active program exists, otherwise to onboarding.

**Timezone-Safe Date Handling**:
- Uses YYYY-MM-DD strings for calendar dates (PostgreSQL DATE type) with centralized parsing/formatting utilities, interpreting dates in the user's local timezone.
- Completion timestamps are stored in UTC.

### Feature Specifications
- **Data Model**: Includes Users, Fitness Assessments, Exercise Database, Workout Programs, and Performance Tracking. Workout sessions are pre-generated with `scheduledDate`.
  - **Session Lifecycle Management**: Enforces a one-session-per-day rule. Completed sessions are archived, incomplete future sessions are deleted during program regeneration. Cardio additions replace existing rest sessions.
- **Comprehensive Fitness Assessment System**: Onboarding supports Bodyweight Test, Weights Test, or an option to skip. Assessment data maps to 8 independent movement patterns for precise difficulty filtering. Collects `daysPerWeek`, `selectedDays`, and comprehensive equipment selection (17 options).
- **Template-Based Adaptive Training System**:
  - **Program Generation**: Algorithms select from prebuilt templates (Strength Primary, Cardio Primary, Hybrid Balance) to create custom 8-week programs based on user equipment, fitness level, and schedule. Exercise selection is filtered by movement pattern difficulty and available equipment.
  - **Goal-Based Programming**: Implements mixed strength/hypertrophy training where exercise parameters are determined by exercise type and training goal, NOT by user experience level. Primary compound lifts (first 1-2) use strength focus (4-6 reps, 4-5 sets, 180s rest), secondary compounds use hypertrophy (8-12 reps, 3-4 sets, 90s rest), isolation exercises use hypertrophy (10-15 reps, 3 sets, 60s rest), core/accessory uses endurance (12-20 reps, 2-3 sets, 60s rest). Experience level only affects total sets (-1 for beginners).
  - **Exercise-Type Based Rest Periods**: Rest intervals are determined purely by exercise type and training goal with NO experience level influence. Primary compounds: 180s, hypertrophy work: 60-90s, isolation: 60s, core/accessory: 45-60s, warmups: 30s, HIIT/cardio: fitness-level based intervals.
  - **Precise Time Calculation System**: Uses `calculateExerciseTime()` helper to accurately compute workout duration: workTime (reps × 2.5s × sets) + restTime (restSeconds × (sets-1)) + transitionTime (30s). For HIIT: (workSeconds × sets + restSeconds × (sets-1)) / 60 + transition. Time estimates are precise rather than rough approximations.
  - **Goal-Based Time Allocation System**: Dynamically calculates exercise counts based on `workoutDuration` and `nutritionGoal` using precise time estimates. Allocates warmups (2-3 based on duration), then 2 primary compounds, then checks if cardio fits using goal-specific requirements before filling remaining time with secondaries. Cardio configuration varies by goal: GAIN (5.5min HIIT, needs 3+ secondaries first), MAINTAIN (7.5min mixed cardio, needs 2+ secondaries), LOSE (9min mixed cardio, needs 1+ secondary). Example allocations at 60min: GAIN (3w+2p+3s+1c=58.7min), MAINTAIN (3w+2p+2s+1c=54min), LOSE (3w+2p+2s+1c=55.5min). At 90min: GAIN (9 secondaries), MAINTAIN (9 secondaries), LOSE (7 secondaries). System ensures workouts fit within user's selected duration while optimizing for their nutrition goal.
  - **Intelligent Workout Naming**: Generates descriptive workout names based on movement patterns and exercise content.
  - **Calendar-Aligned Session Generation**: Programs start on the user's current day, with sessions aligning with actual calendar dates, including rest days.
  - **Exercise Database**: 95 exercises categorized by equipment and movement pattern, supporting multi-equipment variations and including both compound and isolation movements. Isolation exercises are integrated strategically based on user level and assessment.
  - **Category-Specific Difficulty Filtering**: Enables independent progression across movement patterns (push, pull, squat, lunge, hinge, cardio, core, rotation, carry).
  - **Progressive Overload**: Automatically adjusts exercise difficulty based on user performance and Reps in Reserve (RIR).
  - **Daily Calendar Workflow**: Home page displays today's workout with completion states (Complete, Skipped, Pending). Provides options to add cardio or complete rest days, start/skip workouts. Always previews tomorrow's session.
  - **Missed Workout Detection & Recovery**: Automatically detects missed workouts from past dates and prompts users with options to reset the program from today or skip missed workouts.
- **Calorie Tracking System**: Incorporates MET calculations for calorie expenditure on both frontend and backend.
- **Goal-Based Cardio Variety System**: Implements cardio type rotation based on nutrition goal to optimize training adaptations. GAIN: HIIT only (most time-efficient for heart health). MAINTAIN: Rotates between HIIT (70%) and Steady-State (30%) for balanced conditioning. LOSE: Rotates through 4 types - HIIT (40%), Steady-State (25%), Tempo (20%), Metabolic Circuits (15%) - to maximize calorie burn and prevent adaptation. Sets are automatically calculated based on goal-specific duration and fitness-level work/rest ratios.
- **HIIT Interval Training System**: Supports HIIT with automated timers, common protocols, and custom intervals based on user's cardio equipment.
- **Unified Program Settings**: Settings page combines nutrition goals and workout preferences into a single "Program Settings" card. Nutrition goal changes (GAIN/MAINTAIN/LOSE) trigger the same regeneration dialog as equipment, schedule, or duration changes. Goal-specific info boxes explain how each nutrition goal affects workout structure (cardio duration, frequency, and type variety). Single "Update Program Settings" button handles all program-affecting changes with async/await pattern to ensure UI state consistency.

## External Dependencies

- **UI Libraries**: Radix UI primitives, Recharts, date-fns, cmdk, Lucide React.
- **Form & Validation**: React Hook Form, Zod, Drizzle-Zod.
- **Development Tools**: TypeScript, ESBuild, PostCSS.
- **External Services**: Neon serverless (PostgreSQL).
- **Asset Management**: Stock images, Google Fonts (Inter, Roboto Mono).