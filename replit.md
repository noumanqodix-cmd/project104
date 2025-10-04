# FitForge - Personal Fitness Program Application

## Overview

FitForge is a mobile-first fitness application that creates personalized workout programs based on user fitness levels, available equipment, and schedule constraints. The application guides users through an onboarding questionnaire, generates custom workout programs, and provides workout tracking with progress monitoring. Built with Material Design principles optimized for gym usage, it emphasizes quick data entry and functional clarity over decoration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server for fast hot module replacement
- Client-side routing using Wouter (lightweight alternative to React Router)
- React Query (@tanstack/react-query) for server state management and data fetching

**UI Component System**
- Shadcn/ui component library with Radix UI primitives for accessible, unstyled components
- Tailwind CSS for utility-first styling with custom design tokens
- New York style variant with extensive Radix UI components (Dialog, Dropdown, Popover, etc.)
- Custom theme system supporting light/dark modes with localStorage persistence
- Material Design-inspired color system with fitness-focused palette (vibrant green for progress, energetic orange for CTAs)

**Application Structure**
- Multi-step onboarding flow: Welcome → Questionnaire → Fitness Assessment → Nutrition → Equipment → Availability → Sign Up
- Main application views: Home dashboard, Workout session, History tracking, Body metrics, Progress visualization
- Bottom navigation pattern for primary mobile navigation
- Component-based architecture with reusable UI elements in `/components` directory

### Backend Architecture

**Server Framework**
- Express.js server with TypeScript
- HTTP server creation with route registration pattern
- JSON request/response handling with CORS support
- Custom request logging middleware for API endpoints

**Development Environment**
- Vite middleware integration for development HMR
- Separate development and production build processes
- Static file serving in production mode
- Replit-specific plugins for development tooling (cartographer, dev banner, runtime error overlay)

**Storage Layer**
- In-memory storage implementation (MemStorage class) as default
- Interface-based storage design (IStorage) allowing for database implementation swap
- User CRUD operations with UUID-based ID generation
- Prepared for database integration via storage interface

### Data Storage Solutions

**Database Configuration**
- PostgreSQL configured via Neon serverless (@neondatabase/serverless)
- Drizzle ORM for type-safe database operations
- WebSocket support for serverless Postgres connections
- Database schema defined in shared directory for client-server type sharing

**Schema Design**
- Users table with UUID primary keys, username (unique), and password fields
- Drizzle-Zod integration for runtime validation from database schema
- Schema exports typed insert and select types for type safety
- Migration system configured via drizzle-kit

**Session Management**
- Session storage configured for PostgreSQL via connect-pg-simple
- Cookie-based session handling with credentials included in fetch requests
- Session data persistence across application restarts

### External Dependencies

**Third-Party UI Libraries**
- Radix UI component primitives (@radix-ui/react-*) - 20+ accessible component packages
- Recharts for data visualization and progress charts
- date-fns for date formatting and manipulation
- cmdk for command palette functionality
- Lucide React for consistent icon system

**Form & Validation**
- React Hook Form (@hookform/resolvers) for form state management
- Zod for schema validation
- Drizzle-Zod for database-schema-to-validation bridge

**Development Tools**
- TypeScript with strict mode enabled
- ESBuild for server bundling
- PostCSS with Tailwind and Autoprefixer
- Path aliases configured (@/, @shared/, @assets/)

**External Services**
- OpenAI API integration for AI-powered workout program generation
  - GPT-4 model used for personalized program creation
  - GPT-4-mini for exercise swap suggestions and progression recommendations
  - JSON-structured responses for reliable parsing
- Health data integration placeholders for Apple Health and Google Fit (planned)
- Video content for exercise form demonstrations (planned)

**Asset Management**
- Stock images stored in attached_assets directory
- Google Fonts integration (Inter for UI, Roboto Mono for stats/numbers)
- Font preloading for performance optimization

## AI-Powered Adaptive Training System

FitForge now features a comprehensive AI-powered workout program generation system that creates personalized training plans and adapts based on user performance.

**Core Features:**
- **Intelligent Program Generation**: OpenAI GPT-4 creates customized workout programs based on:
  - User fitness level (from assessment test results)
  - Available equipment (dumbbells, barbell, kettlebell, resistance bands, etc.)
  - Workout duration preferences (30-90 minutes per session)
  - Nutrition goals (gain muscle, maintain weight, lose weight)
  - Emphasis on functional movement patterns (push, pull, hinge, squat, carry, rotation)
  - Corrective exercises to address movement imbalances

**Database Schema:**
- **Fitness Assessments**: Timestamped records of bodyweight tests (pushups, pullups, squats, mile run) and strength tests (1RM for major lifts)
- **Exercise Database**: 20+ functional exercises with movement pattern categorization, equipment requirements, difficulty levels, and form tips
- **Workout Programs**: Template structure linking users to AI-generated programs with weekly structure and duration
- **Performance Tracking**: Workout sessions and individual set tracking with weight, reps, and RIR (Reps in Reserve) data for progressive overload analysis

**API Endpoints:**
- POST `/api/programs/generate` - Generate new AI workout program
- GET `/api/programs/active` - Fetch user's active program
- GET `/api/programs/:id` - Get full program details with nested workouts and exercises
- POST `/api/fitness-assessments` - Save fitness test results
- GET `/api/fitness-assessments/latest` - Retrieve most recent assessment
- POST `/api/workout-sessions` - Create new workout session
- POST `/api/workout-sets` - Log individual set performance
- POST `/api/ai/progression-recommendation` - Get AI-powered weight/rep progression advice
- POST `/api/ai/exercise-swap` - Get alternative exercise suggestions

**Adaptive Features (Planned):**
- Automatic program regeneration when user completes new fitness assessment
- Progressive overload recommendations based on RIR data from completed workouts
- Intelligent exercise swaps based on available equipment and movement patterns
- Real-time workout adjustments based on performance fatigue