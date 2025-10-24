// ==========================================
// WORKOUT PROGRAM GENERATOR - THE "BRAIN" OF Morphit
// ==========================================
// This file contains the core algorithm that creates personalized workout programs
// It's like having a personal trainer that knows your fitness level, available equipment,
// and goals - then builds you a complete 8-week training plan
//
// WHAT IT DOES:
// 1. Takes your profile (fitness level, equipment, schedule, goals)
// 2. Analyzes your fitness test results to understand your strengths/weaknesses
// 3. Selects appropriate exercises from a database of 196+ movements
// 4. Creates balanced workouts following professional programming principles
// 5. Ensures variety, progression, and proper recovery
//
// KEY PRINCIPLES:
// - CNS-Ordered Progression: Exercises ordered by nervous system demand (explosive → compound → isolation → core)
// - Pattern Balance: All 10 movement patterns trained each week (push, pull, squat, hinge, etc.)
// - Smart Reuse: Compound exercises don't repeat within a week; accessories can repeat after 2 days
// - Time Precision: Workouts precisely match your selected duration (30/45/60/90 min)
// - Progressive Overload: Difficulty increases as you get stronger
// ==========================================

// Import data types (think of these as "blueprints" for our data)
import type { User, FitnessAssessment, Exercise } from "@shared/schema";

// Import the template selection system (chooses strength/cardio/hybrid focus)
import { selectProgramTemplate, type ProgramTemplate } from "./programTemplates";

// Import helper functions that calculate difficulty levels and validate exercises
import { 
  calculateMovementPatternLevels,  // Converts test results to skill levels per movement
  getMovementDifficultiesMap,      // Maps skill levels to exercise difficulties
  isExerciseAllowed,               // Checks if user has equipment & skill for an exercise
  sortExercisesByDifficultyPriority // Prioritizes exercises by difficulty rating
} from "@shared/utils";

// Import constant values used throughout the app
import { 
  EXPERIENCE_LEVELS,  // beginner, intermediate, advanced
  NUTRITION_GOALS,    // gain, maintain, lose
  MOVEMENT_PATTERNS,  // The 10 foundational movement patterns
  CARDIO_TYPES,       // HIIT, steady state, zone 2
  type ExperienceLevel, 
  type NutritionGoal 
} from "@shared/constants";

// ==========================================
// DATA STRUCTURES (TypeScript Interfaces)
// ==========================================
// These define the "shape" of data we work with - like forms that data must fill out

// INPUT: What we need to generate a program
export interface ProgramGenerationInput {
  user: User;                           // User's profile (name, goals, equipment, schedule)
  latestAssessment: FitnessAssessment;  // Most recent fitness test results
  availableExercises: Exercise[];       // Full exercise database filtered by user's equipment
  selectedDates?: string[];             // NEW: Array of YYYY-MM-DD strings for scheduled workout dates
}

// OUTPUT: The complete program we create
export interface GeneratedProgram {
  programType: string;       // e.g., "Strength Primary" or "Cardio Primary"
  weeklyStructure: string;   // e.g., "3 Day Split" or "5 Day Full Body"
  durationWeeks: number;     // Always 8 weeks
  workouts: GeneratedWorkout[];  // Array of all individual workouts
}

// Each workout in the program
export interface GeneratedWorkout {
  dayOfWeek?: number;        // LEGACY: 0=Sunday, 1=Monday, etc. (kept for backwards compatibility)
  workoutIndex?: number;     // NEW: Sequential workout number (1, 2, 3, ..., N) where N = daysPerWeek
  workoutName: string;       // Descriptive name like "Workout 1 - Upper Body Push"
  workoutType: "strength" | "cardio" | "hiit" | "mobility" | null;
  movementFocus: string[];   // Which movement patterns this workout trains
  exercises: GeneratedExercise[];  // List of exercises in this workout
}

// Each exercise within a workout
export interface GeneratedExercise {
  exerciseName: string;      // Name of the exercise (e.g., "Barbell Squat")
  equipment: string;         // Specific equipment to use (from user's available equipment)
  
  // VOLUME (How much work to do)
  sets: number;              // Number of sets (e.g., 3 sets)
  repsMin?: number;          // Minimum reps per set (e.g., 8)
  repsMax?: number;          // Maximum reps per set (e.g., 12) → creates a range like "8-12 reps"
  durationSeconds?: number;  // For timed exercises like planks (e.g., 60 seconds)
  
  // INTENSITY (How hard to work)
  recommendedWeight?: number;  // Starting weight in user's units (lbs or kg)
  targetRPE?: number;          // Rate of Perceived Exertion: 1-10 scale (10 = maximum effort)
  targetRIR?: number;          // Reps in Reserve: how many more reps you could do (0-5)
  
  // TIMING & TECHNIQUE
  restSeconds: number;         // Rest between sets (e.g., 90 seconds)
  workSeconds?: number;        // For HIIT: active work interval (e.g., 30 seconds on)
  tempo?: string;              // Lifting speed notation (e.g., '2-0-2-0' = 2sec down, 0 pause, 2sec up, 0 pause)
  
  // ORGANIZATION
  notes?: string;              // Special instructions or safety tips
  isWarmup?: boolean;          // True if this is a warmup exercise
  supersetGroup?: string;      // "A", "B", "C" - exercises with same letter done back-to-back
  supersetOrder?: number;      // 1 or 2 - order within the superset pair
  
  // METADATA (Used for proper exercise ordering)
  sourceExerciseCategory?: string;  // warmup | power | compound | isolation | core | cardio
  sourceMovementPattern?: string;   // Which movement pattern this trains (squat, hinge, push, etc.)
}

// ==========================================
// HELPER FUNCTION: Generate Workout Names
// ==========================================
// Creates descriptive workout names based on which movement patterns are included
// Example: If workout has squat + hinge + pull patterns → "Full Body Strength"
//
// INPUT: 
//   - movementFocus: Array of movement patterns in this workout (e.g., ["squat", "hinge", "pull"])
//   - workoutType: Type of workout (strength, cardio, hiit, mobility)
// OUTPUT: Descriptive name string (e.g., "Upper Body Push")
function generateWorkoutName(movementFocus: string[], workoutType: "strength" | "cardio" | "hiit" | "mobility" | null): string {
  
  // Remove duplicates from the movement list (in case squat appears twice)
  const uniquePatterns = Array.from(new Set(movementFocus));
  
  // Special case: Cardio/HIIT workouts get a simple name
  if (workoutType === "cardio" || workoutType === "hiit") {
    return "Cardio & Conditioning";
  }
  
  // Categorize the movements into body regions
  // Check if workout includes upper body pushing (chest, shoulders)
  const upperPush = uniquePatterns.filter(p => ["horizontal_push", "vertical_push"].includes(p)).length > 0;
  
  // Check if workout includes upper body pulling (back, biceps)
  const upperPull = uniquePatterns.filter(p => ["horizontal_pull", "vertical_pull"].includes(p)).length > 0;
  
  // Check if workout includes lower body movements (legs, glutes)
  const lowerBody = uniquePatterns.filter(p => ["squat", "lunge", "hinge"].includes(p)).length > 0;
  
  // Check if workout includes core/rotation exercises
  const core = uniquePatterns.filter(p => ["core", "rotation"].includes(p)).length > 0;
  
  // Check if cardio is mixed in with strength work
  const cardioIncluded = uniquePatterns.filter(p => p === "cardio").length > 0;
  
  // Generate descriptive name based on which body regions are trained
  // Priority order: Full body → Upper body → Lower body → Specific focus
  
  // Full body workout (all 3 regions: push + pull + legs)
  if (upperPush && upperPull && lowerBody) {
    return "Full Body Strength";
  }
  
  // Upper body push only (chest, shoulders, triceps)
  if (upperPush && !upperPull && !lowerBody) {
    return core ? "Push & Core" : "Upper Body Push";
  }
  
  // Upper body pull only (back, biceps)
  if (upperPull && !upperPush && !lowerBody) {
    return core ? "Pull & Core" : "Upper Body Pull";
  }
  
  // Upper body combined (push + pull, no legs)
  if (upperPush && upperPull && !lowerBody) {
    return "Upper Body Power";
  }
  
  // Lower body only (quads, glutes, hamstrings)
  if (lowerBody && !upperPush && !upperPull) {
    return core ? "Lower Body & Core" : "Lower Body Strength";
  }
  
  // Mixed lower + upper (full body with cardio)
  if (lowerBody && (upperPush || upperPull)) {
    if (cardioIncluded) {
      return "Total Body Conditioning";  // Includes cardio finisher
    }
    return "Full Body Power";
  }
  
  // Safety fallback (should rarely hit this)
  return "Strength Training";
}

// ==========================================
// HELPER FUNCTION: Select Exercises by Movement Pattern
// ==========================================
// Picks exercises for a specific movement pattern (e.g., "squat" or "pull")
// Prioritizes compound exercises over isolation for better efficiency
//
// EXAMPLE: Need 2 squat exercises → First picks "Back Squat" (compound), then "Leg Press" (compound)
//          If we run out of compounds, picks "Leg Extension" (isolation)
//
// INPUT:
//   - exercises: Full list of available exercises
//   - pattern: Movement pattern to filter by (e.g., "squat", "hinge", "pull")
//   - count: How many exercises we need
//   - canUseExerciseFn: Function that checks if exercise is allowed (equipment, difficulty, muscle recovery)
//   - onSelectFn: Optional callback to track selected exercises (prevents reuse)
// OUTPUT: Array of selected exercises (may be less than count if not enough available)
function selectExercisesByPattern(
  exercises: Exercise[],
  pattern: string,
  count: number,
  canUseExerciseFn: (exercise: Exercise) => boolean,
  onSelectFn?: (exerciseId: string, primaryMuscles?: string[], exercisePattern?: string, exerciseCategory?: string) => void
): Exercise[] {
  
  // STEP 1: Filter to only exercises that match the pattern AND pass our checks
  // Example: If pattern is "squat", only get squat exercises user can do
  const available = exercises.filter(
    ex => ex.movementPattern === pattern && canUseExerciseFn(ex)
  );
  
  // STEP 2: Separate compounds from isolations
  // Compounds work multiple muscles (more bang for your buck)
  const compound = available.filter(ex => ex.exerciseCategory === 'compound');
  // Isolations work single muscles (used for targeted work)
  const isolation = available.filter(ex => ex.exerciseCategory === 'isolation');
  
  const selected: Exercise[] = [];
  
  // STEP 3: Prioritize compound exercises first
  // Why? They're more efficient - one compound exercise does the work of 2-3 isolations
  for (const ex of compound) {
    if (selected.length >= count) break;  // Stop when we have enough
    
    // Double-check: Muscle tracking may have changed since initial filter
    // Example: If biceps were just used, this prevents another bicep exercise
    if (!canUseExerciseFn(ex)) continue;
    
    selected.push(ex);  // Add to our workout
    
    // Track immediately to prevent this exercise from being used again too soon
    if (onSelectFn) onSelectFn(ex.id, ex.primaryMuscles, ex.movementPattern, ex.exerciseCategory);
  }
  
  // STEP 4: Fill remaining slots with isolation exercises if needed
  // Only happens if we need more exercises and ran out of compounds
  for (const ex of isolation) {
    if (selected.length >= count) break;
    
    // Same double-check as compounds
    if (!canUseExerciseFn(ex)) continue;
    
    selected.push(ex);
    // Track to prevent reuse
    if (onSelectFn) onSelectFn(ex.id, ex.primaryMuscles, ex.movementPattern, ex.exerciseCategory);
  }
  
  return selected;  // Return our final exercise list
}

// ==========================================
// HELPER FUNCTION: Identify Weak Movement Patterns
// ==========================================
// Analyzes fitness test results to find which movements need extra work
// Weak patterns may get superset training for efficiency (intermediate/advanced only)
//
// EXAMPLE: If you only did 25 push-ups but need 30 → "horizontal_push" is weak
//          This might trigger superset training to bring it up faster
//
// INPUT:
//   - assessment: Fitness test results (push-ups, pull-ups, squats, etc.)
//   - user: User profile (for experience level)
// OUTPUT: Array of weak movement pattern names (e.g., ["horizontal_push", "squat"])
function identifyWeakMovementPatterns(assessment: FitnessAssessment, user: User): string[] {
  const weakPatterns: string[] = [];
  const experienceLevel = assessment.experienceLevel || user.fitnessLevel || "beginner";
  
  // IMPORTANT: Beginners don't get supersets
  // Why? They need full recovery between sets to build proper form and work capacity
  // Supersets (back-to-back exercises) are for intermediate+ lifters only
  if (experienceLevel === "beginner") {
    return [];  // No weak patterns identified = no supersets
  }
  
  // Performance thresholds for each experience level
  // If you score below these, that movement is considered "weak"
  const thresholds = {
    intermediate: {
      pushups: 30,      // Need 30+ push-ups to be "strong" at horizontal push
      pullups: 8,       // Need 8+ pull-ups to be "strong" at pulling
      squats: 50,       // Need 50+ air squats to be "strong" at squatting
      plankHold: 60,    // Need 60+ seconds plank to be "strong" at core
    },
    advanced: {
      pushups: 50,      // Advanced lifters need higher standards
      pullups: 15,
      squats: 75,
      plankHold: 90,
    },
  };
  
  // Get the appropriate threshold for this user's level
  const threshold = thresholds[experienceLevel as 'intermediate' | 'advanced'] || thresholds.intermediate;
  
  // Check each movement pattern against thresholds
  
  // Horizontal Push (chest, triceps) - measured by push-ups
  if (assessment.pushups !== null && assessment.pushups !== undefined && assessment.pushups < threshold.pushups) {
    weakPatterns.push('horizontal_push');
  }
  
  // Vertical Push (shoulders) - measured by pike push-ups
  // Note: Pike push-ups are harder, so threshold is 75% of regular push-ups
  if (assessment.pikePushups !== null && assessment.pikePushups !== undefined && assessment.pikePushups < (threshold.pushups * 0.75)) {
    weakPatterns.push('vertical_push');
  }
  
  // Vertical Pull (lats, biceps) - measured by pull-ups
  if (assessment.pullups !== null && assessment.pullups !== undefined && assessment.pullups < threshold.pullups) {
    weakPatterns.push('vertical_pull');
  }
  
  // Squat (quads, glutes) - measured by air squats
  if (assessment.squats !== null && assessment.squats !== undefined && assessment.squats < threshold.squats) {
    weakPatterns.push('squat');
  }
  
  // Check core strength
  if (assessment.plankHold !== null && assessment.plankHold !== undefined && assessment.plankHold < threshold.plankHold) {
    weakPatterns.push('core');
  }
  
  return weakPatterns;
}

// Helper function to select appropriate equipment for an exercise based on user's available equipment
function selectExerciseEquipment(exercise: Exercise, userEquipment: string[]): string {
  if (!exercise.equipment || exercise.equipment.length === 0) {
    return "bodyweight";
  }
  
  // First, try to find equipment the user actually has
  for (const eq of exercise.equipment) {
    if (userEquipment?.includes(eq) || eq === "bodyweight") {
      return eq;
    }
  }
  
  // Fallback: if no match, prefer bodyweight if available
  if (exercise.equipment.includes("bodyweight")) {
    return "bodyweight";
  }
  
  // Last resort: return first equipment option (shouldn't happen if filtering is correct)
  return exercise.equipment[0];
}

// Helper function to find isolation exercise for superset pairing
function findIsolationExercise(
  pattern: string,
  availableExercises: Exercise[],
  usedExerciseIds: Set<string>,
  userEquipment: string[]
): Exercise | null {
  const isolationExercises = availableExercises.filter(ex => 
    ex.movementPattern === pattern &&
    ex.exerciseCategory === 'isolation' &&
    !usedExerciseIds.has(ex.id) &&
    ex.equipment?.some(eq => userEquipment?.includes(eq) || eq === 'bodyweight')
  );
  
  return isolationExercises.length > 0 ? isolationExercises[0] : null;
}

// Helper function to calculate precise exercise time in minutes
function calculateExerciseTime(params: {
  sets: number;
  repsMin?: number;
  repsMax?: number;
  durationSeconds?: number;
  workSeconds?: number;
  restSeconds: number;
}): number {
  const TRANSITION_TIME = 1.0; // 1 minute for setup between exercises
  const SECONDS_PER_REP = 2.5; // Average time per rep
  
  // Calculate work time per set
  let workTimePerSet: number;
  
  if (params.durationSeconds) {
    // Duration-based exercises (planks, holds)
    workTimePerSet = params.durationSeconds / 60; // Convert to minutes
  } else if (params.workSeconds) {
    // HIIT intervals: work × sets + rest × (sets - 1)
    const totalWorkTime = (params.workSeconds * params.sets) / 60; // Convert to minutes
    const totalRestTime = (params.restSeconds * (params.sets - 1)) / 60; // Rest between intervals only
    return totalWorkTime + totalRestTime + TRANSITION_TIME;
  } else if (params.repsMin && params.repsMax) {
    // Rep-based exercises - use average reps
    const avgReps = (params.repsMin + params.repsMax) / 2;
    workTimePerSet = (avgReps * SECONDS_PER_REP) / 60; // Convert to minutes
  } else {
    // Fallback - estimate 45 seconds per set
    workTimePerSet = 0.75;
  }
  
  // Calculate total time: (work × sets) + (rest × (sets - 1)) + transition
  const totalWorkTime = workTimePerSet * params.sets;
  const totalRestTime = (params.restSeconds / 60) * (params.sets - 1);
  
  return totalWorkTime + totalRestTime + TRANSITION_TIME;
}

// Helper function to assign training parameters based on exercise type and training goal
function assignTrainingParameters(
  exercise: Exercise,
  fitnessLevel: string,
  template: ProgramTemplate,
  assessment: FitnessAssessment,
  user: User,
  exerciseRole: 'power' | 'primary-compound' | 'secondary-compound' | 'isolation' | 'core-accessory' | 'warmup' | 'cardio',
  supersetGroup?: string,
  supersetOrder?: number,
  cardioDuration?: number  // Duration in minutes for cardio exercises
): {
  sets: number;
  repsMin?: number;
  repsMax?: number;
  restSeconds: number;
  targetRPE?: number;
  targetRIR?: number;
  recommendedWeight?: number;
  durationSeconds?: number;
  workSeconds?: number;
  tempo?: string;
  supersetGroup?: string;
  supersetOrder?: number;
} {
  
  // Power exercises - explosive movements with max intent
  if (exerciseRole === 'power' || exercise.exerciseCategory === 'power') {
    const powerParams = {
      beginner: { sets: 2, repsMin: 3, repsMax: 3, restSeconds: 60 },     // 2x3 @ 60s rest
      intermediate: { sets: 2, repsMin: 2, repsMax: 3, restSeconds: 60 }, // 2x2-3 @ 60s rest  
      advanced: { sets: 2, repsMin: 1, repsMax: 2, restSeconds: 60 }      // 2x1-2 @ 60s rest
    };
    
    const params = powerParams[fitnessLevel as keyof typeof powerParams] || powerParams.beginner;
    
    return {
      ...params,
      tempo: '1-0-X-0', // Explosive concentric, controlled eccentric
      targetRPE: 9, // Max effort, explosive intent
      targetRIR: 0, // All-out power development
    };
  }
  
  // Warmup exercises
  if (exerciseRole === 'warmup' || exercise.exerciseCategory === 'warmup') {
    return {
      sets: 2,
      repsMin: 10,
      repsMax: 15,
      restSeconds: 30,
      tempo: '1-0-1-0', // Faster tempo for warmups
    };
  }
  
  // HIIT/Cardio exercises - use goal-specific duration
  if (exerciseRole === 'cardio' || exercise.exerciseCategory === 'cardio') {
    if (exercise.trackingType === "duration") {
      // HIIT intervals - work/rest based on fitness level
      const workSeconds = fitnessLevel === "beginner" ? 20 : fitnessLevel === "intermediate" ? 30 : 40;
      const restSeconds = fitnessLevel === "beginner" ? 40 : fitnessLevel === "intermediate" ? 30 : 20;
      
      // Calculate sets based on allocated cardio duration
      // Formula: duration (min) = (workSeconds × sets + restSeconds × (sets-1)) / 60
      // Solving for sets: sets ≈ (duration × 60) / (workSeconds + restSeconds)
      const targetDurationSeconds = (cardioDuration || 8) * 60;
      const intervalDuration = workSeconds + restSeconds;
      const calculatedSets = Math.round(targetDurationSeconds / intervalDuration);
      
      return {
        sets: Math.max(6, Math.min(12, calculatedSets)), // Clamp between 6-12 sets
        workSeconds,
        restSeconds,
      };
    } else {
      // Rep-based cardio
      return {
        sets: 3,
        repsMin: 15,
        repsMax: 20,
        restSeconds: 60,
      };
    }
  }
  
  // Duration-based exercises (planks, holds, etc.) - treat as core/accessory
  if (exercise.trackingType === "duration" || exercise.name.toLowerCase().includes("plank") || exercise.name.toLowerCase().includes("hold")) {
    // Fallback duration based on fitness level (supports 30/45/60/90)
    const duration = fitnessLevel === "beginner" ? 30 : fitnessLevel === "intermediate" ? 45 : fitnessLevel === "advanced" ? 90 : 60;
    const sets = fitnessLevel === "beginner" ? 2 : 3;
    return {
      sets,
      durationSeconds: duration,
      restSeconds: 60, // Core work gets 60s rest
      tempo: 'Hold', // Duration-based holds
      targetRPE: template.intensityGuidelines.strengthRPE[0],
      targetRIR: template.intensityGuidelines.strengthRIR[1],
    };
  }
  
  // Goal-based programming: Sets, reps, and rest based on exercise role (not experience level)
  let sets: number, repsMin: number, repsMax: number, restSeconds: number;
  
  switch (exerciseRole) {
    case 'primary-compound':
      // Strength focus: Lower reps, 3-4 sets, longer rest
      sets = fitnessLevel === "beginner" ? 3 : 4;
      repsMin = 4;
      repsMax = 6;
      restSeconds = 180; // 3 minutes for primary compounds
      break;
      
    case 'secondary-compound':
      // Hypertrophy focus: Moderate reps, 3-4 sets
      sets = fitnessLevel === "beginner" ? 3 : 4;
      repsMin = 8;
      repsMax = 12;
      restSeconds = 90; // 90s for hypertrophy work
      break;
      
    case 'isolation':
      // Hypertrophy focus: Higher reps, 2 sets, shorter rest
      sets = 2;
      repsMin = 10;
      repsMax = 15;
      restSeconds = 60; // 60s for isolation work
      break;
      
    case 'core-accessory':
      // Endurance focus: Higher reps, fewer sets
      sets = fitnessLevel === "beginner" ? 2 : 3;
      repsMin = 12;
      repsMax = 20;
      restSeconds = 60; // 45-60s for accessory work
      break;
      
    default:
      // Fallback to hypertrophy
      sets = fitnessLevel === "beginner" ? 3 : 4;
      repsMin = 8;
      repsMax = 12;
      restSeconds = 90;
  }
  
  // Calculate recommended weight based on assessment data
  let recommendedWeight: number | undefined;
  
  // For compound and power movements, use 1RM data if available
  if ((exercise.exerciseCategory === 'compound' || exercise.exerciseCategory === 'power') && assessment) {
    const percentage = repsMax > 12 ? 0.65 : repsMax > 8 ? 0.75 : 0.80;
    
    if ((exercise.movementPattern === "horizontal_push" || exercise.movementPattern === "vertical_push") && assessment.benchPress1rm) {
      recommendedWeight = Math.round(assessment.benchPress1rm * percentage);
    } else if (exercise.movementPattern === "squat" && assessment.squat1rm) {
      recommendedWeight = Math.round(assessment.squat1rm * percentage);
    } else if (exercise.movementPattern === "hinge" && assessment.deadlift1rm) {
      recommendedWeight = Math.round(assessment.deadlift1rm * percentage);
    } else if ((exercise.movementPattern === "horizontal_pull" || exercise.movementPattern === "vertical_pull") && assessment.barbellRow1rm) {
      recommendedWeight = Math.round(assessment.barbellRow1rm * percentage);
    }
  }
  
  // Fallback: estimate weights from bodyweight test data
  if (!recommendedWeight && exercise.equipment?.some(eq => eq !== "bodyweight")) {
    if ((exercise.movementPattern === "horizontal_push" || exercise.movementPattern === "vertical_push") && assessment.pushups) {
      if (assessment.pushups < 15) recommendedWeight = user.unitPreference === "imperial" ? 50 : 22;
      else if (assessment.pushups < 30) recommendedWeight = user.unitPreference === "imperial" ? 75 : 34;
      else recommendedWeight = user.unitPreference === "imperial" ? 95 : 43;
    } else if ((exercise.movementPattern === "horizontal_pull" || exercise.movementPattern === "vertical_pull") && assessment.pullups !== undefined && assessment.pullups !== null) {
      if (assessment.pullups < 5) recommendedWeight = user.unitPreference === "imperial" ? 40 : 18;
      else if (assessment.pullups < 10) recommendedWeight = user.unitPreference === "imperial" ? 60 : 27;
      else recommendedWeight = user.unitPreference === "imperial" ? 80 : 36;
    } else if ((exercise.movementPattern === "squat" || exercise.movementPattern === "lunge" || exercise.movementPattern === "hinge") && assessment.squats) {
      if (assessment.squats < 25) recommendedWeight = user.unitPreference === "imperial" ? 65 : 29;
      else if (assessment.squats < 50) recommendedWeight = user.unitPreference === "imperial" ? 95 : 43;
      else recommendedWeight = user.unitPreference === "imperial" ? 135 : 61;
    }
  }
  
  // Assign tempo - use exercise's recommended tempo if available, otherwise use role-based tempo
  let tempo: string;
  if (exercise.recommendedTempo) {
    // Use exercise-specific tempo if defined in database
    tempo = exercise.recommendedTempo;
  } else {
    // Fall back to role-based tempo
    switch (exerciseRole) {
      case 'primary-compound':
        tempo = '2-1-1-0'; // Controlled eccentric, pause, explosive concentric
        break;
      case 'secondary-compound':
      case 'isolation':
      case 'core-accessory':
        tempo = '2-0-2-0'; // Controlled tempo for hypertrophy
        break;
      default:
        tempo = '2-0-2-0'; // Default hypertrophy tempo
    }
  }

  return {
    sets,
    repsMin,
    repsMax,
    restSeconds,
    tempo,
    targetRPE: template.intensityGuidelines.strengthRPE[fitnessLevel === "beginner" ? 0 : 1],
    targetRIR: template.intensityGuidelines.strengthRIR[fitnessLevel === "beginner" ? 1 : 0],
    recommendedWeight,
    supersetGroup,
    supersetOrder,
  };
}

// ==========================================
// MAIN FUNCTION: Generate Complete Workout Program
// ==========================================
// This is the entry point that creates your entire 8-week personalized workout plan
// Think of this as the conductor of an orchestra - it coordinates all the helper functions
// to create a balanced, progressive training program
//
// THE BIG PICTURE:
// 1. Validate user inputs (training days, duration, fitness level)
// 2. Determine which exercises are foundational for this user's level
// 3. Calculate difficulty ratings for each movement pattern
// 4. Select appropriate program template (strength/cardio/hybrid focus)
// 5. Generate individual workouts following CNS-ordered progression
// 6. Ensure variety and proper recovery between sessions
//
// INPUT: User profile + fitness assessment + available exercises
// OUTPUT: Complete 8-week program with daily workouts
//
// EXAMPLE FLOW:
// User: Intermediate, 4 days/week, 60 min workouts, has barbell
// → Selects "Strength Primary" template
// → Creates Mon/Wed/Fri/Sat workouts
// → Each workout: warmup → power → compounds → isolations → core → cardio
// → Total program: 32 workouts (4 per week × 8 weeks)
export async function generateWorkoutProgram(
  input: ProgramGenerationInput
): Promise<GeneratedProgram> {
  
  // ==========================================
  // STEP 1: EXTRACT AND VALIDATE USER DATA
  // ==========================================
  const { user, latestAssessment, availableExercises } = input;

  // Validate training frequency (only 3, 4, or 5 days supported)
  // Why these numbers? Research shows 3-5 days optimal for consistent progress
  // Less than 3 = not enough stimulus | More than 5 = recovery issues
  // If selectedDates is provided, use its length as the definitive daysPerWeek
  let daysPerWeek = input.selectedDates && input.selectedDates.length > 0 
    ? input.selectedDates.length 
    : (user.daysPerWeek || 3);
  
  if (![3, 4, 5].includes(daysPerWeek)) {
    console.warn(`[VALIDATION] Invalid daysPerWeek ${daysPerWeek}, defaulting to 3`);
    daysPerWeek = 3;  // Safe default for beginners
  }
  
  console.log(`[DAYS-PER-WEEK] Using daysPerWeek: ${daysPerWeek} (from ${input.selectedDates ? `selectedDates.length=${input.selectedDates.length}` : 'user.daysPerWeek'})`);
  
  // Determine fitness level (beginner, intermediate, or advanced)
  // This affects exercise selection, volume, and intensity
  const fitnessLevel = latestAssessment.experienceLevel || user.fitnessLevel || "beginner";
  
  // Get preferred workout duration (30, 45, 60, or 90 minutes)
  // This determines how many exercises we can fit in
  const workoutDuration = user.workoutDuration || 60; // Default to 1 hour

  // ==========================================
  // STEP 2: DEFINE REQUIRED WEEKLY MOVEMENTS
  // ==========================================
  // Every week MUST include these foundational exercises for balanced development
  // This prevents muscle imbalances and ensures all major movement patterns are trained
  //
  // WHY THIS MATTERS:
  // - Prevents "mirror muscle syndrome" (strong chest, weak back)
  // - Ensures functional strength (not just beach muscles)
  // - Reduces injury risk through balanced development
  //
  // EQUIPMENT MATCHING:
  // - Beginners get bodyweight/dumbbell versions (safer, build foundation)
  // - Intermediate/Advanced get barbell versions (more loading potential)
  const requiredMovements = {
    beginner: [
      { name: "Goblet Squat", pattern: "squat", alternatives: ["Squat", "Bodyweight Jump Squats"] },  // Bodyweight alternatives
      { name: "Lying Hip Bridge", pattern: "hinge" },  // Bodyweight exercise, no alternative needed
      { name: "Overhead Press", pattern: "vertical_push", alternatives: ["Pike Push-Up"] },  // Bodyweight shoulder press alternative
      { name: "Push-Up", pattern: "horizontal_push" },  // Already bodyweight
      { name: "Pull-Up", pattern: "vertical_pull", alternatives: ["Scapular Pull-Ups", "Standing Dumbbell Pullover", "Dumbbell Pullover to Press", "Resistance Band Lat Pulldown", "Band Assisted Pull-Up"] },  // Beginner vertical pull variations
      { name: "Bent-Over Row", pattern: "horizontal_pull", alternatives: ["Band-Resisted Fast Rows"] },  // Row variations
      { name: "Forward Lunge", pattern: "lunge", alternatives: ["Reverse Lunge Knee Drive", "Lateral Lunge"] },  // All use bodyweight
      { name: "Farmer's Carry", pattern: "carry" }  // Requires equipment (dumbbells/kettlebells/medicine ball)
      // Core: Any core exercise is acceptable (tracked by pattern)
    ],
    intermediate: [
      { name: "Back Squat", pattern: "squat", alternatives: ["Front Squat"] },
      { name: "Deadlift", pattern: "hinge" },
      { name: "Overhead Press", pattern: "vertical_push" },  // Barbell OHP
      { name: "Chest Press", pattern: "horizontal_push", alternatives: ["Push-Up", "T-Push Up", "Plyometric Push-Ups"] },
      { name: "Pull-Up", pattern: "vertical_pull", alternatives: ["Chin-Up", "Standing Dumbbell Pullover", "Resistance Band Lat Pulldown", "Pullover"] },
      { name: "Bent-Over Row", pattern: "horizontal_pull", alternatives: ["Barbell Row"] },
      { name: "Walking Lunge", pattern: "lunge", alternatives: ["Lunge"] },
      { name: "Suitcase Carry", pattern: "carry", alternatives: ["Farmer's Carry"] }
      // Core: Any core exercise is acceptable (tracked by pattern)
    ],
    advanced: [
      { name: "Back Squat", pattern: "squat", alternatives: ["Front Squat"] },
      { name: "Deadlift", pattern: "hinge" },
      { name: "Overhead Press", pattern: "vertical_push" },
      { name: "Chest Press", pattern: "horizontal_push", alternatives: ["Push-Up", "T-Push Up", "Plyometric Push-Ups"] },
      { name: "Pull-Up", pattern: "vertical_pull", alternatives: ["Chin-Up", "Explosive Pull-Ups", "Kipping Pull-Up", "Pullover"] },
      { name: "Bent-Over Row", pattern: "horizontal_pull", alternatives: ["Barbell Row"] },
      { name: "Walking Lunge", pattern: "lunge", alternatives: ["Lunge"] },
      { name: "Suitcase Carry", pattern: "carry", alternatives: ["Farmer's Carry"] }
      // Core: Any core exercise is acceptable (tracked by pattern)
    ]
  };

  const levelRequirements = requiredMovements[fitnessLevel as keyof typeof requiredMovements] || requiredMovements.beginner;
  console.log(`[REQUIRED-MOVEMENTS] ${fitnessLevel} level requires: ${levelRequirements.map(m => m.name).join(', ')} + Core`);
  
  // Weekly tracker to ensure all required movements appear across the week
  const weeklyMovementTracker = new Set<string>();
  const hasUsedCoreMovement = { used: false };

  // Calculate movement pattern levels using centralized utility
  const movementPatternLevels = calculateMovementPatternLevels(latestAssessment, user);
  
  // Get movement difficulties map using centralized utility
  const movementDifficulties = getMovementDifficultiesMap(movementPatternLevels, fitnessLevel);
  
  console.log(`[TEMPLATE-BASED] Generating program for ${fitnessLevel} level user with ${daysPerWeek} days/week and ${workoutDuration} min sessions`);
  console.log(`[DIFFICULTY] Movement pattern difficulties:`, {
    horizontal_push: movementDifficulties.horizontal_push,
    vertical_push: movementDifficulties.vertical_push,
    vertical_pull: movementDifficulties.vertical_pull,
    horizontal_pull: movementDifficulties.horizontal_pull,
    squat: movementDifficulties.squat,
    lunge: movementDifficulties.lunge,
    hinge: movementDifficulties.hinge,
    core: movementDifficulties.core,
    carry: movementDifficulties.carry,
    cardio: movementDifficulties.cardio,
    rotation: movementDifficulties.rotation,
  });

  // OPTIMIZATION: Pre-filter exercises by equipment and difficulty ONCE before loop
  // This prevents repeated filtering in the workout generation loop
  
  const warmupExercises = availableExercises
    .filter((ex) => 
      ex.exerciseCategory === 'warmup' &&
      ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight") &&
      isExerciseAllowed(ex, movementDifficulties, fitnessLevel)
    )
    .slice(0, 30);

  const cardioExercises = availableExercises
    .filter((ex) => 
      ex.movementPattern === "cardio" &&
      ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight") &&
      isExerciseAllowed(ex, movementDifficulties, fitnessLevel)
    )
    .slice(0, 30);

  // Pre-filter main exercises by movement pattern for faster lookup
  const exercisesByPattern: { [key: string]: Exercise[] } = {
    push: [],
    pull: [],
    squat: [],
    lunge: [],
    hinge: [],
    core: [],
    carry: [],
    rotation: [],
    plyometric: [],
  };

  // Single pass through exercises to categorize by pattern
  // Only include main exercises (compound, isolation, core, power) - exclude warmup and cardio
  availableExercises.forEach((ex) => {
    if (['compound', 'isolation', 'core', 'power'].includes(ex.exerciseCategory) && 
        ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight") &&
        isExerciseAllowed(ex, movementDifficulties, fitnessLevel) &&
        exercisesByPattern[ex.movementPattern]) {
      exercisesByPattern[ex.movementPattern].push(ex);
    }
  });
  
  // DIFFICULTY PRIORITIZATION: Sort exercises by difficulty (hardest first) within each pattern
  // This ensures intermediate/advanced users get harder exercises as primary choices
  Object.keys(exercisesByPattern).forEach(pattern => {
    exercisesByPattern[pattern] = sortExercisesByDifficultyPriority(
      exercisesByPattern[pattern],
      movementDifficulties,
      fitnessLevel
    );
  });
  
  console.log(`[DIFFICULTY-SORT] Exercises sorted by difficulty (hardest first) for each pattern`);

  // ==========================================
  // BACKWARDS COMPATIBILITY: Support both selectedDates (new) and selectedDays (legacy)
  // ==========================================
  // NEW APPROACH: Use selectedDates if provided (array of YYYY-MM-DD strings)
  // LEGACY APPROACH: Fall back to selectedDays (day-of-week numbers 1-7)
  // This ensures existing users' programs still work while supporting the new date-based system
  
  const useSelectedDates = input.selectedDates && input.selectedDates.length === daysPerWeek;
  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // LEGACY: For backwards compatibility, support day-of-week scheduling
  const daySchedules: { [key: number]: number[] } = {
    3: [1, 3, 5],       // Legacy: Mon/Wed/Fri (day-of-week numbers)
    4: [1, 2, 4, 5],    // Legacy: Mon/Tue/Thu/Fri (day-of-week numbers)
    5: [1, 2, 3, 4, 5], // Legacy: Mon-Fri (day-of-week numbers)
  };

  const scheduledDays = user.selectedDays && user.selectedDays.length === daysPerWeek 
    ? user.selectedDays 
    : daySchedules[daysPerWeek] || daySchedules[3];
  
  console.log(`[SCHEDULING] Mode: ${useSelectedDates ? 'DATE-BASED' : 'DAY-OF-WEEK'}, Workouts: ${daysPerWeek}`);

  // Select the appropriate program template based on user's nutrition goal
  const selectedTemplate = selectProgramTemplate(user.nutritionGoal, latestAssessment.experienceLevel);
  console.log(`[TEMPLATE] Selected template: ${selectedTemplate.name} for nutrition goal: ${user.nutritionGoal}`);
  
  // WEEK-LEVEL PATTERN DISTRIBUTION
  // Design entire week's pattern emphasis before selecting exercises
  // This ensures variety and proper recovery between similar movement patterns
  type DayPlan = { 
    primary: string[], 
    secondary: string[], 
    workoutFocus: 'squat' | 'push' | 'hinge' | 'pull' | 'athletic' | 'lower_squat' | 'upper_push' | 'lower_hinge' | 'upper_pull' | 'unilateral'
  };
  type WeeklyDistribution = Record<number, Record<number, DayPlan>>;
  
  const weeklyPatternDistribution: WeeklyDistribution = {
    3: {
      // 3-Day Compound Lift Split (Full-Body Pattern Emphasis)
      // Day 1: Squat/Push Focus - CNS Goal: Lower-body dominant neural drive (quad & press focus)
      1: { primary: ['squat', 'horizontal_push', 'horizontal_pull'], secondary: ['lunge', 'carry', 'core'], workoutFocus: 'squat' },
      // Day 2: Hinge/Pull Focus - CNS Goal: Posterior-chain & pulling dominance
      2: { primary: ['hinge', 'vertical_pull', 'vertical_push'], secondary: ['lunge', 'carry', 'core'], workoutFocus: 'hinge' },
      // Day 3: Balanced/Athletic Focus - CNS Goal: Mixed emphasis, athletic integration
      3: { primary: ['squat', 'horizontal_push', 'hinge', 'horizontal_pull'], secondary: ['carry', 'rotation', 'core'], workoutFocus: 'athletic' }
    },
    4: {
      // 4-Day Compound Lift Split (Upper/Lower Pattern Split)
      // Day 1: Lower (Squat Dominant)
      1: { primary: ['squat', 'lunge'], secondary: ['carry', 'core'], workoutFocus: 'lower_squat' },
      // Day 2: Upper (Push Focus)
      2: { primary: ['horizontal_push', 'vertical_push'], secondary: ['horizontal_pull', 'core'], workoutFocus: 'upper_push' },
      // Day 3: Lower (Hinge Dominant)
      3: { primary: ['hinge', 'lunge'], secondary: ['carry', 'core'], workoutFocus: 'lower_hinge' },
      // Day 4: Upper (Pull Focus)
      4: { primary: ['vertical_pull', 'horizontal_pull'], secondary: ['horizontal_push', 'core'], workoutFocus: 'upper_pull' }
    },
    5: {
      // 5-Day Compound Lift Split (Pattern-Based + CNS Hierarchy)
      // Day 1: Squat
      1: { primary: ['squat'], secondary: ['lunge', 'core'], workoutFocus: 'squat' },
      // Day 2: Push
      2: { primary: ['horizontal_push', 'vertical_push'], secondary: ['core'], workoutFocus: 'push' },
      // Day 3: Hinge
      3: { primary: ['hinge'], secondary: ['carry', 'core'], workoutFocus: 'hinge' },
      // Day 4: Pull
      4: { primary: ['vertical_pull', 'horizontal_pull'], secondary: ['core'], workoutFocus: 'pull' },
      // Day 5: Unilateral/Athletic Core
      5: { primary: ['lunge', 'hinge'], secondary: ['rotation', 'core', 'carry'], workoutFocus: 'unilateral' }
    }
  };
  
  console.log(`[WEEK-PLAN] Using ${daysPerWeek}-day weekly pattern distribution for varied workouts`);
  
  // PERCENTAGE-BASED TIME ALLOCATION MATRIX
  // Allocates workout time based on BOTH nutrition goal AND workout duration
  // This ensures optimal training regardless of session length
  
  interface TimeAllocation {
    warmup: number;    // % of total duration
    power: number;     // % of total duration  
    strength: number;  // % of total duration
    cardio: number;    // % of total duration
  }
  
  type AllocationMatrix = Record<string, Record<number, TimeAllocation>>;
  
  const allocationMatrix: AllocationMatrix = {
    gain: {
      30: { warmup: 7, power: 18, strength: 65, cardio: 5 },   // Minimal cardio for short sessions
      45: { warmup: 7, power: 18, strength: 63, cardio: 8 },
      60: { warmup: 7, power: 18, strength: 60, cardio: 10 }
    },
    maintain: {
      30: { warmup: 6, power: 17, strength: 60, cardio: 12 },  // Balanced approach
      45: { warmup: 6, power: 17, strength: 58, cardio: 15 },
      60: { warmup: 7, power: 18, strength: 55, cardio: 18 }
    },
    lose: {
      30: { warmup: 5, power: 15, strength: 55, cardio: 20 },  // Max cardio even in short sessions
      45: { warmup: 5, power: 15, strength: 53, cardio: 23 },
      60: { warmup: 6, power: 16, strength: 50, cardio: 25 }
    }
  };
  
  // Get allocation percentages for current goal and duration
  const nutritionGoal = (user.nutritionGoal || "maintain").toLowerCase();
  const getDurationKey = (duration: number): number => {
    if (duration <= 35) return 30;
    if (duration <= 52) return 45;
    return 60;  // Default to 60 for longer sessions
  };
  
  const durationKey = getDurationKey(workoutDuration);
  const allocation = allocationMatrix[nutritionGoal][durationKey];
  
  console.log(`[ALLOCATION-MATRIX] ${nutritionGoal.toUpperCase()} goal, ${workoutDuration}min → Using ${durationKey}min template: ${allocation.warmup}% warmup, ${allocation.power}% power, ${allocation.strength}% strength, ${allocation.cardio}% cardio`);
  
  // Calculate time budgets from percentages
  const warmupTimeBudget = (workoutDuration * allocation.warmup) / 100;
  const powerTimeBudget = (workoutDuration * allocation.power) / 100;
  const strengthTimeBudget = (workoutDuration * allocation.strength) / 100;
  const cardioTimeBudget = (workoutDuration * allocation.cardio) / 100;
  
  // Calculate exercise counts using PRECISE time estimates from calculateExerciseTime()
  
  // Warmup exercise (1 set, 30 seconds each, superseted with no rest): 0.5min per exercise
  const warmupTimePerExercise = 0.5; // 30 seconds = 0.5 minutes
  
  // Primary compound - 3-4 sets based on fitness level
  // Beginners: 3 sets @ 180s rest, Intermediate/Advanced: 4 sets @ 180s rest
  const primaryCompoundTime = calculateExerciseTime({
    sets: fitnessLevel === "beginner" ? 3 : 4,
    repsMin: 4,
    repsMax: 6,
    restSeconds: 180
  });
  
  // Secondary compound/hypertrophy - 3-4 sets based on fitness level
  // Beginners: 3 sets @ 90s rest, Intermediate/Advanced: 4 sets @ 90s rest
  const secondaryCompoundTime = calculateExerciseTime({
    sets: fitnessLevel === "beginner" ? 3 : 4,
    repsMin: 8,
    repsMax: 12,
    restSeconds: 90
  });
  
  // GOAL-SPECIFIC CARDIO CONFIGURATION
  // Different nutrition goals require different cardio types
  interface CardioConfig {
    types: string[];  // Available cardio types for this goal
  }
  
  const cardioConfigs: Record<string, CardioConfig> = {
    gain: {
      types: ["hiit"]  // HIIT only - most time-efficient
    },
    maintain: {
      types: ["hiit", "steady-state"]  // Mix HIIT and steady-state
    },
    lose: {
      types: ["hiit", "steady-state", "tempo", "circuit"]  // All cardio modalities
    }
  };
  
  const cardioConfig = cardioConfigs[nutritionGoal];
  console.log(`[CARDIO-CONFIG] Nutrition goal: ${nutritionGoal}, cardio types: ${cardioConfig.types.join(', ')}, allocated time: ${cardioTimeBudget.toFixed(1)}min (${allocation.cardio}%)`);
  
  // POWER EXERCISE TIME CALCULATION
  // Power exercises use 2 sets @ 60s rest for all levels
  const powerExerciseTime = calculateExerciseTime({
    sets: 2,  // 2 sets for all levels
    repsMin: fitnessLevel === "advanced" ? 1 : 2,
    repsMax: fitnessLevel === "beginner" ? 3 : 3,
    restSeconds: 60  // 60s rest for all levels
  });
  
  // PERCENTAGE-BASED TIME ALLOCATION
  // Use calculated budgets from allocation matrix to determine exercise counts
  
  // Step 1: WARMUP ALLOCATION (percentage-based)
  const warmupCount = Math.max(1, Math.floor(warmupTimeBudget / warmupTimePerExercise));
  console.log(`[TIME-ALLOC] Warmup: ${warmupTimeBudget.toFixed(1)}min (${allocation.warmup}%) → ${warmupCount} exercises`);
  
  // Step 2: POWER EXERCISE ALLOCATION (percentage-based)
  // Cap at 2 exercises to prevent CNS overload
  const calculatedPowerCount = Math.floor(powerTimeBudget / powerExerciseTime);
  const powerCount = Math.max(0, Math.min(2, calculatedPowerCount));
  console.log(`[TIME-ALLOC] Power: ${powerTimeBudget.toFixed(1)}min (${allocation.power}%) → ${powerCount} exercises (capped at 2)`);
  
  // Step 3: STRENGTH ALLOCATION (percentage-based)
  // Split strength budget between primary and secondary compounds
  const useSupersets = workoutDuration <= 45;
  
  // Always try to fit 2 primary compounds, then fill with secondaries
  let primaryCount = Math.min(2, Math.floor(strengthTimeBudget / primaryCompoundTime));
  const primaryTime = primaryCount * primaryCompoundTime;
  const secondaryTimeBudget = strengthTimeBudget - primaryTime;
  const secondaryCount = Math.max(0, Math.floor(secondaryTimeBudget / secondaryCompoundTime));
  
  console.log(`[TIME-ALLOC] Strength: ${strengthTimeBudget.toFixed(1)}min (${allocation.strength}%) → ${primaryCount} primaries (${primaryTime.toFixed(1)}min) + ${secondaryCount} secondaries (${(secondaryCount * secondaryCompoundTime).toFixed(1)}min)`);
  
  // Step 4: CARDIO ALLOCATION (percentage-based)
  // Calculate cardio count based on time budget - avg 7 minutes per cardio exercise
  const templateWantsCardio = selectedTemplate.structure.workoutStructure.cardioExercises > 0;
  const avgCardioTime = 7; // Average minutes per cardio exercise
  const calculatedCardioCount = Math.floor(cardioTimeBudget / avgCardioTime);
  const cardioCount = (templateWantsCardio && cardioTimeBudget > 0) ? Math.max(1, calculatedCardioCount) : 0;
  const cardioTimePerExercise = cardioCount > 0 ? cardioTimeBudget / cardioCount : 0;
  console.log(`[TIME-ALLOC] Cardio: ${cardioTimeBudget.toFixed(1)}min (${allocation.cardio}%) → ${cardioCount} exercises @ ${cardioTimePerExercise.toFixed(1)}min each`);
  
  const mainCount = primaryCount + secondaryCount;
  
  const estimatedTotal = (warmupCount * warmupTimePerExercise) + 
                         (powerCount * powerExerciseTime) +
                         (primaryCount * primaryCompoundTime) +
                         (secondaryCount * secondaryCompoundTime) +
                         (cardioCount * cardioTimePerExercise);
  
  console.log(`[EXERCISE-CALC] For ${workoutDuration}min ${nutritionGoal.toUpperCase()} session: ${warmupCount}w + ${powerCount}p + ${primaryCount}pri + ${secondaryCount}sec + ${cardioCount}c = ${estimatedTotal.toFixed(1)}min. Supersets: ${useSupersets ? 'YES' : 'NO'}`);
  
  // ==========================================
  // WORKOUT GENERATION: Generate N workouts (where N = daysPerWeek)
  // ==========================================
  // NEW: Generate exactly daysPerWeek workouts with sequential indexes (1, 2, 3, ...)
  // LEGACY: Also support generating 7-day week for backwards compatibility
  const workouts: GeneratedWorkout[] = [];
  
  // SMART EXERCISE REUSE TRACKING
  // Track when each exercise was used (workout number) for intelligent reuse
  // Core exercises blocked for full week, isolation/cardio can repeat after 2+ workouts
  const exerciseUsageMap = new Map<string, number>(); // exerciseId -> workoutIndex used
  const firstDayExercises = new Set<string>(); // Track workout 1 exercises for cross-week recovery
  
  // COMPOUND PATTERN TRACKING
  // Track when each movement pattern was used for compound exercises to prevent back-to-back same-pattern compounds
  const compoundPatternUsage = new Map<string, number>(); // pattern -> last workout index used
  
  // MUSCLE TRACKING FOR RECOVERY
  // Track which muscles were worked heavily on previous training workout
  const previousDayMuscles = new Set<string>(); // Primary muscles from previous workout
  
  // Helper function to check if exercise can be used
  const canUseExercise = (
    exerciseId: string, 
    currentDay: number, 
    exercisePattern: string, 
    exerciseCategory: string = 'compound',
    primaryMuscles: string[] = [],
    usedPrimaryMuscles: Set<string> = new Set()
  ): boolean => {
    // PATTERN-BASED COMPOUND BLOCKING: Check pattern usage FIRST for all compounds
    // Prevents back-to-back same-pattern compounds even if different exercises
    if (exerciseCategory === 'compound') {
      const lastPatternUse = compoundPatternUsage.get(exercisePattern);
      if (lastPatternUse !== undefined) {
        const patternDaysSince = currentDay - lastPatternUse;
        if (patternDaysSince < 2) {
          console.log(`[PATTERN-BLOCK] Blocking ${exerciseId} (${exercisePattern}) - pattern used ${patternDaysSince} days ago (need 2+)`);
          return false;
        }
      }
    }
    
    const lastUsedDay = exerciseUsageMap.get(exerciseId);
    
    // Not used yet - check muscle overlap for isolation exercises only
    if (lastUsedDay === undefined) {
      // MUSCLE OVERLAP CHECK: Skip isolation exercises if their primary muscles are already primary targets in current workout
      // NOTE: Core exercises are exempt from this check since core work should be in every workout
      if (exerciseCategory === 'isolation' && primaryMuscles.length > 0) {
        const hasMuscleDuplicate = primaryMuscles.some(muscle => usedPrimaryMuscles.has(muscle));
        if (hasMuscleDuplicate) {
          console.log(`[MUSCLE-FILTER] Skipping ${exerciseId} - primary muscle(s) [${primaryMuscles.join(', ')}] already targeted as primary in workout`);
          return false;
        }
      }
      
      // CONSECUTIVE DAY RECOVERY: Skip isolation exercises targeting heavily worked muscles from previous day
      // NOTE: Core exercises are exempt since core work should be in every workout
      if (exerciseCategory === 'isolation' && primaryMuscles.length > 0 && previousDayMuscles.size > 0) {
        const targetsPreviousMuscles = primaryMuscles.some(muscle => previousDayMuscles.has(muscle));
        if (targetsPreviousMuscles) {
          console.log(`[RECOVERY-FILTER] Skipping ${exerciseId} - targets muscle(s) [${primaryMuscles.join(', ')}] heavily worked previous day`);
          return false;
        }
      }
      
      return true;
    }
    
    // COMPOUND REUSE: Allow after 2-3 days for even weekly distribution
    // Power exercises still blocked for full week (high CNS demand)
    if (exerciseCategory === 'compound') {
      const daysSince = currentDay - lastUsedDay;
      // Require 2+ workout gap for compound reuse (e.g., workout 1 compound can be reused in workout 3+)
      if (daysSince < 2) {
        console.log(`[COMPOUND-REUSE] Blocking ${exerciseId} - only ${daysSince} days since last use (need 2+)`);
        return false;
      }
      
      console.log(`[COMPOUND-REUSE] Allowing ${exerciseId} - ${daysSince} days since last use`);
      return true;
    }
    
    // Power exercises blocked for full week (highest CNS demand)
    if (exerciseCategory === 'power') {
      return false;
    }
    
    // Core exercises blocked for full week to ensure variety and freshness
    if (exerciseCategory === 'core') {
      console.log(`[CORE-REUSE] Blocking ${exerciseId} - core exercises never repeat within a week`);
      return false;
    }
    
    // Isolation and cardio exercises can repeat after 2+ days
    if (exerciseCategory === 'isolation' || exerciseCategory === 'cardio') {
      const daysSince = currentDay - lastUsedDay;
      if (daysSince < 2) return false;
      
      // Also check muscle overlap even for reused isolation exercises
      if (exerciseCategory === 'isolation' && primaryMuscles.length > 0) {
        const hasMuscleDuplicate = primaryMuscles.some(muscle => usedPrimaryMuscles.has(muscle));
        if (hasMuscleDuplicate) {
          console.log(`[MUSCLE-FILTER] Skipping ${exerciseId} (reuse) - primary muscle(s) [${primaryMuscles.join(', ')}] already targeted`);
          return false;
        }
      }
      
      return true;
    }
    
    // Default: block reuse
    return false;
  };
  
  // Helper to check cross-week recovery (last day can't reuse first day exercises)
  const canUseOnLastDay = (exerciseId: string, isLastScheduledDay: boolean): boolean => {
    if (!isLastScheduledDay) return true;
    return !firstDayExercises.has(exerciseId);
  };
  
  // ==========================================
  // MAIN WORKOUT LOOP: Generate workouts
  // ==========================================
  // NEW APPROACH: Generate exactly daysPerWeek workouts with sequential indexes
  // LEGACY APPROACH: If using selectedDays, still generate full week (7 days) for backwards compatibility
  
  const totalWorkoutsToGenerate = useSelectedDates ? daysPerWeek : 7;
  let sequentialWorkoutNumber = 0; // Track actual workout count (1st, 2nd, 3rd workout) independent of day-of-week
  
  for (let loopIndex = 1; loopIndex <= totalWorkoutsToGenerate; loopIndex++) {
    // NEW: Use sequential workout index (1, 2, 3, ..., N)
    // LEGACY: Map loopIndex to dayOfWeek for backwards compatibility
    const dayOfWeek = useSelectedDates ? undefined : loopIndex; // Only set dayOfWeek for legacy mode
    const dayName = dayOfWeek ? dayNames[dayOfWeek] : `Workout ${loopIndex}`;
    const isScheduledDay = useSelectedDates ? true : scheduledDays.includes(dayOfWeek!);
    
    if (isScheduledDay) {
      sequentialWorkoutNumber++; // Increment workout counter only on scheduled days
      const workoutIndex = sequentialWorkoutNumber; // Use sequential number for pattern access (1, 2, 3, ...)
      const currentDay = dayOfWeek ?? workoutIndex; // Use dayOfWeek if available, otherwise workoutIndex
      // WORKOUT DAY: Generate actual workout with exercises
      // STAGE-BASED GENERATION: Build workout in priority order without destructive reordering
      const stageOutputs = {
        warmups: [] as GeneratedExercise[],
        power: [] as GeneratedExercise[],
        compounds: [] as GeneratedExercise[],
        isolations: [] as GeneratedExercise[],
        core: [] as GeneratedExercise[],
        cardio: [] as GeneratedExercise[]
      };
      let movementFocus: string[] = [];
      
      // MUSCLE TRACKING: Track primary muscles targeted in this workout
      const usedPrimaryMuscles = new Set<string>();
      
      // Get weekly pattern distribution for this specific workout
      // Use workoutIndex for pattern selection (1, 2, 3, ... N)
      const weekPlan = weeklyPatternDistribution[daysPerWeek];
      const dayPlan = weekPlan[workoutIndex];
      const workoutFocus = dayPlan?.workoutFocus || 'athletic';  // Get workout focus early for all systems
      
      if (!dayPlan) {
        console.warn(`[WEEK-PLAN] No pattern distribution found for workout ${workoutIndex} in ${daysPerWeek}-day program, using default`);
      }
      
      // PRIORITY-BASED PATTERN DISTRIBUTION SYSTEM
      // Use week-level pattern distribution with priority/emphasis approach
      // First select from priority patterns, then fill remaining time from other patterns
      const primaryPatterns = dayPlan?.primary || [];
      const secondaryPatterns = dayPlan?.secondary || [];
      const allPatterns = ['horizontal_push', 'vertical_push', 'vertical_pull', 'horizontal_pull', 'squat', 'lunge', 'hinge', 'core', 'rotation', 'carry'];
      const usedPatterns = new Set([...primaryPatterns, ...secondaryPatterns]);
      const fallbackPatterns = allPatterns.filter(p => !usedPatterns.has(p));
      
      console.log(`[WEEK-PLAN] Workout ${workoutIndex} (${dayName}): Primary=${primaryPatterns.join(', ')}, Secondary=${secondaryPatterns.join(', ')}, Fallback=${fallbackPatterns.join(', ')}`);
      const compoundExercises: { exercise: Exercise; pattern: string }[] = [];
      
      // Track if this is the last scheduled workout
      const isLastScheduledDay = workoutIndex === daysPerWeek;
      
      // Track remaining slots for each exercise type (respect calculated primaryCount/secondaryCount)
      let primarySlotsRemaining = primaryCount;
      let secondarySlotsRemaining = secondaryCount;
      
      // Pre-calculate superset allocation to reserve capacity
      const shouldAddSupersets = 
        fitnessLevel !== 'beginner' && 
        daysPerWeek <= 4;
      
      let reservedSupersetSlots = 0;
      if (shouldAddSupersets) {
        const weakPatterns = identifyWeakMovementPatterns(latestAssessment, user);
        // Reserve slots for supersets (max 2)
        reservedSupersetSlots = Math.min(2, weakPatterns.length, Math.floor(mainCount / 2));
        console.log(`[SUPERSET] Reserving ${reservedSupersetSlots} slots for weak patterns: ${weakPatterns.join(', ')}`);
      }
      
      // Adjust compound selection to account for reserved isolation slots
      let compoundSlotsToFill = mainCount - reservedSupersetSlots;
      
      // CAP COMPOUNDS PER DAY: Prevent later days from hoarding reused compounds
      // Allow modest flexibility (+1 from average) to accommodate pattern requirements
      // but prevent extreme imbalance (e.g., 3-5-4-7 → 3-5-5-5)
      const averageCompoundsPerDay = Math.floor(mainCount - reservedSupersetSlots);
      const MAX_COMPOUNDS_PER_DAY = averageCompoundsPerDay + 1; // Allow +1 flexibility
      compoundSlotsToFill = Math.min(compoundSlotsToFill, MAX_COMPOUNDS_PER_DAY);
      console.log(`[COMPOUND-CAP] Day ${workoutIndex}: Limiting to ${compoundSlotsToFill} compounds (max: ${MAX_COMPOUNDS_PER_DAY}, base: ${averageCompoundsPerDay})`);
      
      // REQUIRED MOVEMENT SELECTION FIRST
      // Before tiered selection, prioritize required movements that haven't been used this week
      // Search in FULL exercise list, not pre-filtered (required movements override difficulty filters)
      console.log(`[REQUIRED-CHECK] Day ${workoutIndex} - Week tracker: ${Array.from(weeklyMovementTracker).join(', ')}, Core used: ${hasUsedCoreMovement.used}`);
      console.log(`[REQUIRED-CHECK] Day ${workoutIndex} - Relevant patterns: Primary ${primaryPatterns.join(', ')}, Secondary ${secondaryPatterns.join(', ')}`);
      console.log(`[REQUIRED-CHECK] Day ${workoutIndex} - Compound slots to fill: ${compoundSlotsToFill}`);
      
      // Track compound exercises separately (core/accessory don't count toward compound slots)
      let compoundExercisesAdded = 0;
      
      for (const requiredMov of levelRequirements) {
        // REQUIRED MOVEMENTS: No longer break on slot limits, always try to add if relevant
        
        // Skip if already used this week
        if (weeklyMovementTracker.has(requiredMov.name)) {
          console.log(`[REQUIRED-SKIP] ${requiredMov.name} - already used this week`);
          continue;
        }
        
        // Check if this pattern is relevant to today's workout (primary or secondary patterns)
        const relevantPatterns = [...primaryPatterns, ...secondaryPatterns];
        if (!relevantPatterns.includes(requiredMov.pattern)) {
          console.log(`[REQUIRED-SKIP] ${requiredMov.name} - pattern ${requiredMov.pattern} not relevant today`);
          continue;
        }
        
        // Find the required exercise with flexible difficulty matching
        // Allow exercises up to ONE difficulty level above user's level for required movements
        // Beginner: can use beginner or intermediate (not advanced)
        // Intermediate: can use all levels
        // Advanced: can use all levels
        const allowedDifficulties = fitnessLevel === 'beginner' 
          ? ['beginner', 'intermediate']
          : ['beginner', 'intermediate', 'advanced'];
        
        console.log(`[REQUIRED-SEARCH] ${requiredMov.name} - pattern ${requiredMov.pattern}, allowed difficulties: ${allowedDifficulties.join(', ')}`);
        
        const allPatternExercises = availableExercises.filter(ex =>
          ex.movementPattern === requiredMov.pattern &&
          ['compound', 'isolation', 'core', 'power'].includes(ex.exerciseCategory) &&
          ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight") &&
          allowedDifficulties.includes(ex.difficulty) &&
          canUseExercise(ex.id, currentDay, ex.movementPattern, ex.exerciseCategory, ex.primaryMuscles || [], usedPrimaryMuscles) &&
          canUseOnLastDay(ex.id, isLastScheduledDay)
        );
        
        console.log(`[REQUIRED-SEARCH] ${requiredMov.name} - found ${allPatternExercises.length} matching exercises`);
        
        let foundExercise: Exercise | undefined;
        
        // Try to find exact match or alternative
        foundExercise = allPatternExercises.find(ex => ex.name === requiredMov.name);
        
        // Try alternatives if main exercise not found
        if (!foundExercise && 'alternatives' in requiredMov && requiredMov.alternatives) {
          for (const altName of requiredMov.alternatives) {
            foundExercise = allPatternExercises.find(ex => ex.name === altName);
            if (foundExercise) {
              console.log(`[REQUIRED-FOUND] ${requiredMov.name} - using alternative: ${foundExercise.name}`);
              break;
            }
          }
        } else if (foundExercise) {
          console.log(`[REQUIRED-FOUND] ${requiredMov.name} - found exact match`);
        } else {
          console.log(`[REQUIRED-NOT-FOUND] ${requiredMov.name} - no matches in ${allPatternExercises.length} available`);
        }
        
        if (foundExercise) {
          // Determine exercise role
          // REQUIRED MOVEMENTS: Always added regardless of slot limits
          let exerciseRole: 'primary-compound' | 'secondary-compound' | 'isolation' | 'core-accessory' | 'warmup' | 'cardio';
          
          if (foundExercise.exerciseCategory === 'compound') {
            if (primarySlotsRemaining > 0) {
              exerciseRole = 'primary-compound';
              primarySlotsRemaining--;
            } else if (secondarySlotsRemaining > 0) {
              exerciseRole = 'secondary-compound';
              secondarySlotsRemaining--;
            } else {
              // Still add required movement even if slots full, use secondary role
              exerciseRole = 'secondary-compound';
            }
          } else if (foundExercise.movementPattern === 'core' || foundExercise.movementPattern === 'rotation' || foundExercise.movementPattern === 'carry') {
            exerciseRole = 'core-accessory';
          } else {
            exerciseRole = 'isolation';
          }
          
          const params = assignTrainingParameters(foundExercise, fitnessLevel, selectedTemplate, latestAssessment, user, exerciseRole);
          const generatedExercise: GeneratedExercise = {
            exerciseName: foundExercise.name,
            equipment: selectExerciseEquipment(foundExercise, user.equipment || []),
            ...params,
            // METADATA: Track source exercise type for CNS reordering
            sourceExerciseCategory: foundExercise.exerciseCategory,
            sourceMovementPattern: foundExercise.movementPattern,
          };
          
          // STAGE-BASED: Push to appropriate stage array based on exercise category
          if (foundExercise.exerciseCategory === 'compound') {
            stageOutputs.compounds.push(generatedExercise);
            compoundExercises.push({ exercise: foundExercise, pattern: requiredMov.pattern });
            compoundExercisesAdded++;  // Count compounds toward slot limit
          } else if (foundExercise.exerciseCategory === 'power') {
            stageOutputs.power.push(generatedExercise);
          } else if (foundExercise.exerciseCategory === 'isolation') {
            stageOutputs.isolations.push(generatedExercise);
          } else if (foundExercise.exerciseCategory === 'core' || foundExercise.movementPattern === 'core' || foundExercise.movementPattern === 'rotation' || foundExercise.movementPattern === 'carry') {
            stageOutputs.core.push(generatedExercise);
          } else if (foundExercise.exerciseCategory === 'warmup') {
            stageOutputs.warmups.push(generatedExercise);
          } else if (foundExercise.exerciseCategory === 'cardio') {
            stageOutputs.cardio.push(generatedExercise);
          }
          movementFocus.push(requiredMov.pattern);
          
          // Mark as used in tracking systems
          weeklyMovementTracker.add(requiredMov.name);
          exerciseUsageMap.set(foundExercise.id, currentDay);
          if (workoutIndex === 1) {
            firstDayExercises.add(foundExercise.id);
          }
          
          // Track compound pattern usage
          if (foundExercise.exerciseCategory === 'compound') {
            compoundPatternUsage.set(foundExercise.movementPattern, currentDay);
          }
          
          // Track primary muscles for this workout
          if (foundExercise.primaryMuscles && foundExercise.primaryMuscles.length > 0) {
            foundExercise.primaryMuscles.forEach(muscle => usedPrimaryMuscles.add(muscle));
          }
          
          console.log(`[REQUIRED-ADDED] ✓ ${foundExercise.name} (${requiredMov.pattern}) - Required movement added on day ${workoutIndex}, Compounds: ${compoundExercisesAdded}/${compoundSlotsToFill}`);
        }
      }
      
      // Check for core pattern requirement - add core to EVERY workout that has it in patterns
      // NOTE: Core should be in every workout, not just once per week
      if (primaryPatterns.includes('core') || secondaryPatterns.includes('core')) {
        const coreExercises = exercisesByPattern['core'] || [];
        const coreEx = coreExercises.find(ex => 
          canUseExercise(ex.id, currentDay, ex.movementPattern, ex.exerciseCategory, ex.primaryMuscles || [], usedPrimaryMuscles) &&
          canUseOnLastDay(ex.id, isLastScheduledDay)
        );
        
        if (coreEx) {
          const params = assignTrainingParameters(coreEx, fitnessLevel, selectedTemplate, latestAssessment, user, 'core-accessory');
          const coreExercise: GeneratedExercise = {
            exerciseName: coreEx.name,
            equipment: selectExerciseEquipment(coreEx, user.equipment || []),
            ...params,
            sourceExerciseCategory: coreEx.exerciseCategory,
            sourceMovementPattern: coreEx.movementPattern,
          };
          stageOutputs.core.push(coreExercise);
          movementFocus.push('core');
          exerciseUsageMap.set(coreEx.id, currentDay);
          if (workoutIndex === 1) {
            firstDayExercises.add(coreEx.id);
          }
          
          // Track primary muscles
          if (coreEx.primaryMuscles && coreEx.primaryMuscles.length > 0) {
            coreEx.primaryMuscles.forEach(muscle => usedPrimaryMuscles.add(muscle));
          }
          
          hasUsedCoreMovement.used = true;
          console.log(`[REQUIRED-ADDED] ✓ ${coreEx.name} (core) - Core requirement fulfilled on day ${workoutIndex}`);
        }
      }
      
      console.log(`[REQUIRED-CHECK] After required movements: ${stageOutputs.compounds.length} compounds, ${stageOutputs.core.length} core, ${stageOutputs.power.length} power, ${stageOutputs.isolations.length} isolations`);
      
      // CNS-ORDERED PHASED SELECTION
      // Phase ordering: Compounds → Isolations → Core/Accessory
      // Each phase follows PRIMARY → SECONDARY → FALLBACK pattern priority
      
      const patternTiers = [
        { name: 'PRIMARY', patterns: primaryPatterns },
        { name: 'SECONDARY', patterns: secondaryPatterns },
        { name: 'FALLBACK', patterns: fallbackPatterns }
      ];
      
      // PHASE 1: COMPOUND EXERCISES (Highest CNS demand after power)
      console.log(`[CNS-PHASE-1] Selecting COMPOUND exercises`);
      for (const tier of patternTiers) {
        if (stageOutputs.compounds.length >= compoundSlotsToFill) break;
        
        const compoundsNeeded = compoundSlotsToFill - stageOutputs.compounds.length;
        const exercisesPerPattern = Math.ceil(compoundsNeeded / tier.patterns.length);
        console.log(`[COMPOUND-TIER] ${tier.name} tier: need ${compoundsNeeded} more, ${exercisesPerPattern} per pattern from [${tier.patterns.join(', ')}]`);
        
        for (const pattern of tier.patterns) {
          if (stageOutputs.compounds.length >= compoundSlotsToFill) break;
          
          const patternExercises = exercisesByPattern[pattern] || [];
          // Filter for COMPOUNDS only (non-power compounds - power exercises handled separately)
          const compoundOnly = patternExercises.filter(ex => ex.exerciseCategory === 'compound');
          
          const selected = selectExercisesByPattern(
            compoundOnly, 
            pattern, 
            exercisesPerPattern, 
            (ex) => canUseExercise(ex.id, currentDay, ex.movementPattern, ex.exerciseCategory, ex.primaryMuscles || [], usedPrimaryMuscles) && canUseOnLastDay(ex.id, isLastScheduledDay),
            (exId, primaryMuscles, exercisePattern, exerciseCategory) => {
              exerciseUsageMap.set(exId, currentDay);
              if (workoutIndex === 1) firstDayExercises.add(exId);
              if (primaryMuscles && primaryMuscles.length > 0) {
                primaryMuscles.forEach(muscle => usedPrimaryMuscles.add(muscle));
              }
              // Track compound pattern usage
              if (exerciseCategory === 'compound' && exercisePattern) {
                compoundPatternUsage.set(exercisePattern, currentDay);
              }
            }
          );
          
          for (const ex of selected) {
            if (stageOutputs.compounds.length >= compoundSlotsToFill) break;
            
            // Determine primary vs secondary compound role
            let exerciseRole: 'primary-compound' | 'secondary-compound' | 'isolation' | 'core-accessory';
            if (primarySlotsRemaining > 0) {
              exerciseRole = 'primary-compound';
              primarySlotsRemaining--;
            } else if (secondarySlotsRemaining > 0) {
              exerciseRole = 'secondary-compound';
              secondarySlotsRemaining--;
            } else {
              continue; // No slots remaining
            }
            
            const params = assignTrainingParameters(ex, fitnessLevel, selectedTemplate, latestAssessment, user, exerciseRole);
            const genEx: GeneratedExercise = {
              exerciseName: ex.name,
              equipment: selectExerciseEquipment(ex, user.equipment || []),
              ...params,
              sourceExerciseCategory: ex.exerciseCategory,
              sourceMovementPattern: ex.movementPattern,
            };
            // STAGE-BASED: Push to appropriate array based on category
            if (ex.exerciseCategory === 'compound') {
              stageOutputs.compounds.push(genEx);
            } else if (ex.exerciseCategory === 'isolation') {
              stageOutputs.isolations.push(genEx);
            } else if (ex.exerciseCategory === 'core' || ['core', 'rotation', 'carry'].includes(ex.movementPattern)) {
              stageOutputs.core.push(genEx);
            }
            movementFocus.push(pattern);
            compoundExercises.push({ exercise: ex, pattern });
          }
        }
      }
      
      console.log(`[CNS-PHASE-1] Compounds complete: ${stageOutputs.compounds.length}/${compoundSlotsToFill} exercises`);
      
      // PHASE 2: SMART ISOLATION EXERCISES
      // Match isolation to workout theme and prioritize untargeted muscles
      console.log(`[CNS-PHASE-2] Selecting ISOLATION exercises with theme-based muscle balance`);
      
      // 1. Determine workout theme based on compound patterns
      const compoundPatterns = compoundExercises.map(c => c.pattern);
      const pushPatterns = compoundPatterns.filter(p => ['horizontal_push', 'vertical_push'].includes(p)).length;
      const pullPatterns = compoundPatterns.filter(p => ['vertical_pull', 'horizontal_pull', 'hinge'].includes(p)).length;
      const legPatterns = compoundPatterns.filter(p => ['squat', 'lunge'].includes(p)).length;

      let workoutTheme: 'PUSH' | 'PULL' | 'LEG' | 'MIXED';
      if (pushPatterns > pullPatterns && pushPatterns > legPatterns) {
        workoutTheme = 'PUSH';
      } else if (pullPatterns > pushPatterns && pullPatterns > legPatterns) {
        workoutTheme = 'PULL';
      } else if (legPatterns > pushPatterns && legPatterns > pullPatterns) {
        workoutTheme = 'LEG';
      } else {
        workoutTheme = 'MIXED';
      }

      // 2. Define theme-appropriate isolation patterns
      const themeIsolationPatterns: { [key: string]: string[] } = {
        PUSH: ['horizontal_push', 'vertical_push'],  // triceps, delts, chest
        PULL: ['vertical_pull', 'horizontal_pull', 'hinge'],  // biceps, lats, rear delts, traps
        LEG: ['squat', 'lunge', 'hinge'],           // quads, hamstrings, calves, glutes
        MIXED: ['horizontal_push', 'vertical_push', 'vertical_pull', 'horizontal_pull', 'squat', 'lunge', 'hinge']
      };

      const preferredIsolationPatterns = themeIsolationPatterns[workoutTheme];
      console.log(`[ISOLATION-THEME] Workout theme: ${workoutTheme}, preferred patterns: ${preferredIsolationPatterns.join(', ')}`);

      // 3. Track which muscles have been targeted by compounds
      const targetedMuscles = new Set<string>();
      compoundExercises.forEach(({ exercise }) => {
        if (exercise.primaryMuscles) {
          exercise.primaryMuscles.forEach(m => targetedMuscles.add(m));
        }
      });
      console.log(`[MUSCLE-TRACKING] Muscles already targeted by compounds: ${Array.from(targetedMuscles).join(', ')}`);

      // 4. Define agonist/antagonist pairs for balance
      const antagonistPairs: { [key: string]: string[] } = {
        biceps: ['triceps'],
        triceps: ['biceps'],
        quads: ['hamstrings'],
        quadriceps: ['hamstrings'],
        hamstrings: ['quads', 'quadriceps'],
        chest: ['back', 'lats', 'upper back'],
        back: ['chest'],
        lats: ['chest', 'delts'],
        'front delts': ['rear delts'],
        'rear delts': ['front delts']
      };

      // 5. Smart isolation selection - prioritize theme patterns and untargeted muscles
      // Fill isolation slots based on available strength time
      const isolationCandidates: { exercise: Exercise; priority: number; }[] = [];

      for (const pattern of preferredIsolationPatterns) {
        const patternExercises = exercisesByPattern[pattern] || [];
        const isolationOnly = patternExercises.filter(ex => ex.exerciseCategory === 'isolation');
        
        for (const ex of isolationOnly) {
          if (!canUseExercise(ex.id, currentDay, ex.movementPattern, ex.exerciseCategory, ex.primaryMuscles || [], usedPrimaryMuscles) || 
              !canUseOnLastDay(ex.id, isLastScheduledDay)) {
            continue;
          }
          
          let priority = 0;
          
          // Highest priority: targets untargeted muscle (new muscle group)
          const hasUntargetedMuscle = ex.primaryMuscles?.some(m => !targetedMuscles.has(m));
          if (hasUntargetedMuscle) priority += 100;
          
          // High priority: targets antagonist of already-targeted muscle (muscle balance)
          const targetsAntagonist = ex.primaryMuscles?.some(muscle => {
            return Array.from(targetedMuscles).some(targeted => {
              const antagonists = antagonistPairs[targeted] || [];
              return antagonists.includes(muscle);
            });
          });
          if (targetsAntagonist) priority += 60;
          
          // Medium priority: direct isolation of already-targeted muscle (finisher/pump work)
          // Useful for triceps after compounds, biceps after pull work, etc.
          const targetsAlreadyWorked = ex.primaryMuscles?.some(m => targetedMuscles.has(m));
          if (!hasUntargetedMuscle && !targetsAntagonist && targetsAlreadyWorked) priority += 40;
          
          isolationCandidates.push({ exercise: ex, priority });
        }
      }

      // Sort by priority (highest first)
      isolationCandidates.sort((a, b) => b.priority - a.priority);
      console.log(`[ISOLATION-SELECTION] Found ${isolationCandidates.length} candidates for ${workoutTheme} theme`);

      // Select top candidates - no hard cap, limited by time and reserved slots
      for (const { exercise: ex, priority } of isolationCandidates) {
        // Limit isolation to reserved superset slots (if applicable)
        if (reservedSupersetSlots > 0 && stageOutputs.isolations.length >= reservedSupersetSlots) break;
        
        // RE-CHECK: Muscle tracking may have changed since building candidates list
        // This prevents duplicate muscle targeting (e.g., both Seated and Standing Calf Raise)
        if (!canUseExercise(ex.id, currentDay, ex.movementPattern, ex.exerciseCategory, ex.primaryMuscles || [], usedPrimaryMuscles)) {
          console.log(`[ISOLATION-SKIP] ${ex.name} - muscle already targeted or other constraint`);
          continue;
        }
        
        const params = assignTrainingParameters(ex, fitnessLevel, selectedTemplate, latestAssessment, user, 'isolation');
        const genEx: GeneratedExercise = {
          exerciseName: ex.name,
          equipment: selectExerciseEquipment(ex, user.equipment || []),
          ...params,
          sourceExerciseCategory: ex.exerciseCategory,
          sourceMovementPattern: ex.movementPattern,
        };
        
        stageOutputs.isolations.push(genEx);
        movementFocus.push(ex.movementPattern);
        
        // Track exercise usage
        exerciseUsageMap.set(ex.id, currentDay);
        if (workoutIndex === 1) firstDayExercises.add(ex.id);
        if (ex.primaryMuscles && ex.primaryMuscles.length > 0) {
          ex.primaryMuscles.forEach(muscle => {
            usedPrimaryMuscles.add(muscle);
            targetedMuscles.add(muscle);
          });
        }
        
        const muscleInfo = ex.primaryMuscles?.join(', ') || 'unknown';
        console.log(`[ISOLATION-ADDED] ${ex.name} (${ex.movementPattern}) - targets: ${muscleInfo}, priority: ${priority}`);
      }
      
      const totalAfterPhase2 = stageOutputs.compounds.length + stageOutputs.isolations.length + stageOutputs.core.length;
      console.log(`[CNS-PHASE-2] Isolations complete: ${stageOutputs.isolations.length} isolations, ${totalAfterPhase2} total exercises`);
      
      // PHASE 3: CORE/ACCESSORY EXERCISES (Anti-Movement Pattern Focus)
      // Select core exercises based on workout focus using anti-movement patterns
      console.log(`[CNS-PHASE-3] Selecting CORE/ACCESSORY with anti-movement pattern focus`);
      
      // Define anti-movement core patterns based on workout focus
      const antiMovementMapping: Record<string, string[]> = {
        // 3-Day Split
        squat: ['core'],           // Anti-extension (planks, rollouts, dead bug)
        hinge: ['carry'],          // Anti-lateral flexion (suitcase carry, side plank)
        athletic: ['rotation'],    // Anti-rotation (Pallof press, cable rotation)
        
        // 4-Day Split
        lower_squat: ['core'],
        upper_push: ['core'],
        lower_hinge: ['carry'],
        upper_pull: ['rotation'],
        
        // 5-Day Split
        push: ['core'],
        pull: ['rotation'],
        unilateral: ['rotation', 'carry'],
      };
      
      const preferredCorePatterns = antiMovementMapping[workoutFocus] || ['core'];
      console.log(`[ANTI-MOVEMENT] ${workoutFocus} focus → Anti-movement patterns: ${preferredCorePatterns.join(', ')}`);
      
      const coreTargetCount = mainCount + 2; // Can add a few core exercises beyond main count
      
      // Priority 1: Add preferred anti-movement pattern exercises first
      for (const pattern of preferredCorePatterns) {
        const totalExercises = stageOutputs.compounds.length + stageOutputs.isolations.length + stageOutputs.core.length;
        if (totalExercises >= coreTargetCount) break;
        
        const patternExercises = exercisesByPattern[pattern] || [];
        const coreOnly = patternExercises.filter(ex => ['core', 'rotation', 'carry'].includes(ex.movementPattern));
        
        if (coreOnly.length > 0) {
          const selected = selectExercisesByPattern(
            coreOnly, 
            pattern, 
            1,  // One exercise per preferred anti-movement pattern
            (ex) => canUseExercise(ex.id, currentDay, ex.movementPattern, ex.exerciseCategory, ex.primaryMuscles || [], usedPrimaryMuscles) && canUseOnLastDay(ex.id, isLastScheduledDay),
            (exId, primaryMuscles, exercisePattern, exerciseCategory) => {
              exerciseUsageMap.set(exId, currentDay);
              if (workoutIndex === 1) firstDayExercises.add(exId);
              if (primaryMuscles && primaryMuscles.length > 0) {
                primaryMuscles.forEach(muscle => usedPrimaryMuscles.add(muscle));
              }
              if (exerciseCategory === 'compound' && exercisePattern) {
                compoundPatternUsage.set(exercisePattern, currentDay);
              }
            }
          );
          
          for (const ex of selected) {
            const params = assignTrainingParameters(ex, fitnessLevel, selectedTemplate, latestAssessment, user, 'core-accessory');
            const genEx: GeneratedExercise = {
              exerciseName: ex.name,
              equipment: selectExerciseEquipment(ex, user.equipment || []),
              ...params,
              sourceExerciseCategory: ex.exerciseCategory,
              sourceMovementPattern: ex.movementPattern,
            };
            stageOutputs.core.push(genEx);
            movementFocus.push(pattern);
            console.log(`[ANTI-MOVEMENT] Added ${ex.name} (${pattern}) for ${workoutFocus} focus`);
          }
        }
      }
      
      // Priority 2: Fill remaining slots with tiered patterns (fallback)
      for (const tier of patternTiers) {
        const totalExercises = stageOutputs.compounds.length + stageOutputs.isolations.length + stageOutputs.core.length;
        if (totalExercises >= coreTargetCount) break;
        
        const exercisesNeeded = coreTargetCount - totalExercises;
        const exercisesPerPattern = Math.ceil(exercisesNeeded / tier.patterns.length);
        console.log(`[CORE-TIER] ${tier.name} tier: need ${exercisesNeeded} more, ${exercisesPerPattern} per pattern from [${tier.patterns.join(', ')}]`);
        
        for (const pattern of tier.patterns) {
          const totalExercises2 = stageOutputs.compounds.length + stageOutputs.isolations.length + stageOutputs.core.length;
          if (totalExercises2 >= coreTargetCount) break;
          
          const patternExercises = exercisesByPattern[pattern] || [];
          // Filter for CORE/ROTATION/CARRY only
          const coreOnly = patternExercises.filter(ex => 
            ['core', 'rotation', 'carry'].includes(ex.movementPattern)
          );
          
          const selected = selectExercisesByPattern(
            coreOnly, 
            pattern, 
            exercisesPerPattern, 
            (ex) => canUseExercise(ex.id, currentDay, ex.movementPattern, ex.exerciseCategory, ex.primaryMuscles || [], usedPrimaryMuscles) && canUseOnLastDay(ex.id, isLastScheduledDay),
            (exId, primaryMuscles, exercisePattern, exerciseCategory) => {
              exerciseUsageMap.set(exId, currentDay);
              if (workoutIndex === 1) firstDayExercises.add(exId);
              if (primaryMuscles && primaryMuscles.length > 0) {
                primaryMuscles.forEach(muscle => usedPrimaryMuscles.add(muscle));
              }
              // Track compound pattern usage
              if (exerciseCategory === 'compound' && exercisePattern) {
                compoundPatternUsage.set(exercisePattern, currentDay);
              }
            }
          );
          
          for (const ex of selected) {
            const totalExercises3 = stageOutputs.compounds.length + stageOutputs.isolations.length + stageOutputs.core.length;
            if (totalExercises3 >= coreTargetCount) break;
            
            const params = assignTrainingParameters(ex, fitnessLevel, selectedTemplate, latestAssessment, user, 'core-accessory');
            const genEx: GeneratedExercise = {
              exerciseName: ex.name,
              equipment: selectExerciseEquipment(ex, user.equipment || []),
              ...params,
              sourceExerciseCategory: ex.exerciseCategory,
              sourceMovementPattern: ex.movementPattern,
            };
            // STAGE-BASED: Push to appropriate array based on category
            if (ex.exerciseCategory === 'compound') {
              stageOutputs.compounds.push(genEx);
            } else if (ex.exerciseCategory === 'isolation') {
              stageOutputs.isolations.push(genEx);
            } else if (ex.exerciseCategory === 'core' || ['core', 'rotation', 'carry'].includes(ex.movementPattern)) {
              stageOutputs.core.push(genEx);
            }
            movementFocus.push(pattern);
          }
        }
      }
      
      const totalAfterPhase3 = stageOutputs.compounds.length + stageOutputs.isolations.length + stageOutputs.core.length;
      console.log(`[CNS-PHASE-3] Core/accessory complete: ${stageOutputs.core.length} core, ${totalAfterPhase3} total exercises`);
      
      // TEMPORARY: Build exercises array for superset pairing logic (will rebuild at end)
      let exercises = [
        ...stageOutputs.compounds,
        ...stageOutputs.isolations,
        ...stageOutputs.core
      ];
      
      // SUPERSET PAIRING FOR 30-45 MIN WORKOUTS
      // Pair antagonistic or non-competing exercises to maximize time efficiency
      if (useSupersets && exercises.length >= 2) {
        console.log(`[SUPERSET] Short workout (${workoutDuration}min) - pairing exercises for efficiency`);
        
        // Define antagonistic pattern pairs (can be done back-to-back with minimal fatigue)
        const antagonisticPairs: Record<string, string[]> = {
          horizontal_push: ['vertical_pull', 'horizontal_pull', 'hinge'],
          vertical_push: ['vertical_pull', 'horizontal_pull', 'hinge'],
          vertical_pull: ['horizontal_push', 'vertical_push', 'squat'],
          horizontal_pull: ['horizontal_push', 'vertical_push', 'squat'],
          squat: ['hinge', 'vertical_pull', 'horizontal_pull'],
          hinge: ['squat', 'horizontal_push', 'vertical_push'],
          lunge: ['core', 'rotation'],
          core: ['lunge', 'carry'],
          rotation: ['lunge', 'carry']
        };
        
        const supersetGroups = ['A', 'B', 'C', 'D', 'E', 'F'];
        let supersetIndex = 0;
        const paired = new Set<number>();
        
        // Try to pair each exercise with an antagonistic one
        for (let i = 0; i < exercises.length - 1; i++) {
          if (paired.has(i) || exercises[i].isWarmup || exercises[i].supersetGroup) continue;
          
          const ex1 = exercises[i];
          const ex1Pattern = movementFocus[i];
          const compatiblePatterns = antagonisticPairs[ex1Pattern] || [];
          
          // Find a compatible partner
          for (let j = i + 1; j < exercises.length; j++) {
            if (paired.has(j) || exercises[j].isWarmup || exercises[j].supersetGroup) continue;
            
            const ex2Pattern = movementFocus[j];
            
            if (compatiblePatterns.includes(ex2Pattern)) {
              // Pair these exercises!
              const group = supersetGroups[supersetIndex];
              ex1.supersetGroup = group;
              ex1.supersetOrder = 1;
              exercises[j].supersetGroup = group;
              exercises[j].supersetOrder = 2;
              
              paired.add(i);
              paired.add(j);
              supersetIndex++;
              
              console.log(`[SUPERSET] Paired ${group}: ${ex1.exerciseName} (${ex1Pattern}) + ${exercises[j].exerciseName} (${ex2Pattern})`);
              break;
            }
          }
        }
        
        console.log(`[SUPERSET] Created ${supersetIndex} superset pairs for time efficiency`);
      }
      
      // Note: Backfill removed - 3-phase CNS-ordered selection now handles all exercise allocation
      
      // TIME VALIDATION & FALLBACK LOGIC
      // Calculate actual strength block duration and add fallback exercises if below target
      // Note: At this point, exercises array contains only main strength exercises
      // Warmups, power, and cardio are added later, so we compare against strengthTimeBudget only
      let actualStrengthDuration = exercises.reduce((total, ex) => {
        return total + calculateExerciseTime({
          sets: ex.sets,
          repsMin: ex.repsMin,
          repsMax: ex.repsMax,
          durationSeconds: ex.durationSeconds,
          workSeconds: ex.workSeconds,
          restSeconds: ex.restSeconds,
        });
      }, 0);
      
      const strengthDurationGap = strengthTimeBudget - actualStrengthDuration;
      const MIN_GAP_THRESHOLD = 3; // Trigger fallback if strength block is 3+ minutes short
      
      if (strengthDurationGap >= MIN_GAP_THRESHOLD) {
        console.log(`[FALLBACK] Strength duration gap detected: ${actualStrengthDuration.toFixed(1)}min actual vs ${strengthTimeBudget.toFixed(1)}min target (${strengthDurationGap.toFixed(1)}min short)`);
        
        // Track which patterns are already used to prioritize under-represented ones
        const patternUsage = new Map<string, number>();
        movementFocus.forEach(pattern => {
          patternUsage.set(pattern, (patternUsage.get(pattern) || 0) + 1);
        });
        
        // Get all available patterns sorted by usage (least used first)
        const allPatterns = Object.keys(exercisesByPattern).filter(p => exercisesByPattern[p].length > 0);
        const sortedPatterns = allPatterns.sort((a, b) => 
          (patternUsage.get(a) || 0) - (patternUsage.get(b) || 0)
        );
        
        console.log(`[FALLBACK] Pattern usage: ${Array.from(patternUsage.entries()).map(([p, count]) => `${p}:${count}`).join(', ')}`);
        console.log(`[FALLBACK] Will add exercises from least-used patterns: ${sortedPatterns.slice(0, 3).join(', ')}`);
        
        // Add exercises until we fill the strength time budget
        let fallbackAdded = 0;
        for (const pattern of sortedPatterns) {
          if (actualStrengthDuration >= strengthTimeBudget - 1) break; // Stop when within 1 minute of strength target
          
          const patternExercises = exercisesByPattern[pattern] || [];
          // CNS-ORDERED FALLBACK: Only add NON-POWER compounds to maintain CNS progression
          const compoundsAvailable = patternExercises.filter(ex => 
            ex.exerciseCategory === 'compound' && // CRITICAL: Only compounds, not power
            canUseExercise(ex.id, currentDay, ex.movementPattern, ex.exerciseCategory, ex.primaryMuscles || [], usedPrimaryMuscles) &&
            canUseOnLastDay(ex.id, isLastScheduledDay)
          );
          
          const toAdd = compoundsAvailable;
          
          for (const ex of toAdd) {
            if (actualStrengthDuration >= strengthTimeBudget - 1) break;
            
            // COMPOUND CAP ENFORCEMENT: Stop if we've hit the max compounds per day
            if (ex.exerciseCategory === 'compound' && stageOutputs.compounds.length >= MAX_COMPOUNDS_PER_DAY) {
              console.log(`[FALLBACK-CAP] Stopping compound additions - at max (${MAX_COMPOUNDS_PER_DAY}) for day ${workoutIndex}`);
              break;
            }
            
            // Re-check muscle constraint (in case multiple exercises from same pattern target same muscle)
            if (!canUseExercise(ex.id, currentDay, ex.movementPattern, ex.exerciseCategory, ex.primaryMuscles || [], usedPrimaryMuscles)) {
              continue;
            }
            
            // Determine exercise role
            const exerciseRole = ex.exerciseCategory === 'compound' ? 'secondary-compound' 
              : ex.exerciseCategory === 'core'
              ? 'core-accessory'
              : 'isolation';
            
            const params = assignTrainingParameters(ex, fitnessLevel, selectedTemplate, latestAssessment, user, exerciseRole);
            const exerciseTime = calculateExerciseTime({
              sets: params.sets,
              repsMin: params.repsMin,
              repsMax: params.repsMax,
              durationSeconds: params.durationSeconds,
              workSeconds: params.workSeconds,
              restSeconds: params.restSeconds,
            });
            
            const genEx: GeneratedExercise = {
              exerciseName: ex.name,
              equipment: selectExerciseEquipment(ex, user.equipment || []),
              ...params,
              sourceExerciseCategory: ex.exerciseCategory,
              sourceMovementPattern: ex.movementPattern,
            };
            // STAGE-BASED: Push to appropriate array based on category
            if (ex.exerciseCategory === 'compound') {
              stageOutputs.compounds.push(genEx);
            } else if (ex.exerciseCategory === 'isolation') {
              stageOutputs.isolations.push(genEx);
            } else if (ex.exerciseCategory === 'core' || ['core', 'rotation', 'carry'].includes(ex.movementPattern)) {
              stageOutputs.core.push(genEx);
            }
            movementFocus.push(pattern);
            exerciseUsageMap.set(ex.id, currentDay);
            if (workoutIndex === 1) {
              firstDayExercises.add(ex.id);
            }
            
            // Track compound pattern usage
            if (ex.exerciseCategory === 'compound') {
              compoundPatternUsage.set(ex.movementPattern, currentDay);
            }
            
            // Track primary muscles
            if (ex.primaryMuscles && ex.primaryMuscles.length > 0) {
              ex.primaryMuscles.forEach(muscle => usedPrimaryMuscles.add(muscle));
            }
            
            actualStrengthDuration += exerciseTime;
            fallbackAdded++;
            
            console.log(`[FALLBACK] Added ${ex.name} (${pattern}, ${exerciseTime.toFixed(1)}min) - new strength total: ${actualStrengthDuration.toFixed(1)}min`);
          }
        }
        
        console.log(`[FALLBACK] Complete: Added ${fallbackAdded} exercises, final strength duration: ${actualStrengthDuration.toFixed(1)}min/${strengthTimeBudget.toFixed(1)}min`);
        
        // NO CNS REORDERING NEEDED - fallback exercises are already in correct stage arrays
        // Final workout assembly happens later when we concatenate all stage arrays in CNS order
      } else {
        console.log(`[TIME-CHECK] Strength duration OK: ${actualStrengthDuration.toFixed(1)}min/${strengthTimeBudget.toFixed(1)}min (gap: ${strengthDurationGap.toFixed(1)}min)`);
      }
      
      // SCIENCE-BASED DYNAMIC WARMUP SEQUENCES (Exact specifications from user)
      // Each workout focus gets a specific warmup circuit designed for CNS preparation
      // Warmups are 1 set each, 30 seconds per exercise, superseted with no rest
      const warmupSequences: Record<string, string[]> = {
        // 3-Day Split (5 warmups each = 2.5 min total)
        squat: [
          'Squats',                     // × 15
          'Arm Circles',                // + band pull-aparts × 20
          'Walking Lunges',             // with rotation × 8/side
          'Plank Shoulder Taps',        // × 10/side
          'Cat-Cow Stretch'             // World's greatest stretch × 5/side (using Cat-Cow as substitute)
        ],
        hinge: [
          'Lying Hip Bridge',           // × 15
          'Dynamic Leg Swings',         // × 10
          'Scapular Pull-Ups',          // × 10
          'Arm Circles',                // Arm sweeps (Y-T-W) × 10 each
          'Hip Circles'                 // Hip airplanes × 6/side (using Hip Circles as substitute)
        ],
        athletic: [
          'Lateral Walks',              // × 30s
          'Squats',                     // Deep squat with thoracic reach × 5
          'Inchworm',                   // to push-up × 6
          'Walking Lunges',             // Alternating side lunges × 10/side
          'Plank Shoulder Taps'         // shoulder reach × 10/side
        ],
        
        // 4-Day Split (5 warmups each = 2.5 min total)
        lower_squat: [
          'Squats',                     // × 15
          'Hip Circles',                // Hip openers × 10/side
          'Walking Lunges',             // × 6/side
          'Arm Circles',                // Arm swings × 15
          'Ankle Circles'               // Ankle mobility × 30s
        ],
        upper_push: [
          'Pull-Aparts',                // × 15
          'Arm Circles',                // × 20
          'Push-Up',                    // Scapular push-ups × 10
          'Cat-Cow Stretch',            // × 5
          'Inchworm'                    // Plank to down dog × 6
        ],
        lower_hinge: [
          'Lying Hip Bridge',           // × 15
          'Dynamic Leg Swings',         // × 10
          'Hip Circles',                // × 10
          'Walking Lunges',             // × 10/side
          'Bird Dog'                    // × 8/side
        ],
        upper_pull: [
          'Pull-Aparts',                // Band rows × 10
          'Arm Circles',                // × 20
          'Cat-Cow Stretch',            // Thread-the-needle stretch × 5/side
          'Dynamic Shoulder Rolls',     // × 10 each
          'Dead Bug'                    // × 8/side
        ],
        
        // 5-Day Split (3 warmups each = 1.5 min total)
        push: [
          'Arm Circles',                // + band pull-aparts × 20
          'Torso Twists',               // × 10/side
          'Inchworm'                    // to push-up × 6
        ],
        pull: [
          'Scapular Pull-Ups',          // × 8
          'Pull-Aparts',                // × 15
          'Cat-Cow Stretch'             // Thoracic rotations × 5/side
        ],
        unilateral: [
          'Walking Lunges',             // Lateral lunges × 10/side
          'Cat-Cow Stretch',            // World's greatest stretch × 5/side
          'Torso Twists'                // Standing torso rotations × 10
        ]
      };
      
      // Get warmup sequence for this workout focus
      const recommendedWarmupNames = warmupSequences[workoutFocus] || warmupSequences['athletic'];
      
      console.log(`[WARMUP-FOCUS] Day ${workoutIndex} focus: ${workoutFocus}, selecting ALL ${recommendedWarmupNames.length} warmups from sequence`);
      
      const selectedWarmups: Exercise[] = [];
      const warmupNames = new Set<string>();
      
      // Add ALL warmups from the predefined sequence (no warmupCount limit)
      // 3/4-day splits have 5 warmups, 5-day splits have 3 warmups
      for (const warmupName of recommendedWarmupNames) {
        if (warmupNames.has(warmupName)) continue;
        
        const warmupEx = warmupExercises.find(ex => ex.name === warmupName);
        
        if (warmupEx) {
          selectedWarmups.push(warmupEx);
          warmupNames.add(warmupName);
        } else {
          console.warn(`[WARMUP] Warning: Exercise "${warmupName}" not found in database`);
        }
      }
      
      // Insert warmups at the beginning of exercises array
      const warmupExercises_toAdd: GeneratedExercise[] = [];
      for (const warmupEx of selectedWarmups) {
        const params = assignTrainingParameters(warmupEx, fitnessLevel, selectedTemplate, latestAssessment, user, 'warmup');
        warmupExercises_toAdd.push({
          exerciseName: warmupEx.name,
          equipment: selectExerciseEquipment(warmupEx, user.equipment || []),
          ...params,
          isWarmup: true,
          sourceExerciseCategory: warmupEx.exerciseCategory,
          sourceMovementPattern: warmupEx.movementPattern,
        });
      }
      
      // WARMUP SUPERSET PAIRING - All warmups are superseted to save time
      // Pair warmups in groups of 2 (WA1/WA2, WB1/WB2, WC1/WC2, etc.)
      if (warmupExercises_toAdd.length >= 2) {
        // Try to add one more warmup if count is odd to make pairing complete
        if (warmupExercises_toAdd.length % 2 !== 0 && warmupExercises.length > warmupExercises_toAdd.length) {
          const additionalWarmup = warmupExercises.find(ex => !warmupNames.has(ex.name));
          if (additionalWarmup) {
            const params = assignTrainingParameters(additionalWarmup, fitnessLevel, selectedTemplate, latestAssessment, user, 'warmup');
            warmupExercises_toAdd.push({
              exerciseName: additionalWarmup.name,
              equipment: selectExerciseEquipment(additionalWarmup, user.equipment || []),
              ...params,
              isWarmup: true,
              sourceExerciseCategory: additionalWarmup.exerciseCategory,
              sourceMovementPattern: additionalWarmup.movementPattern,
            });
            console.log(`[WARMUP-SUPERSET] Added ${additionalWarmup.name} to make even number for pairing`);
          }
        }
        
        const warmupSupersetGroups = ['WA', 'WB', 'WC', 'WD', 'WE', 'WF'];
        let warmupGroupIndex = 0;
        
        // Pair consecutive warmups in groups of 2
        // Process in pairs, leaving last one solo if odd count
        for (let i = 0; i < warmupExercises_toAdd.length; i += 2) {
          const warmup1 = warmupExercises_toAdd[i];
          const warmup2 = warmupExercises_toAdd[i + 1];
          
          if (warmup1 && warmup2) {
            // Pair these two warmups
            const group = warmupSupersetGroups[warmupGroupIndex];
            warmup1.supersetGroup = group;
            warmup1.supersetOrder = 1;
            warmup2.supersetGroup = group;
            warmup2.supersetOrder = 2;
            warmupGroupIndex++;
            
            console.log(`[WARMUP-SUPERSET] Paired ${group}: ${warmup1.exerciseName} + ${warmup2.exerciseName}`);
          }
          // If warmup2 is undefined (odd count), warmup1 stays as solo exercise
        }
        
        // Log if there's an unpaired warmup
        if (warmupExercises_toAdd.length % 2 !== 0) {
          const lastWarmup = warmupExercises_toAdd[warmupExercises_toAdd.length - 1];
          console.log(`[WARMUP-SUPERSET] Note: ${lastWarmup.exerciseName} remains solo (odd total count)`);
        }
        
        console.log(`[WARMUP-SUPERSET] Created ${warmupGroupIndex} warmup superset pairs, ${warmupExercises_toAdd.length} total warmups`);
      } else if (warmupExercises_toAdd.length === 1) {
        console.log(`[WARMUP-SUPERSET] Single warmup ${warmupExercises_toAdd[0].exerciseName} - no pairing needed`);
      }
      
      // Insert warmups at the beginning
      stageOutputs.warmups.push(...warmupExercises_toAdd);
      
      console.log(`[WARMUP] Selected ${selectedWarmups.length} warmups for ${workoutFocus} focus: ${selectedWarmups.map(w => w.name).join(', ')}`);
      
      // POWER EXERCISE SELECTION - WORKOUT-FOCUS-BASED CNS PREPARATION
      // Power movements are matched to workout focus for optimal CNS preparation
      // Squat/Push → Jump patterns, Hinge/Pull → Explosive hinge, Athletic → Rotational
      if (powerCount > 0) {
        // Define preferred power patterns based on workout focus
        const powerPatternMapping: Record<string, string[]> = {
          // 3-Day Split
          squat: ['squat', 'horizontal_push'],  // Jump patterns or chest pass
          hinge: ['hinge', 'vertical_pull'],    // Explosive hinge (swings)
          athletic: ['rotation', 'squat'],      // Rotational throws, broad jumps
          
          // 4-Day Split
          lower_squat: ['squat'],               // Vertical jumps, box jumps
          upper_push: ['horizontal_push'],      // Plyo push, med ball chest pass
          lower_hinge: ['hinge'],               // Hip-dominant jumps, KB swing
          upper_pull: ['vertical_pull'],        // Med ball slam, pull-up jump
          
          // 5-Day Split
          push: ['horizontal_push'],            // Plyo push, med ball throws
          pull: ['vertical_pull', 'hinge'],     // Explosive pull, high pull, slam
          unilateral: ['rotation', 'squat'],    // Rotational med ball throw
        };
        
        const preferredPowerPatterns = powerPatternMapping[workoutFocus] || ['squat'];
        console.log(`[POWER-MATCH] ${workoutFocus} focus → Preferred power patterns: ${preferredPowerPatterns.join(', ')}`);
        
        const powerExercisesFiltered = availableExercises.filter(ex => 
          ex.exerciseCategory === 'power' &&
          ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight") &&
          isExerciseAllowed(ex, movementDifficulties, fitnessLevel) &&
          canUseExercise(ex.id, currentDay, ex.movementPattern, ex.exerciseCategory, ex.primaryMuscles || [], usedPrimaryMuscles) &&
          canUseOnLastDay(ex.id, isLastScheduledDay)
        );
        
        // Select power exercises that MATCH workout focus (pattern-specific CNS prep)
        const selectedPowerExercises: Exercise[] = [];
        
        // First priority: Power exercises matching workout focus preferred patterns
        for (const pattern of preferredPowerPatterns) {
          if (selectedPowerExercises.length >= powerCount) break;
          
          const matchingPowerEx = powerExercisesFiltered.find(ex => ex.movementPattern === pattern);
          if (matchingPowerEx) {
            selectedPowerExercises.push(matchingPowerEx);
            exerciseUsageMap.set(matchingPowerEx.id, currentDay);
            if (workoutIndex === 1) {
              firstDayExercises.add(matchingPowerEx.id);
            }
            console.log(`[POWER-MATCH] Selected ${matchingPowerEx.name} (${pattern}) for ${workoutFocus} focus`);
          }
        }
        
        // Fallback: If not enough pattern-matched power, use PRIMARY patterns
        if (selectedPowerExercises.length < powerCount) {
          for (const tier of [primaryPatterns, secondaryPatterns, fallbackPatterns]) {
            if (selectedPowerExercises.length >= powerCount) break;
            
            const tierPowerExercises = powerExercisesFiltered.filter(ex => 
              tier.includes(ex.movementPattern) && 
              !selectedPowerExercises.some(selected => selected.id === ex.id)
            );
            
            for (const powerEx of tierPowerExercises) {
              if (selectedPowerExercises.length >= powerCount) break;
              selectedPowerExercises.push(powerEx);
              exerciseUsageMap.set(powerEx.id, currentDay);
              if (workoutIndex === 1) {
                firstDayExercises.add(powerEx.id);
              }
            }
          }
        }
        
        // Add selected power exercises after warmups (splice after warmup count)
        const powerExercisesToAdd: GeneratedExercise[] = [];
        for (const powerEx of selectedPowerExercises) {
          const params = assignTrainingParameters(powerEx, fitnessLevel, selectedTemplate, latestAssessment, user, 'power');
          powerExercisesToAdd.push({
            exerciseName: powerEx.name,
            equipment: selectExerciseEquipment(powerEx, user.equipment || []),
            ...params,
            sourceExerciseCategory: powerEx.exerciseCategory,
            sourceMovementPattern: powerEx.movementPattern,
          });
          
          // Track primary muscles
          if (powerEx.primaryMuscles && powerEx.primaryMuscles.length > 0) {
            powerEx.primaryMuscles.forEach(muscle => usedPrimaryMuscles.add(muscle));
          }
        }
        
        // Insert power exercises right after warmups
        stageOutputs.power.push(...powerExercisesToAdd);
        
        console.log(`[POWER] Selected ${selectedPowerExercises.length} power exercises: ${selectedPowerExercises.map(p => p.name).join(', ')}`);
      }
      
      // Add cardio exercises based on calculated time requirements and goal-specific type rotation
      // Use calculated cardioCount from above (based on workout duration)
      if (cardioCount > 0 && cardioExercises.length > 0) {
        // Determine cardio type based on nutrition goal and workout rotation
        // For MAINTAIN and LOSE goals, rotate through available types to prevent adaptation
        const availableTypes = cardioConfig.types;
        const cardioWorkoutIndex = dayOfWeek ? scheduledDays.indexOf(dayOfWeek) : workoutIndex;
        
        let selectedCardioType: string;
        if (availableTypes.length === 1) {
          // GAIN: HIIT only
          selectedCardioType = "hiit";
        } else if (availableTypes.includes("hiit") && availableTypes.includes("steady-state") && availableTypes.length === 2) {
          // MAINTAIN: Rotate between HIIT (70%) and Steady-State (30%)
          selectedCardioType = cardioWorkoutIndex % 3 === 0 ? "steady-state" : "hiit";
        } else {
          // LOSE: Rotate through all 4 types (HIIT 40%, Steady 25%, Tempo 20%, Circuit 15%)
          const rotation = cardioWorkoutIndex % 20; // Use modulo 20 for percentage-based rotation
          if (rotation < 8) selectedCardioType = "hiit";          // 40%
          else if (rotation < 13) selectedCardioType = "steady-state"; // 25%
          else if (rotation < 17) selectedCardioType = "tempo";         // 20%
          else selectedCardioType = "circuit";                          // 15%
        }
        
        console.log(`[CARDIO-TYPE] ${nutritionGoal} goal - Selected ${selectedCardioType} cardio for workout ${cardioWorkoutIndex + 1}`);
        
        // Filter cardio exercises by selected type
        // Map cardio types to exercise names/categories
        const cardioTypeFilters: Record<string, (ex: Exercise) => boolean> = {
          hiit: (ex) => ex.name.toLowerCase().includes("hiit") || 
                        ex.name.toLowerCase().includes("sprint") ||
                        ex.name.toLowerCase().includes("intervals") ||
                        ex.trackingType === "duration",
          "steady-state": (ex) => ex.name.toLowerCase().includes("steady") ||
                                   ex.name.toLowerCase().includes("rowing") ||
                                   ex.name.toLowerCase().includes("cycling") ||
                                   ex.name.toLowerCase().includes("jogging"),
          tempo: (ex) => ex.name.toLowerCase().includes("tempo") ||
                         ex.name.toLowerCase().includes("threshold"),
          circuit: (ex) => ex.name.toLowerCase().includes("circuit") ||
                           ex.name.toLowerCase().includes("burpee") ||
                           ex.name.toLowerCase().includes("mountain climber")
        };
        
        const typeFilter = cardioTypeFilters[selectedCardioType] || (() => true);
        const filteredCardio = cardioExercises.filter(typeFilter);
        
        // Fallback to any cardio if no exercises match the filter
        const cardioPool = filteredCardio.length > 0 ? filteredCardio : cardioExercises;
        
        const selectedCardio: Exercise[] = [];
        for (const cardioEx of cardioPool) {
          if (selectedCardio.length >= cardioCount) break;
          if (canUseExercise(cardioEx.id, currentDay, cardioEx.movementPattern, cardioEx.exerciseCategory, cardioEx.primaryMuscles || [], usedPrimaryMuscles) && 
              canUseOnLastDay(cardioEx.id, isLastScheduledDay)) {
            selectedCardio.push(cardioEx);
            exerciseUsageMap.set(cardioEx.id, currentDay);
            if (workoutIndex === 1) {
              firstDayExercises.add(cardioEx.id);
            }
          }
        }
        
        for (const cardioEx of selectedCardio) {
          const params = assignTrainingParameters(cardioEx, fitnessLevel, selectedTemplate, latestAssessment, user, 'cardio', undefined, undefined, cardioTimePerExercise);
          const cardioExercise: GeneratedExercise = {
            exerciseName: cardioEx.name,
            equipment: selectExerciseEquipment(cardioEx, user.equipment || []),
            ...params,
            sourceExerciseCategory: cardioEx.exerciseCategory,
            sourceMovementPattern: cardioEx.movementPattern,
          };
          stageOutputs.cardio.push(cardioExercise);
          movementFocus.push("cardio");
        }
      }
      
      // FINAL ASSEMBLY: Build complete workout from ALL stage arrays in CNS order
      // This happens AFTER warmup/power/cardio are selected
      // CNS Order: Warmup → Power → Compounds → Isolations → Core → Cardio
      exercises = [
        ...stageOutputs.warmups,
        ...stageOutputs.power,
        ...stageOutputs.compounds,
        ...stageOutputs.isolations,
        ...stageOutputs.core,
        ...stageOutputs.cardio
      ];
      
      // Rebuild movementFocus to match final order
      movementFocus = exercises.map((ex: any) => ex.sourceMovementPattern || 'unknown');
      
      console.log(`[FINAL-ASSEMBLY] Complete workout: ${stageOutputs.warmups.length}w + ${stageOutputs.power.length}p + ${stageOutputs.compounds.length}c + ${stageOutputs.isolations.length}i + ${stageOutputs.core.length}core + ${stageOutputs.cardio.length}cardio = ${exercises.length} total exercises`);
      
      // Determine workout type based on primary focus
      let workoutType: "strength" | "cardio" | "hiit" | "mobility" | null = "strength";
      if (selectedTemplate.structure.cardioFocus > 50) {
        workoutType = "cardio";
      }
      
      // Generate descriptive workout name based on movement patterns
      const descriptiveWorkoutName = generateWorkoutName(movementFocus, workoutType);
      
      // Push workout with both dayOfWeek (legacy) and workoutIndex (new)
      workouts.push({
        dayOfWeek,          // LEGACY: undefined in new mode, dayOfWeek number in legacy mode
        workoutIndex,       // NEW: Sequential workout number (1, 2, 3, ... N)
        workoutName: descriptiveWorkoutName,
        workoutType,
        movementFocus: Array.from(new Set(movementFocus)),
        exercises,
      });
      
      // UPDATE PREVIOUS DAY MUSCLES FOR CONSECUTIVE DAY RECOVERY
      // Clear previous muscles and add current workout's heavily worked muscles
      previousDayMuscles.clear();
      usedPrimaryMuscles.forEach(muscle => previousDayMuscles.add(muscle));
      
      console.log(`[RECOVERY] Updated previous day muscles for next workout: ${Array.from(previousDayMuscles).join(', ') || 'none'}`);
    } else {
      // REST DAY: Only generate rest days in LEGACY mode (when using selectedDays)
      // In NEW mode (selectedDates), we only generate actual workout days
      if (!useSelectedDates) {
        workouts.push({
          dayOfWeek,          // LEGACY: dayOfWeek number for rest day
          workoutIndex: undefined, // No workoutIndex for rest days
          workoutName: `${dayName} - Rest Day`,
          workoutType: null,
          movementFocus: [],
          exercises: [],
        });
      }
      
      // Clear previous day muscles after rest day (full recovery)
      previousDayMuscles.clear();
      console.log(`[RECOVERY] Rest day - cleared previous day muscles for full recovery`);
    }
  }
  
  const program: GeneratedProgram = {
    programType: selectedTemplate.name,
    weeklyStructure: selectedTemplate.description,
    durationWeeks: 4, // Reduced from 8 to 4 weeks for faster generation and progress check
    workouts,
  };
  
  console.log(`[TEMPLATE-BASED] Generated ${workouts.length} workouts (${scheduledDays.length} workout days + ${7 - scheduledDays.length} rest days per week)`);
  
  return program;
}

// Stub functions for exercise swapping and progression - can be enhanced later with template-based logic
export async function suggestExerciseSwap(
  currentExerciseName: string,
  targetMovementPattern: string,
  availableEquipment: string[],
  reason?: string
): Promise<string[]> {
  // Simple template-based swap: return exercises from same movement pattern
  // This is a placeholder - can be enhanced later
  return [];
}

export async function generateProgressionRecommendation(
  exerciseName: string,
  recentPerformance: {
    weight: number;
    reps: number;
    rir: number;
  }[]
): Promise<{
  recommendation: string;
  suggestedWeight?: number;
  suggestedReps?: number;
  reasoning: string;
}> {
  // Simple template-based progression logic
  const avgRIR = recentPerformance.reduce((sum, p) => sum + p.rir, 0) / recentPerformance.length;
  
  if (avgRIR > 3) {
    return {
      recommendation: "increase weight",
      suggestedWeight: recentPerformance[0].weight * 1.05, // 5% increase
      reasoning: "High RIR indicates readiness for weight increase",
    };
  } else if (avgRIR < 1) {
    return {
      recommendation: "deload",
      suggestedWeight: recentPerformance[0].weight * 0.9, // 10% decrease
      reasoning: "Low RIR suggests fatigue - deload recommended",
    };
  } else {
    return {
      recommendation: "maintain",
      reasoning: "Current load is appropriate",
    };
  }
}
