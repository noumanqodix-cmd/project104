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
  - **Time-Based Exercise Generation**: Dynamically calculates exercise counts based on `workoutDuration` to properly fill session time.
  - **Intelligent Workout Naming**: Generates descriptive workout names based on movement patterns and exercise content.
  - **Calendar-Aligned Session Generation**: Programs start on the user's current day, with sessions aligning with actual calendar dates, including rest days.
  - **Exercise Database**: 95 exercises categorized by equipment and movement pattern, supporting multi-equipment variations and including both compound and isolation movements. Isolation exercises are integrated strategically based on user level and assessment.
  - **Category-Specific Difficulty Filtering**: Enables independent progression across movement patterns (push, pull, squat, lunge, hinge, cardio, core, rotation, carry).
  - **Progressive Overload**: Automatically adjusts exercise difficulty based on user performance and Reps in Reserve (RIR).
  - **Daily Calendar Workflow**: Home page displays today's workout with completion states (Complete, Skipped, Pending). Provides options to add cardio or complete rest days, start/skip workouts. Always previews tomorrow's session.
  - **Missed Workout Detection & Recovery**: Automatically detects missed workouts from past dates and prompts users with options to reset the program from today or skip missed workouts.
- **Calorie Tracking System**: Incorporates MET calculations for calorie expenditure on both frontend and backend.
- **HIIT Interval Training System**: Supports HIIT with automated timers, common protocols, and custom intervals based on user's cardio equipment.

## External Dependencies

- **UI Libraries**: Radix UI primitives, Recharts, date-fns, cmdk, Lucide React.
- **Form & Validation**: React Hook Form, Zod, Drizzle-Zod.
- **Development Tools**: TypeScript, ESBuild, PostCSS.
- **External Services**: Neon serverless (PostgreSQL).
- **Asset Management**: Stock images, Google Fonts (Inter, Roboto Mono).