# FitForge - Personal Fitness Program Application

## Overview
FitForge is a mobile-first fitness application designed to create personalized workout programs. It guides users through an onboarding questionnaire, generates custom workout plans based on fitness levels, available equipment, and schedule, and provides tools for workout tracking and progress monitoring. The application adheres to Material Design principles, prioritizing quick data entry and functional clarity for an optimal gym experience. It also incorporates an AI-powered adaptive training system for intelligent program generation and progressive overload.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend uses React 18 with TypeScript, Vite for fast development, and Wouter for client-side routing. Server state management is handled by React Query. The UI is built with Shadcn/ui and Radix UI primitives, styled using Tailwind CSS, featuring a custom theme with light/dark modes and a Material Design-inspired color palette. The application structure includes a multi-step onboarding flow and primary views like Home, Workout, History (Workouts/Programs tabs), Body metrics, Settings (with Workout Preferences), and Progress visualization, utilizing a bottom navigation pattern.

### Backend
The backend is an Express.js server developed with TypeScript, handling JSON requests/responses with CORS support and custom logging. It integrates with Vite for development HMR and serves static files in production. Replit-specific plugins are used for development tooling.

### Data Storage
PostgreSQL is used as the primary database, configured via Neon serverless and accessed using Drizzle ORM for type-safe operations. The schema includes tables for Users, Fitness Assessments, an Exercise Database (143 AI-generated exercises), Workout Programs (with history tracking), and Performance Tracking (workout sessions and sets). Session management is database-backed using `connect-pg-simple` for persistent, cookie-based authentication.

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
- **Workout Progression Logic**: The home page shows the next actionable workout using intelligent backlog prioritization:
  - Missed workouts (no completed/skipped session) automatically carry forward to subsequent days
  - Backlog workouts (earlier in the week) have highest priority
  - Current day workout shown if no backlog exists
  - Future workouts shown only when backlog and current are complete
  - Skip functionality creates a session with status="skipped" and completed=1, advancing to next workout
  - Handles week wraparound correctly (e.g., missed Sunday shows on Monday)

## External Dependencies

- **UI Libraries**: Radix UI primitives, Recharts (data visualization), date-fns, cmdk (command palette), Lucide React (icons).
- **Form & Validation**: React Hook Form, Zod, Drizzle-Zod.
- **Development Tools**: TypeScript, ESBuild, PostCSS (with Tailwind and Autoprefixer), Path aliases.
- **External Services**: OpenAI API (GPT-4 for program generation, GPT-4-mini for suggestions), Neon serverless (PostgreSQL).
- **Asset Management**: Stock images (attached_assets), Google Fonts (Inter, Roboto Mono).