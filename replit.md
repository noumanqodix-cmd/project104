# FitForge - Personal Fitness Program Application

## Overview
FitForge is a science-backed fitness application that generates personalized workout programs using professional CNS-ordered programming (warmup → power → compounds → isolations → core → cardio). It trains 10 real-world functional movement patterns with adaptive difficulty, offering 3/4/5-day splits and 30/45/60/90-minute workout options. The application features intelligent equipment-based exercise swapping (perfect for travel), Zone 2 and HIIT cardio training, fitness assessments to unlock advanced movements, and a flexible 7-day cycle system with automatic missed workout rescheduling. Built on exercise science principles with AI-enhanced insights as supplemental features.

## User Preferences
- Preferred communication style: Simple, everyday language.
- Testing preference: Only use browser-based testing when absolutely necessary (UI/UX validation, multi-page workflows, JavaScript-dependent features). Prefer faster methods like API testing, database queries, log inspection, and LSP diagnostics for backend/schema changes.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 with TypeScript, Vite, Wouter for routing, and React Query for server state management. UI components are built with Shadcn/ui and Radix UI, styled with Tailwind CSS, featuring a custom Material Design-inspired theme with light/dark modes. Core views include Home, Workout, History, Body Metrics, Settings, and Progress visualization, accessible via bottom navigation. All UI components display actual calendar dates.

### Technical Implementations
The backend is an Express.js server developed with TypeScript, handling JSON requests/responses with CORS. It integrates with Vite for HMR and serves static files. Replit Auth (OpenID Connect) is used for authentication via Passport.js for session management. PostgreSQL is the primary database, accessed via Drizzle ORM. Performance optimizations include database-level query optimization, paginated API endpoints, combined home data endpoint, and optimized queries for recent sets and similar exercises. Data integrity is maintained through unique constraints and automatic duplicate session removal. Timezone-safe date handling uses YYYY-MM-DD strings for calendar dates, interpreting them in the user's local timezone, while completion timestamps are stored in UTC. An admin endpoint allows safe deletion of all user data for testing purposes. The authentication flow guides users from marketing pages to login, then either to home for existing users or onboarding for new users. The database schema supports both legacy day-of-week and new date-based scheduling. Session update endpoints (POST and PATCH) explicitly exclude sessionType and workoutType from client payloads to prevent accidental overwrites. Cycle completion detection counts all non-archived workout sessions for the active program, correctly handling rescheduled workouts that fall outside the original selectedDates array. The "Repeat Same Days" flow presents a DayPicker dialog for selecting new workout dates for the next cycle.

### Feature Specifications
- **Data Model**: Includes Users, Fitness Assessments, Exercise Database, Workout Programs, and Performance Tracking. Workout sessions are pre-generated with `scheduledDate`, enforcing a one-session-per-day rule. User profile tracks `cycleNumber` and `totalWorkoutsCompleted` with `selectedDates` for the current cycle.
- **Comprehensive Fitness Assessment System**: Onboarding supports Bodyweight Test, Weights Test, or skip option. Assessment data maps to 10 independent movement patterns. Collects `daysPerWeek` (3, 4, or 5 days), comprehensive equipment selection, and session duration options (30, 45, 60, or 90 minutes). Users can retake tests anytime.
- **Template-Based Adaptive Training System**:
  - **Program Generation**: Algorithms select from prebuilt templates (Strength Primary, Cardio Primary, Hybrid Balance) to create custom 8-week programs based on user input.
  - **Science-Based Weekly Workout Structure**: Each workout day has a specific focus (squat, push, hinge, pull, athletic, unilateral). 3-Day: Squat/Push → Hinge/Pull → Balanced. 4-Day: Lower Squat → Upper Push → Lower Hinge → Upper Pull. 5-Day: Squat → Push → Hinge → Pull → Unilateral. Workout focus drives warmup, power, and core exercise selection for optimal training stimulus.
  - **Focus-Specific Warmup Sequences**: Deterministic warmup circuits matched to workout focus (not random). Squat/Push days use bodyweight squats and arm circles, Hinge/Pull days use hip bridges and scapular pull-ups, Athletic days use dynamic movements. Warmups automatically superseted in pairs for time efficiency.
  - **Workout-Focus-Based Power Selection**: Power movements match workout focus for CNS preparation. Squat/Push days use jump patterns, Hinge/Pull days use explosive hinge/pull movements, Athletic days use rotational throws. Power exercises capped at 2 maximum per workout for CNS safety.
  - **Anti-Movement Core Programming**: Core exercises selected based on anti-movement principles. Squat/Push days prioritize anti-extension (planks, rollouts), Hinge days use anti-lateral flexion (carries, side planks), Athletic days focus on anti-rotation (Pallof press, rotational movements).
  - **Week-Level Program Planning**: Plans entire week's movement pattern distribution before selecting exercises. Uses a 3-tier priority system (PRIMARY, SECONDARY, FALLBACK) for exercise selection.
  - **Goal-Based Programming**: Implements mixed strength/hypertrophy training where exercise parameters are determined by exercise type and training goal, with experience level affecting total sets.
  - **Exercise-Type Based Rest Periods**: Rest intervals are determined purely by exercise type and training goal.
  - **CNS-Ordered Workout Progression**: Professional programming structure follows Central Nervous System (CNS) demand hierarchy: warmup → power → compounds → isolations → core → cardio. Exercise selection is categorized by a single `exercise_category` field. Isolation and cardio counts are time-based to properly fill programs and support weight loss goals.
  - **Aggressive Superset Programming**: For shorter workouts (30-45 min), implements superset pairing of antagonistic movements for time efficiency.
  - **Percentage-Based Time Allocation System**: Uses an allocation matrix mapping nutrition goal × workout duration to component percentages (Warmup, Power, Strength, Cardio).
  - **Time-Based Fallback System**: Ensures workouts always meet target duration by adding compound exercises (or isolation if compounds unavailable) when a strength duration gap of ≥ 3 minutes is detected, prioritizing variety.
  - **Intelligent Workout Naming**: Generates descriptive workout names based on movement patterns and exercise content.
  - **Calendar-Aligned Session Generation**: Programs start on the user's current day, with sessions aligning with actual calendar dates.
  - **Smart Exercise Reuse Logic**: Implements hierarchical reuse rules to maximize workout variety while preventing fatigue. Compound and power exercises are blocked for the entire week, while isolation, core, and cardio exercises can be reused after a 2+ day gap. Cross-week recovery prevents reusing exercises from the last workout of the previous week.
  - **Progressive Overload**: Automatically adjusts exercise difficulty based on user performance.
  - **Intelligent Muscle Tracking System**: Prevents muscle overwork through dual-layer tracking: blocks duplicate primary muscle targeting within a session and prevents isolation of heavily worked muscles on consecutive days.
  - **7-Day Cycle System**: Users select specific calendar dates for their workouts. Upon cycle completion, the system prompts to "Repeat Same Days" or "New Program". Cycle number and total workouts completed are displayed for progress tracking.
  - **Daily Calendar Workflow**: Home page displays today's workout, allows adding cardio or marking rest days, and previews tomorrow's session.
  - **Automatic Missed Workout Rescheduling**: Automatically detects and moves missed workouts to today while preserving future workout dates.
  - **Flexible Exercise Swap System**: Allows swapping exercises with ALL available equipment types plus bodyweight options (always available). Each equipment variant displays as a separate swap option. Swaps work in both active workout sessions and program view, with changes persisting immediately to database.
- **Calorie Tracking System**: Incorporates MET calculations for calorie expenditure.
- **Goal-Based Cardio Variety System**: Implements cardio type rotation based on nutrition goal (GAIN, MAINTAIN, LOSE).
- **HIIT Interval Training System**: Supports HIIT with automated timers and custom intervals.
- **Unified Program Settings**: Settings page combines nutrition goals and workout preferences, triggering program regeneration.

## External Dependencies

- **UI Libraries**: Radix UI primitives, Recharts, date-fns, cmdk, Lucide React.
- **Form & Validation**: React Hook Form, Zod, Drizzle-Zod.
- **External Services**: Neon serverless (PostgreSQL).
- **Asset Management**: Stock images, Google Fonts (Inter, Roboto Mono).