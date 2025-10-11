// Shared constants for FitForge application
// Single source of truth for enums and reference data

// Nutrition Goals
export const NUTRITION_GOALS = ['GAIN', 'MAINTAIN', 'LOSE'] as const;
export type NutritionGoal = typeof NUTRITION_GOALS[number];

// Experience Levels
export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type ExperienceLevel = typeof EXPERIENCE_LEVELS[number];

// Unit Preferences
export const UNIT_PREFERENCES = ['imperial', 'metric'] as const;
export type UnitPreference = typeof UNIT_PREFERENCES[number];

// Days of the Week
export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday', 
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
] as const;
export type DayOfWeek = typeof DAYS_OF_WEEK[number];

// Cardio Types
export const CARDIO_TYPES = [
  'HIIT',
  'Steady State',
  'Zone 2',
  'Tempo',
  'Metabolic Circuits'
] as const;
export type CardioType = typeof CARDIO_TYPES[number];

// Movement Patterns (for exercise categorization)
export const MOVEMENT_PATTERNS = [
  'horizontal_push',
  'vertical_push',
  'pull',
  'squat',
  'lunge',
  'hinge',
  'core',
  'rotation',
  'carry',
  'cardio'
] as const;
export type MovementPattern = typeof MOVEMENT_PATTERNS[number];

// Session Duration Options (in minutes)
export const SESSION_DURATIONS = [30, 45, 60, 90] as const;
export type SessionDuration = typeof SESSION_DURATIONS[number];

// Days Per Week Options (strictly 3, 4, or 5 for optimal programming)
export const DAYS_PER_WEEK_OPTIONS = [3, 4, 5] as const;
export type DaysPerWeek = typeof DAYS_PER_WEEK_OPTIONS[number];

// Sex/Gender Options
export const SEX_OPTIONS = ['male', 'female'] as const;
export type Sex = typeof SEX_OPTIONS[number];

// Activity Levels (for BMR multiplier)
export const ACTIVITY_LEVELS = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active'
] as const;
export type ActivityLevel = typeof ACTIVITY_LEVELS[number];

// Activity Level Descriptions
export const ACTIVITY_LEVEL_INFO: Record<ActivityLevel, { label: string; multiplier: number; description: string }> = {
  sedentary: {
    label: 'Sedentary',
    multiplier: 1.2,
    description: 'Little or no exercise'
  },
  light: {
    label: 'Lightly Active',
    multiplier: 1.375,
    description: 'Light exercise 1-3 days/week'
  },
  moderate: {
    label: 'Moderately Active',
    multiplier: 1.55,
    description: 'Moderate exercise 3-5 days/week'
  },
  active: {
    label: 'Active',
    multiplier: 1.725,
    description: 'Hard exercise 6-7 days/week'
  },
  very_active: {
    label: 'Very Active',
    multiplier: 1.9,
    description: 'Very hard exercise & physical job'
  }
};

// Nutrition Goal Info
export const NUTRITION_GOAL_INFO: Record<NutritionGoal, { label: string; description: string }> = {
  GAIN: {
    label: 'Gain Weight/Muscle',
    description: 'Maximize strength volume, minimal cardio for muscle growth'
  },
  MAINTAIN: {
    label: 'Maintain Weight',
    description: 'Balanced strength and cardio for overall fitness'
  },
  LOSE: {
    label: 'Lose Weight/Fat',
    description: 'Maximize cardio for calorie burn with strength maintenance'
  }
};

// Experience Level Info
export const EXPERIENCE_LEVEL_INFO: Record<ExperienceLevel, { label: string; description: string }> = {
  beginner: {
    label: 'Beginner',
    description: 'New to fitness or returning after extended break'
  },
  intermediate: {
    label: 'Intermediate',
    description: 'Consistent training for 6+ months'
  },
  advanced: {
    label: 'Advanced',
    description: 'Years of consistent, structured training'
  }
};

// Workout Roles (for exercise categorization in workouts)
export const WORKOUT_ROLES = [
  'warmup',
  'power',
  'primary',
  'secondary',
  'isolation',
  'core',
  'cardio'
] as const;
export type WorkoutRole = typeof WORKOUT_ROLES[number];

// Exercise Difficulty Levels
export const DIFFICULTY_LEVELS = [
  'basic',
  'intermediate', 
  'advanced'
] as const;
export type DifficultyLevel = typeof DIFFICULTY_LEVELS[number];

// Tempo Notation (e.g., "2-0-1-0" = 2s eccentric, 0s pause, 1s concentric, 0s pause)
export type TempoNotation = string;

// Default Tempo by Role
export const DEFAULT_TEMPO_BY_ROLE: Record<WorkoutRole, TempoNotation> = {
  warmup: '1-0-1-0',
  power: '1-0-X-0', // X = explosive
  primary: '2-1-1-0', // Strength focus
  secondary: '2-0-2-0', // Hypertrophy focus
  isolation: '2-0-2-0', // Hypertrophy focus
  core: '2-0-2-0',
  cardio: '1-0-1-0'
};
