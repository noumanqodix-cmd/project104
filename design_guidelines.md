# Exercise App Design Guidelines

## Design Approach: Material Design System with Fitness App Conventions

**Rationale:** This is a utility-focused application where efficiency, data tracking, and usability are paramount. Following Material Design principles with inspiration from fitness leaders like Strong, Fitbod, and Nike Training Club ensures users can quickly log workouts, track progress, and navigate complex data structures with confidence.

**Core Design Principles:**
- Mobile-first: Primary use case is at the gym on a phone
- Clarity over decoration: Every element serves a functional purpose
- Quick data entry: Large touch targets, minimal taps to complete actions
- Motivational without distraction: Encouraging but focused on the workout

## Color Palette

**Dark Mode Primary (Default):**
- Background: 220 15% 12% (deep slate)
- Surface: 220 15% 16% (elevated slate)
- Primary: 142 76% 45% (vibrant green - represents growth/progress)
- Text Primary: 0 0% 98%
- Text Secondary: 0 0% 65%
- Accent: 28 88% 55% (energetic orange - for CTAs and alerts)
- Success: 142 76% 45% (green for completed sets)
- Warning: 45 93% 58% (yellow for rest timers)
- Error: 0 84% 60% (red for missed targets)

**Light Mode:**
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Primary: 142 71% 38% (deeper green)
- Text Primary: 220 15% 12%
- Text Secondary: 220 10% 40%

## Typography

**Font Stack:**
- Headers: Inter (bold, 600-700 weight) via Google Fonts
- Body: Inter (regular, 400-500 weight)
- Numbers/Stats: SF Mono or Roboto Mono for precise data display

**Scale:**
- Questionnaire Headers: text-3xl font-bold
- Dashboard Section Headers: text-2xl font-semibold
- Exercise Names: text-xl font-semibold
- Body Text: text-base
- Form Labels: text-sm font-medium uppercase tracking-wide
- Stats/Numbers: text-4xl font-bold (large impact for key metrics)
- Timer Display: text-6xl font-mono (high visibility during workout)

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16
- Card padding: p-6
- Section spacing: space-y-8
- Form field gaps: space-y-4
- Button padding: px-6 py-3
- Screen margins: px-4 md:px-6

**Containers:**
- Mobile: Full width with px-4 padding
- Desktop: max-w-4xl mx-auto for questionnaire/forms
- Dashboard: max-w-7xl mx-auto with grid layouts

## Component Library

### A. Navigation & Structure
**Top Navigation:**
- Fixed header with back button (left), title (center), menu/settings (right)
- Height: h-16
- Minimal shadow for depth: shadow-md
- Background: surface color with backdrop-blur

**Bottom Tab Bar (Dashboard):**
- Fixed bottom navigation with 4 tabs: Dashboard, Workout, History, Profile
- Icons + labels, h-20
- Active state: primary color with subtle indicator

### B. Forms & Input

**Questionnaire Cards:**
- Large, single-question cards that slide/fade between steps
- Full-screen mobile approach with progress dots at top
- Radio buttons: Large (h-12), rounded-lg, clear selection states
- Checkboxes (equipment): Grid layout (grid-cols-2), icon + label
- Number steppers: Large +/- buttons with centered value

**Fitness Test Input:**
- Exercise name at top (text-2xl)
- Large number input field (text-4xl, text-center)
- Unit label below (reps/minutes)
- "Next Exercise" button at bottom

**Nutrition Calculator:**
- Height/Weight: Split into two columns
- Goal selection: Three large cards (gain/maintain/lose)
- Results display: Card with BMR and calorie targets in large numbers

### C. Workout Components

**Exercise Card (Program View):**
- Elevated surface (shadow-lg)
- Exercise name (font-semibold)
- Equipment tag (small pill badge)
- Sets x Reps x Weight display
- Tempo notation (small, monospace)
- "Form Video" link with play icon
- "Swap Exercise" button (subtle, outline variant)

**Active Workout Screen:**
- Timer: Top, full-width, text-6xl, always visible
- Heart Rate: Below timer, real-time update
- Form Video: Center, aspect-video, rounded corners
- Set/Rep Input: Large input fields with + buttons
- Progress: "Set 1 of 3" indicator
- Rest Timer: Full-screen overlay when active (dramatic countdown)
- Next/Finish: Primary CTA button, w-full, large py-4

**Rest Timer Overlay:**
- Full-screen semi-transparent background
- Circular countdown animation (vibrant green border)
- Seconds remaining (text-8xl, center)
- "Skip Rest" button below
- Pulse animation as timer approaches zero

### D. Data Display & Progress

**Dashboard Cards:**
- Current program: Hero card with progress ring
- Quick stats: Grid of metric cards (workouts completed, streak, total volume)
- Next workout: Preview card with exercises listed
- Recent activity: Timeline/list view

**Progress Charts:**
- Line charts for weight progression per exercise
- Bar charts for volume over time
- Use primary color for data visualization
- Tooltips on hover/tap

**Workout Summary:**
- Celebratory header with emoji/icon
- Workout stats: Duration, exercises completed, total volume
- Difficulty rating: 5 large smiley faces (very easy → very hard)
- "Done" button returns to dashboard

### E. Authentication

**Sign Up Screen (Post-Questionnaire):**
- Clean, centered form on surface card
- "You're almost there!" motivational header
- Email/password fields
- Social login options (Google, Apple) via Replit Auth
- "Create Account" primary CTA

## Images

**Landing/Onboarding:**
- Hero image on initial app screen: Motivational fitness imagery (person working out, energetic)
- Questionnaire: Small icons for each question type (not photos)
- No large images during questionnaire flow (focus on speed)

**Throughout App:**
- Form videos: Embedded video players for exercise demonstrations
- Profile: User avatar (circular, 64x64)
- Progress: Optional small milestone badges/icons

## Key Interactions

**Animations:** Minimal and purposeful
- Page transitions: Smooth slide (200ms)
- Rest timer: Pulse/scale animation
- Set completion: Checkmark fade-in
- Success states: Brief green flash

**Feedback:**
- Haptic vibration on rest timer complete
- Audio beep on timer end
- Success toast on workout save
- Loading states for AI exercise swaps

**Touch Targets:**
- Minimum 44x44 pixels
- Extra padding around buttons during active workout (easy tapping while tired)

## Responsive Behavior

- Mobile (default): Single column, full-width components
- Tablet (md:): Two-column dashboard layout
- Desktop (lg:): max-w-4xl centered for most screens, wider dashboard (max-w-7xl)