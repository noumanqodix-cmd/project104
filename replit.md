# FitForge - Personal Fitness Program Application

## Overview
FitForge is a mobile-first fitness application designed for personalized workout program generation. It guides users through an onboarding questionnaire, creates custom workout plans based on fitness levels, available equipment, and schedule, and provides tools for workout tracking and progress monitoring. The application utilizes a template-based adaptive training system for intelligent program generation and progressive overload, aiming for quick data entry and functional clarity to help users achieve their fitness goals.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend uses React 18 with TypeScript, Vite, Wouter for routing, and React Query for server state management. UI components are built with Shadcn/ui and Radix UI, styled with Tailwind CSS, featuring a custom Material Design-inspired theme with light/dark modes. Core views include Home, Workout, History, Body Metrics, Settings, and Progress visualization, accessible via bottom navigation. All UI components display actual calendar dates.

### Technical Implementations
The backend is an Express.js server developed with TypeScript, handling JSON requests/responses with CORS. It integrates with Vite for HMR and serves static files. Replit Auth (OpenID Connect) is used for authentication via Passport.js for session management. PostgreSQL is the primary database, accessed via Drizzle ORM. Performance optimizations include database-level query optimization, paginated API endpoints, combined home data endpoint, and optimized queries for recent sets and similar exercises. Data integrity is maintained through unique constraints and automatic duplicate session removal. Timezone-safe date handling uses YYYY-MM-DD strings for calendar dates, interpreting them in the user's local timezone, while completion timestamps are stored in UTC.

### Feature Specifications
- **Data Model**: Includes Users, Fitness Assessments, Exercise Database, Workout Programs, and Performance Tracking. Workout sessions are pre-generated with `scheduledDate`, enforcing a one-session-per-day rule.
- **Comprehensive Fitness Assessment System**: Onboarding supports Bodyweight Test, Weights Test, or an option to skip. Assessment data maps to 10 independent movement patterns. Collects `daysPerWeek` (3, 4, or 5 days only), `selectedDays`, comprehensive equipment selection (17 options), and session duration options (30, 45, 60, or 90 minutes).
- **Template-Based Adaptive Training System**:
  - **Program Generation**: Algorithms select from prebuilt templates (Strength Primary, Cardio Primary, Hybrid Balance) to create custom 8-week programs based on user equipment, fitness level, and schedule. Supports 3, 4, or 5 days per week.
  - **Week-Level Program Planning**: Plans entire week's movement pattern distribution before selecting exercises for recovery and variety. Uses a 3-tier priority system (PRIMARY, SECONDARY, FALLBACK) for exercise selection.
  - **Goal-Based Programming**: Implements mixed strength/hypertrophy training where exercise parameters are determined by exercise type and training goal, with experience level only affecting total sets (-1 for beginners).
  - **Exercise-Type Based Rest Periods**: Rest intervals are determined purely by exercise type and training goal.
  - **Precise Time Calculation System**: Uses `calculateExerciseTime()` helper to accurately compute workout duration.
  - **Power Movement Integration**: Adds explosive power training with 48 power exercises across movement patterns, including Olympic lift variations with safety warnings.
  - **CNS-Ordered Workout Progression**: Professional programming structure follows Central Nervous System (CNS) demand hierarchy: warmup → power → compounds → isolations → core → cardio finisher. 
    - **3-Phase Exercise Selection**: Workout generation separates exercises into CNS-ordered phases: Phase 1 (compounds only), Phase 2 (non-core isolations), Phase 3 (core/rotation/carry accessories). Each phase excludes power exercises which are handled separately.
    - **Power Movement Matching**: Power exercises preview compound patterns from Phase 1, then match explosive movements to prep the CNS (e.g., power hinge before compound hinge).
    - **Metadata-Based Reordering**: Exercises tagged with source exercise_category and movement pattern during selection to prevent misclassification from name variations (e.g., "Plank [Alt]" retains core category metadata).
    - **Phase-Aware Fallback**: Time-based fallback only adds non-power compounds to maintain CNS ordering, preventing core/isolation exercises from filling compound gaps.
    - **Single-Field Exercise Categorization**: All exercises classified using single exercise_category field (warmup|power|compound|isolation|core|cardio) that determines both workout placement and programming parameters. This replaces the previous 4-field system (isPower, liftType, exercise_type, workout_type) for cleaner logic and easier maintenance.
  - **Aggressive Superset Programming**: For shorter workouts (30-45 min), implements superset pairing of antagonistic movements for time efficiency.
  - **Percentage-Based Time Allocation System**: Uses allocation matrix mapping nutrition goal × workout duration to component percentages (Warmup, Power, Strength, Cardio) to ensure optimal time utilization.
  - **Time-Based Fallback System**: Ensures workouts always meet target duration even when limited exercises are available. After main exercise selection and backfill, system calculates actual strength block duration using `calculateExerciseTime()` and compares to allocated `strengthTimeBudget`. **Activation threshold**: Triggers when gap ≥ 3 minutes. **Pattern prioritization**: Creates Map tracking pattern usage in current workout, sorts all available patterns by least-used first to maximize variety. **Exercise addition**: Iterates through sorted patterns, adding compound exercises (or isolation if compounds unavailable) from each pattern while avoiding duplicates via `usedExerciseIds`. **Stop condition**: Continues until actual strength duration is within 1 minute of strength time budget target. **Critical constraint**: Targets only the strength block before warmups, power, and cardio are added, preventing both under-filled workouts (e.g., beginner hinge scenarios with only 5 exercises) and duration overshoot (since warmup/power/cardio time budgets are added afterward). **Diagnostic logging**: Tracks gap detection (`[FALLBACK] Strength duration gap detected`), pattern usage distribution, each exercise added with time contribution, and final strength duration vs target.
  - **Intelligent Workout Naming**: Generates descriptive workout names based on movement patterns and exercise content.
  - **Calendar-Aligned Session Generation**: Programs start on the user's current day, with sessions aligning with actual calendar dates.
  - **Exercise Database**: 196 exercises categorized by equipment, movement pattern, and exercise_category (21 warmup, 48 power, 37 compound, 34 isolation, 26 core, 30 cardio), supporting multi-equipment variations across all training modalities.
  - **Category-Specific Difficulty Filtering**: Enables independent progression across movement patterns.
  - **Smart Exercise Reuse Logic**: Implements hierarchical reuse rules to maximize workout variety while preventing fatigue. **Compound and power exercises** are blocked for entire week once used. **Isolation, core, and cardio exercises** can be reused after 2+ day gap, allowing accessories to repeat while preserving freshness. **Cross-week recovery** prevents last workout from reusing first workout's exercises. All exercises tracked immediately upon selection via callback functions to prevent tracking gaps across selection phases (required movements, pattern tiers, backfill, fallback).
  - **Progressive Overload**: Automatically adjusts exercise difficulty based on user performance.
  - **Comprehensive Isolation Exercise Database**: Database contains 34 isolation exercises across all movement patterns (Pull, Horizontal Push, Vertical Push, Squat, Hinge) plus 26 dedicated core exercises (core/rotation/carry patterns). This comprehensive database enables the fallback system to effectively fill 4-5 day programs even when compound exercises are exhausted, with isolation and core exercises available for smart reuse after 2+ day gaps.
  - **Intelligent Muscle Tracking System**: Prevents muscle overwork through dual-layer tracking: **Within-workout muscle filtering** blocks duplicate primary muscle targeting in same session (e.g., prevents two calf isolation exercises, two bicep curls, or multiple core exercises targeting same primary muscles). System tracks `usedPrimaryMuscles` Set throughout workout generation and filters isolation exercises whose primary muscles are already primary targets. **Consecutive day muscle recovery** tracks heavily worked muscles (3+ sets as primary) from previous training day via `previousDayMuscles` Set, preventing isolation of same muscles on next day (e.g., if traps were worked heavily on Day 3, isolation exercises targeting traps are filtered on Day 4). Rest days trigger full muscle recovery by clearing the tracking Set. Muscle checks occur at all 7 exercise selection points (required movements, tier selection, backfill, fallback, power, cardio) with re-validation inside loops to handle multiple exercises from same pattern. Allows primary+secondary muscle overlap (e.g., squat + calf raise) while blocking duplicate primary isolation.
  - **Daily Calendar Workflow**: Home page displays today's workout with completion states, options to add cardio or complete rest days, and previews tomorrow's session.
  - **Cardio Type Selection for Rest Days**: Users can manually add HIIT, Steady State, or Zone 2 cardio to rest days.
  - **Missed Workout Detection & Recovery**: Automatically detects missed workouts and prompts users with options to reset or skip.
- **Calorie Tracking System**: Incorporates MET calculations for calorie expenditure.
- **Goal-Based Cardio Variety System**: Implements cardio type rotation based on nutrition goal (GAIN, MAINTAIN, LOSE) to optimize training adaptations.
- **HIIT Interval Training System**: Supports HIIT with automated timers and custom intervals.
- **Unified Program Settings**: Settings page combines nutrition goals and workout preferences, with changes triggering program regeneration and providing goal-specific information.

## External Dependencies

- **UI Libraries**: Radix UI primitives, Recharts, date-fns, cmdk, Lucide React.
- **Form & Validation**: React Hook Form, Zod, Drizzle-Zod.
- **Development Tools**: TypeScript, ESBuild, PostCSS.
- **External Services**: Neon serverless (PostgreSQL).
- **Asset Management**: Stock images, Google Fonts (Inter, Roboto Mono).