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
PostgreSQL is the primary database, accessed via Drizzle ORM. The schema includes Users (with OIDC fields, `dateOfBirth`), Fitness Assessments, an Exercise Database (143 AI-generated exercises), Workout Programs (with history tracking), and Performance Tracking. User ages are dynamically calculated from `dateOfBirth`. Workout sessions are pre-generated with specific `scheduledDate` values for the entire program duration.

### AI-Powered Adaptive Training System
FitForge utilizes an AI (OpenAI GPT-4/GPT-4-mini) for personalized workout program generation and adaptation.
- **Test Type Selection**: Users choose between Bodyweight or Weights tests during onboarding.
- **Prebuilt Program Templates**: AI selects from three templates (Strength, Cardio, Hybrid Balance) based on user nutrition goals, populating them with exercises based on equipment and fitness level.
- **Intelligent Program Generation**: GPT-4 creates custom programs based on user input, including corrective exercises, with a typical duration of 8 weeks.
- **Smart Weight Recommendations**: AI calculates and recommends starting weights for exercises, utilizing 1RM data or bodyweight test results.
- **Master Exercise Database**: A pre-populated database of 143 exercises categorized by equipment and movement pattern is used for program generation.
- **Difficulty-Based Exercise Filtering (October 2025)**: Smart filtering system ensures exercises match user skill level for safety:
  - **Beginner users**: Only beginner-level exercises (78 exercises) to build proper movement foundations
  - **Intermediate users**: Beginner + intermediate exercises (150 exercises) for progressive challenge
  - **Advanced users**: Access to all difficulty levels (171 exercises) including complex movements
  - **Safety Override - Bodyweight Tests**: If bodyweight test results are weak (<5 pushups, <2 pullups, <15 squats), users are automatically restricted to beginner exercises regardless of self-reported experience
  - **Safety Override - Weighted Tests**: If 1RM lifts are below beginner standards relative to bodyweight, users are restricted to beginner exercises:
    - Squat 1RM < 1.0x bodyweight
    - Deadlift 1RM < 1.25x bodyweight
    - Bench Press 1RM < 0.75x bodyweight
    - Overhead Press 1RM < 0.5x bodyweight
    - Barbell Row 1RM < 0.75x bodyweight
  - **AI Integration**: Exercise lists are pre-filtered before being sent to GPT-4, ensuring the AI cannot recommend movements beyond user capability
  - **Implementation**: `server/ai-service.ts` applies difficulty filtering to all exercise categories (functional, warmup, cardio) with automatic unit conversion for accurate bodyweight ratio calculations
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