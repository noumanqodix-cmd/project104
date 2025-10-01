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

**External Services (Planned)**
- Health data integration placeholders for Apple Health and Google Fit
- Video content for exercise form demonstrations (URLs configured in exercise data)
- AI-powered workout program generation (referenced in design and component structure)

**Asset Management**
- Stock images stored in attached_assets directory
- Google Fonts integration (Inter for UI, Roboto Mono for stats/numbers)
- Font preloading for performance optimization