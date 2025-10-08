# FitForge - Personal Fitness Program Application

## Overview
FitForge is a mobile-first fitness application designed to create personalized workout programs. It guides users through an onboarding questionnaire, generates custom workout plans based on fitness levels, available equipment, and schedule, and provides tools for workout tracking and progress monitoring. The application incorporates an AI-powered adaptive training system for intelligent program generation and progressive overload, focusing on quick data entry and functional clarity.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React 18 with TypeScript, Vite, and Wouter for routing. React Query manages server state. The UI is built with Shadcn/ui and Radix UI, styled with Tailwind CSS, featuring a custom Material Design-inspired theme with light/dark modes. The application includes a multi-step onboarding flow and primary views such as Home, Workout, History, Body Metrics, Settings, and Progress visualization, utilizing a bottom navigation. All UI components display actual calendar dates for clarity (e.g., "Oct 7 - Oct 13" for week ranges, "Monday, October 7" for workout sessions).

### Backend
The backend is an Express.js server developed with TypeScript, handling JSON requests/responses with CORS support. It integrates with Vite for HMR and serves static files in production.

### Authentication
The application uses Replit Auth (OpenID Connect) for authentication, supporting multiple providers. It integrates with Passport.js for session management, storing OIDC subject claims (`req.user.claims.sub`) as `users.id` in the database. A secure onboarding flow connects user data with their authenticated profile.

### Data Storage
PostgreSQL is the primary database, accessed via Drizzle ORM. The schema includes Users (with OIDC fields, `dateOfBirth`), Fitness Assessments, an Exercise Database (163 AI-generated exercises with both functional and isolation work), Workout Programs (with history tracking), and Performance Tracking. User ages are dynamically calculated from `dateOfBirth`. Workout sessions are pre-generated with specific `scheduledDate` values for the entire program duration.

### AI-Powered Adaptive Training System
FitForge utilizes an AI (OpenAI GPT-4/GPT-4-mini) for personalized workout program generation and adaptation.
- **Test Type Selection**: Users choose between Bodyweight or Weights tests during onboarding.
- **Prebuilt Program Templates**: AI selects from three templates (Strength, Cardio, Hybrid Balance) based on user nutrition goals, populating them with exercises based on equipment and fitness level.
- **Intelligent Program Generation**: GPT-4 creates custom programs based on user input, including corrective exercises, with a typical duration of 8 weeks.
- **Smart Weight Recommendations**: AI calculates and recommends starting weights for exercises, utilizing 1RM data or bodyweight test results.
- **Master Exercise Database (October 2025)**: A comprehensive database of 163 exercises (updated from 143) categorized by equipment and movement pattern. Database now includes:
  - **Equipment Coverage**: 13 equipment types including cable machine (newly added: October 2025), dumbbells, barbell, kettlebell, resistance bands, pull-up bar, TRX, medicine ball, box, jump rope, foam roller, yoga mat, and bodyweight
  - **Exercise Types**: BOTH functional compound movements (Barbell Back Squat, Bench Press, Deadlift, Lat Pulldown) AND isolation exercises (Bicep Curls, Tricep Extensions, Lateral Raises, Leg Curls, Calf Raises, Chest Flyes)
  - **AI Generation Enhancement (October 2025)**: Updated generation prompts to explicitly request both functional (isFunctional: 1) and isolation (isFunctional: 0) exercises, addressing previous gap where only functional exercises were generated
  - **Essential Compound Exercises**: Generation now explicitly includes fundamental lifts (Barbell Back Squat, Barbell Bench Press, Barbell Deadlift, Bent-Over Row, Lat Pulldown) when applicable equipment is available
  - **Cable Machine Exercises**: Added cable machine equipment type with exercises like Cable Rows, Face Pulls, Cable Flyes, and Cable Curls
- **Intelligent Isolation Exercise Integration (October 2025)**: Strategic use of isolation exercises based on user fitness level and identified gaps:
  - **Level-Based Access**: Isolation exercises (isFunctional: 0) are generated as intermediate/advanced difficulty only, never beginner
  - **AI Strategic Decision-Making**: GPT-4 analyzes user fitness assessment data to intelligently decide when isolation exercises add value
  - **Agonist Superset Pairings**: When appropriate, isolation exercises are paired with compound movements in agonist supersets (e.g., Bench Press + Chest Flyes, Lat Pulldown + Bicep Curls)
  - **Weakness-Targeted Application**: Isolation used to address specific weaknesses (e.g., weak pullups → bicep curls, weak pushups → tricep extensions) or underrepresented muscle groups
  - **Smart Skipping Logic**: AI skips isolation for beginners (compound movements only), balanced programs, or users with limited time/equipment
  - **Exercise Pool Integration**: Program generation and exercise swap endpoints include both functional and isolation exercises, filtered by movement pattern difficulty
  - **Philosophy**: Not prescriptive - isolation exercises are used sparingly when they provide strategic value based on individual assessment data and gaps, not added to every workout
- **Category-Specific Difficulty Filtering (October 2025)**: Advanced filtering system enables independent progression across movement patterns for targeted safety and development:
  - **Movement Pattern Independence**: Each movement category (push, pull, squat, lunge, hinge, cardio, core, rotation, carry) has its own difficulty threshold based on related test results
  - **Push Exercises**: Difficulty controlled by pushup test (<5 reps) or bench/OHP 1RM ratios (bench <0.75x, OHP <0.5x bodyweight)
  - **Pull Exercises**: Difficulty controlled by pullup test (<2 reps) or barbell row 1RM ratio (<0.75x bodyweight)
  - **Squat/Lunge Exercises**: Difficulty controlled by bodyweight squat test (<15 reps) or squat 1RM ratio (<1.0x bodyweight)
  - **Hinge Exercises**: Difficulty controlled by bodyweight squat test (<15 reps, restricts hinge independently) or deadlift 1RM ratio (<1.25x bodyweight)
  - **Cardio Exercises**: Difficulty controlled by mile time (>12min = beginner, 9-12min = intermediate, <9min = advanced)
  - **Core/Rotation/Carry**: Uses user's self-reported fitness level or defaults to beginner for safety
  - **Independent Progression**: Users can be intermediate in upper body (good pushup/pullup scores) while beginner in lower body (weak squat scores), or vice versa
  - **Safety Override Logging**: System logs which specific metrics triggered difficulty restrictions for each movement pattern
  - **AI Integration**: Exercise lists are pre-filtered by movement pattern before being sent to GPT-4, with the AI receiving pattern-specific difficulty breakdowns
  - **Implementation (October 2025)**: Centralized helper functions in `shared/utils.ts` (`calculateMovementPatternLevels`, `getMovementDifficultiesMap`, `isExerciseAllowed`) provide consistent difficulty filtering across program generation (`server/ai-service.ts`), exercise swapping (`/api/exercises/similar` endpoint), and preview generation (`/api/programs/preview`). The ai-service.ts module has been refactored to use these shared utilities, eliminating duplicate logic and ensuring single source of truth for difficulty calculations. Automatic unit conversion ensures accurate bodyweight ratio calculations across all flows
  - **Exercise Swap Filtering**: The `/api/exercises/similar` endpoint applies the same movement pattern difficulty filtering as program generation, ensuring swapped exercises match user's pattern-specific fitness levels. Master exercise database remains unchanged; filtering is applied dynamically in-memory
  - **Preview Endpoint Enhancement**: The `/api/programs/preview` endpoint includes user weight, height, and dateOfBirth in tempUser object to enable accurate bodyweight ratio calculations during onboarding preview generation
- **Automatic Program Generation**: Programs are automatically generated and saved upon signup.
- **Progressive Overload System**: Automatically adjusts exercise difficulty based on user performance and Reps in Reserve (RIR).
- **Smart Workout Input**: Input fields dynamically adjust based on exercise equipment.
- **Program Management**: Users can regenerate programs via settings, archiving older versions.
- **Workout Progression Logic**: The home page displays the earliest incomplete workout session based on its `scheduledDate`, with skip functionality and program completion detection. Completed workouts are updated in existing sessions to prevent duplicates.

### Calorie Tracking System
FitForge incorporates a calorie expenditure tracking system using MET (Metabolic Equivalent of Task) calculations.
- **MET-Based Calculation**: `Calories burned = Duration (min) × ((MET × 3.5) × Weight (kg) / 200)`.
- **Automatic Intensity Mapping**: Programs are assigned MET values (Light: 3.5, Moderate: 5.0, Vigorous: 6.0, Circuit: 8.0).
- **Dual Calculation Approach**: Calories are calculated on both frontend (for immediate display) and backend (for consistency).
- **Unit Conversion**: Automatic conversion between imperial and metric units for accurate calculations.
- **UI Display**: Calories are shown in workout summaries, history, and a dedicated "Calories Burned" chart in the Progress View.

### HIIT Interval Training System
The application supports High-Intensity Interval Training (HIIT) with automated work/rest timers and multiple cardio equipment options.
- **Equipment Support**: 30 cardio exercises across 6 equipment types.
- **AI Generation**: GPT-4 generates HIIT exercises with common protocols (Tabata, Standard HIIT, Sprint Intervals) and custom intervals.
- **HIIT Interval Timer Component**: Provides an auto-cycling countdown timer with visual progress, pause/resume functionality, and set tracking.
- **Workout Integration**: Detects HIIT exercises and renders the `HIITIntervalTimer` instead of standard input fields.
- **Volume Tracking**: HIIT exercises do not contribute to total volume but preserve volume from strength exercises in mixed workouts.

## External Dependencies

- **UI Libraries**: Radix UI primitives, Recharts, date-fns, cmdk, Lucide React.
- **Form & Validation**: React Hook Form, Zod, Drizzle-Zod.
- **Development Tools**: TypeScript, ESBuild, PostCSS (with Tailwind and Autoprefixer).
- **External Services**: OpenAI API (GPT-4/GPT-4-mini), Neon serverless (PostgreSQL).
- **Asset Management**: Stock images, Google Fonts (Inter, Roboto Mono).