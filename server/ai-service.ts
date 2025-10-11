import type { User, FitnessAssessment, Exercise } from "@shared/schema";
import { selectProgramTemplate, type ProgramTemplate } from "./programTemplates";
import { 
  calculateMovementPatternLevels, 
  getMovementDifficultiesMap, 
  isExerciseAllowed 
} from "@shared/utils";
import { 
  EXPERIENCE_LEVELS, 
  NUTRITION_GOALS, 
  MOVEMENT_PATTERNS, 
  CARDIO_TYPES,
  type ExperienceLevel, 
  type NutritionGoal 
} from "@shared/constants";

export interface ProgramGenerationInput {
  user: User;
  latestAssessment: FitnessAssessment;
  availableExercises: Exercise[];
}

export interface GeneratedProgram {
  programType: string;
  weeklyStructure: string;
  durationWeeks: number;
  workouts: GeneratedWorkout[];
}

export interface GeneratedWorkout {
  dayOfWeek: number;
  workoutName: string;
  workoutType: "strength" | "cardio" | "hiit" | "mobility" | null;
  movementFocus: string[];
  exercises: GeneratedExercise[];
}

export interface GeneratedExercise {
  exerciseName: string;
  equipment: string;  // Specific equipment to use for this exercise (from user's available equipment)
  sets: number;
  repsMin?: number;
  repsMax?: number;
  recommendedWeight?: number;  // Recommended starting weight in user's unit preference
  durationSeconds?: number;
  workSeconds?: number;  // For HIIT exercises: work interval duration
  restSeconds: number;
  tempo?: string;  // Tempo notation (e.g., '2-0-2-0', '1-0-X-0', 'Hold')
  targetRPE?: number;  // Rate of Perceived Exertion (1-10)
  targetRIR?: number;  // Reps in Reserve (0-5)
  notes?: string;
  isWarmup?: boolean;  // Flag to identify warmup exercises
  supersetGroup?: string;  // "A", "B", "C" for superset grouping
  supersetOrder?: number;  // 1 or 2 to indicate order in superset
}

// Helper function to generate descriptive workout names based on movement patterns
function generateWorkoutName(movementFocus: string[], workoutType: "strength" | "cardio" | "hiit" | "mobility" | null, dayName: string): string {
  // Filter out duplicate patterns
  const uniquePatterns = Array.from(new Set(movementFocus));
  
  // Handle cardio/HIIT workouts
  if (workoutType === "cardio" || workoutType === "hiit") {
    return `${dayName} - Cardio & Conditioning`;
  }
  
  // Categorize patterns
  const upperPush = uniquePatterns.filter(p => ["horizontal_push", "vertical_push"].includes(p)).length > 0;
  const upperPull = uniquePatterns.filter(p => p === "pull").length > 0;
  const lowerBody = uniquePatterns.filter(p => ["squat", "lunge", "hinge"].includes(p)).length > 0;
  const core = uniquePatterns.filter(p => ["core", "rotation"].includes(p)).length > 0;
  const cardioIncluded = uniquePatterns.filter(p => p === "cardio").length > 0;
  
  // Generate descriptive name based on focus
  if (upperPush && upperPull && lowerBody) {
    return `${dayName} - Full Body Strength`;
  }
  
  if (upperPush && !upperPull && !lowerBody) {
    return core ? `${dayName} - Push & Core` : `${dayName} - Upper Body Push`;
  }
  
  if (upperPull && !upperPush && !lowerBody) {
    return core ? `${dayName} - Pull & Core` : `${dayName} - Upper Body Pull`;
  }
  
  if (upperPush && upperPull && !lowerBody) {
    return `${dayName} - Upper Body Power`;
  }
  
  if (lowerBody && !upperPush && !upperPull) {
    return core ? `${dayName} - Lower Body & Core` : `${dayName} - Lower Body Strength`;
  }
  
  if (lowerBody && (upperPush || upperPull)) {
    if (cardioIncluded) {
      return `${dayName} - Total Body Conditioning`;
    }
    return `${dayName} - Full Body Power`;
  }
  
  // Default fallback
  return `${dayName} - Strength Training`;
}

// Helper function to select exercises based on movement pattern
function selectExercisesByPattern(
  exercises: Exercise[],
  pattern: string,
  count: number,
  canUseExerciseFn: (exerciseId: string, exercisePattern: string) => boolean,
  onSelectFn?: (exerciseId: string) => void
): Exercise[] {
  const available = exercises.filter(
    ex => ex.movementPattern === pattern && canUseExerciseFn(ex.id, ex.movementPattern)
  );
  
  // Prioritize compound exercises
  const compound = available.filter(ex => ex.liftType === "compound");
  const isolation = available.filter(ex => ex.liftType === "isolation");
  
  const selected: Exercise[] = [];
  
  // First, add compound exercises
  for (const ex of compound) {
    if (selected.length >= count) break;
    selected.push(ex);
    // Track immediately when selected
    if (onSelectFn) onSelectFn(ex.id);
  }
  
  // Then add isolation if needed
  for (const ex of isolation) {
    if (selected.length >= count) break;
    selected.push(ex);
    // Track immediately when selected
    if (onSelectFn) onSelectFn(ex.id);
  }
  
  return selected;
}

// Helper function to identify weak movement patterns from fitness assessment
function identifyWeakMovementPatterns(assessment: FitnessAssessment, user: User): string[] {
  const weakPatterns: string[] = [];
  const experienceLevel = assessment.experienceLevel || user.fitnessLevel || "beginner";
  
  // Beginners don't get supersets - they need full recovery
  if (experienceLevel === "beginner") {
    return [];
  }
  
  // Define thresholds based on experience level
  const thresholds = {
    intermediate: {
      pushups: 30,
      pullups: 8,
      squats: 50,
      plankHold: 60,
    },
    advanced: {
      pushups: 50,
      pullups: 15,
      squats: 75,
      plankHold: 90,
    },
  };
  
  const threshold = thresholds[experienceLevel as 'intermediate' | 'advanced'] || thresholds.intermediate;
  
  // Check horizontal push strength (chest pressing)
  if (assessment.pushups !== null && assessment.pushups !== undefined && assessment.pushups < threshold.pushups) {
    weakPatterns.push('horizontal_push');
  }
  
  // Check vertical push strength (shoulder pressing)
  if (assessment.pikePushups !== null && assessment.pikePushups !== undefined && assessment.pikePushups < (threshold.pushups * 0.75)) {
    weakPatterns.push('vertical_push');
  }
  
  // Check pull strength (back, biceps)
  if (assessment.pullups !== null && assessment.pullups !== undefined && assessment.pullups < threshold.pullups) {
    weakPatterns.push('pull');
  }
  
  // Check lower body strength (quads, glutes, hamstrings)
  if (assessment.squats !== null && assessment.squats !== undefined && assessment.squats < threshold.squats) {
    weakPatterns.push('squat');
  }
  
  // Check core strength
  if (assessment.plankHold !== null && assessment.plankHold !== undefined && assessment.plankHold < threshold.plankHold) {
    weakPatterns.push('core');
  }
  
  return weakPatterns;
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
    ex.liftType === 'isolation' &&
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
  const TRANSITION_TIME = 0.5; // 30 seconds in minutes
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
  if (exerciseRole === 'power' || exercise.isPower === 1) {
    const powerParams = {
      beginner: { sets: 3, repsMin: 3, repsMax: 3, restSeconds: 180 },     // 3x3 @ 3min rest
      intermediate: { sets: 4, repsMin: 2, repsMax: 3, restSeconds: 240 }, // 4x2-3 @ 4min rest
      advanced: { sets: 5, repsMin: 1, repsMax: 2, restSeconds: 300 }      // 5x1-2 @ 5min rest
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
  if (exerciseRole === 'warmup' || exercise.exerciseType === "warmup") {
    return {
      sets: 2,
      repsMin: 10,
      repsMax: 15,
      restSeconds: 30,
      tempo: '1-0-1-0', // Faster tempo for warmups
    };
  }
  
  // HIIT/Cardio exercises - use goal-specific duration
  if (exerciseRole === 'cardio' || exercise.workoutType === "hiit" || exercise.workoutType === "cardio") {
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
      // Strength focus: Lower reps, more sets, longer rest
      sets = fitnessLevel === "beginner" ? 4 : 5;
      repsMin = 4;
      repsMax = 6;
      restSeconds = 180; // 3 minutes for primary compounds
      break;
      
    case 'secondary-compound':
      // Hypertrophy focus: Moderate reps, moderate sets
      sets = fitnessLevel === "beginner" ? 3 : 4;
      repsMin = 8;
      repsMax = 12;
      restSeconds = 90; // 90s for hypertrophy work
      break;
      
    case 'isolation':
      // Hypertrophy focus: Higher reps, moderate sets, shorter rest
      sets = 3;
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
  
  // For compound movements, use 1RM data if available
  if (exercise.liftType === "compound" && assessment) {
    const percentage = repsMax > 12 ? 0.65 : repsMax > 8 ? 0.75 : 0.80;
    
    if (exercise.movementPattern === "push" && assessment.benchPress1rm) {
      recommendedWeight = Math.round(assessment.benchPress1rm * percentage);
    } else if (exercise.movementPattern === "squat" && assessment.squat1rm) {
      recommendedWeight = Math.round(assessment.squat1rm * percentage);
    } else if (exercise.movementPattern === "hinge" && assessment.deadlift1rm) {
      recommendedWeight = Math.round(assessment.deadlift1rm * percentage);
    } else if (exercise.movementPattern === "pull" && assessment.barbellRow1rm) {
      recommendedWeight = Math.round(assessment.barbellRow1rm * percentage);
    }
  }
  
  // Fallback: estimate weights from bodyweight test data
  if (!recommendedWeight && exercise.equipment?.some(eq => eq !== "bodyweight")) {
    if (exercise.movementPattern === "push" && assessment.pushups) {
      if (assessment.pushups < 15) recommendedWeight = user.unitPreference === "imperial" ? 50 : 22;
      else if (assessment.pushups < 30) recommendedWeight = user.unitPreference === "imperial" ? 75 : 34;
      else recommendedWeight = user.unitPreference === "imperial" ? 95 : 43;
    } else if (exercise.movementPattern === "pull" && assessment.pullups !== undefined && assessment.pullups !== null) {
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

export async function generateWorkoutProgram(
  input: ProgramGenerationInput
): Promise<GeneratedProgram> {
  const { user, latestAssessment, availableExercises } = input;

  // Strictly enforce 3-5 days per week (only supported values)
  let daysPerWeek = user.daysPerWeek || 3;
  if (![3, 4, 5].includes(daysPerWeek)) {
    console.warn(`[VALIDATION] Invalid daysPerWeek ${daysPerWeek}, defaulting to 3`);
    daysPerWeek = 3;
  }
  const fitnessLevel = latestAssessment.experienceLevel || user.fitnessLevel || "beginner";
  const workoutDuration = user.workoutDuration || 60; // Default to 60 minutes

  // REQUIRED WEEKLY MOVEMENTS - Ensures foundational exercises appear every week
  // Beginners use simpler equipment, Intermediate/Advanced use barbell-focused lifts
  // Names must match EXACTLY with exercise database entries
  const requiredMovements = {
    beginner: [
      { name: "Goblet Squat", pattern: "squat", alternatives: ["Squat", "Bodyweight Jump Squats"] },  // Bodyweight alternatives
      { name: "Lying Hip Bridge", pattern: "hinge" },  // Bodyweight exercise, no alternative needed
      { name: "Overhead Press", pattern: "vertical_push", alternatives: ["Pike Push-Up"] },  // Bodyweight shoulder press alternative
      { name: "Push-Up", pattern: "horizontal_push" },  // Already bodyweight
      { name: "Pull-Up", pattern: "pull", alternatives: ["Scapular Pull-Ups"] },  // Beginner pull-ups
      { name: "Bent-Over Row", pattern: "pull", alternatives: ["Band-Resisted Fast Rows"] },  // Row variations
      { name: "Forward Lunge", pattern: "lunge", alternatives: ["Reverse Lunge Knee Drive", "Lateral Lunge"] },  // All use bodyweight
      { name: "Farmer's Carry", pattern: "carry" }  // Requires equipment (dumbbells/kettlebells/medicine ball)
      // Core: Any core exercise is acceptable (tracked by pattern)
    ],
    intermediate: [
      { name: "Back Squat", pattern: "squat", alternatives: ["Front Squat"] },
      { name: "Deadlift", pattern: "hinge" },
      { name: "Overhead Press", pattern: "vertical_push" },  // Barbell OHP
      { name: "Bench Press", pattern: "horizontal_push" },
      { name: "Pull-Up", pattern: "pull" },
      { name: "Bent-Over Row", pattern: "pull", alternatives: ["Barbell Row"] },
      { name: "Walking Lunge", pattern: "lunge", alternatives: ["Lunge"] },
      { name: "Suitcase Carry", pattern: "carry", alternatives: ["Farmer's Carry"] }
      // Core: Any core exercise is acceptable (tracked by pattern)
    ],
    advanced: [
      { name: "Back Squat", pattern: "squat", alternatives: ["Front Squat"] },
      { name: "Deadlift", pattern: "hinge" },
      { name: "Overhead Press", pattern: "vertical_push" },
      { name: "Bench Press", pattern: "horizontal_push" },
      { name: "Pull-Up", pattern: "pull" },
      { name: "Bent-Over Row", pattern: "pull", alternatives: ["Barbell Row"] },
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
    pull: movementDifficulties.pull,
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
      ex.exerciseType === "warmup" &&
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
  // Only include "main" exercises - exclude warmup and cooldown from main workout selection
  availableExercises.forEach((ex) => {
    if (ex.exerciseType === "main" && 
        ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight") &&
        isExerciseAllowed(ex, movementDifficulties, fitnessLevel) &&
        exercisesByPattern[ex.movementPattern]) {
      exercisesByPattern[ex.movementPattern].push(ex);
    }
  });

  //  Determine scheduled days for the week
  // Only support 3, 4, or 5 days per week for optimal programming
  const daySchedules: { [key: number]: number[] } = {
    3: [1, 3, 5],       // Monday, Wednesday, Friday
    4: [1, 2, 4, 5],    // Monday, Tuesday, Thursday, Friday
    5: [1, 2, 3, 4, 5], // Monday-Friday
  };

  const scheduledDays = user.selectedDays && user.selectedDays.length === daysPerWeek 
    ? user.selectedDays 
    : daySchedules[daysPerWeek] || daySchedules[3];
  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Select the appropriate program template based on user's nutrition goal
  const selectedTemplate = selectProgramTemplate(user.nutritionGoal, latestAssessment.experienceLevel);
  console.log(`[TEMPLATE] Selected template: ${selectedTemplate.name} for nutrition goal: ${user.nutritionGoal}`);
  
  // WEEK-LEVEL PATTERN DISTRIBUTION
  // Design entire week's pattern emphasis before selecting exercises
  // This ensures variety and proper recovery between similar movement patterns
  type DayPlan = { primary: string[], secondary: string[] };
  type WeeklyDistribution = Record<number, Record<number, DayPlan>>;
  
  const weeklyPatternDistribution: WeeklyDistribution = {
    3: {
      // 3-day: Pull+Hinge → Horizontal Push+Squat → Vertical Push+Pull Mix
      1: { primary: ['pull', 'hinge'], secondary: ['core', 'carry'] },
      2: { primary: ['horizontal_push', 'squat'], secondary: ['core', 'rotation'] },
      3: { primary: ['pull', 'vertical_push'], secondary: ['lunge', 'hinge', 'core'] }
    },
    4: {
      // 4-day: Pull+Horizontal Push → Lower → Vertical Push+Pull → Lower (alternating emphasis)
      1: { primary: ['pull', 'horizontal_push'], secondary: ['core', 'rotation'] },
      2: { primary: ['squat', 'hinge'], secondary: ['lunge', 'core'] },
      3: { primary: ['vertical_push', 'pull'], secondary: ['core', 'carry'] },
      4: { primary: ['lunge', 'squat'], secondary: ['hinge', 'core'] }
    },
    5: {
      // 5-day: Horizontal Push → Pull → Legs → Vertical Push+Pull → Lower (classic split)
      1: { primary: ['horizontal_push'], secondary: ['rotation', 'core'] },
      2: { primary: ['pull'], secondary: ['carry', 'core'] },
      3: { primary: ['squat', 'lunge'], secondary: ['hinge', 'core'] },
      4: { primary: ['vertical_push', 'pull'], secondary: ['core'] },
      5: { primary: ['hinge', 'squat'], secondary: ['lunge', 'core'] }
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
      60: { warmup: 7, power: 18, strength: 60, cardio: 10 },
      90: { warmup: 8, power: 17, strength: 58, cardio: 12 }   // Can add more cardio with extra time
    },
    maintain: {
      30: { warmup: 6, power: 17, strength: 60, cardio: 12 },  // Balanced approach
      45: { warmup: 6, power: 17, strength: 58, cardio: 15 },
      60: { warmup: 7, power: 18, strength: 55, cardio: 18 },
      90: { warmup: 8, power: 17, strength: 52, cardio: 20 }
    },
    lose: {
      30: { warmup: 5, power: 15, strength: 55, cardio: 20 },  // Max cardio even in short sessions
      45: { warmup: 5, power: 15, strength: 53, cardio: 23 },
      60: { warmup: 6, power: 16, strength: 50, cardio: 25 },
      90: { warmup: 7, power: 15, strength: 48, cardio: 28 }   // Extended cardio for fat loss
    }
  };
  
  // Get allocation percentages for current goal and duration
  const nutritionGoal = user.nutritionGoal || "maintain";
  const getDurationKey = (duration: number): number => {
    if (duration <= 35) return 30;
    if (duration <= 52) return 45;
    if (duration <= 75) return 60;
    return 90;
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
  
  // Warmup exercise (2 sets, 12 reps avg, 30s rest): ~2min
  const warmupTimePerExercise = calculateExerciseTime({
    sets: 2,
    repsMin: 10,
    repsMax: 15,
    restSeconds: 30
  });
  
  // Primary compound (5 sets, 5 reps avg, 180s rest): ~13.5min
  const primaryCompoundTime = calculateExerciseTime({
    sets: 5,
    repsMin: 4,
    repsMax: 6,
    restSeconds: 180
  });
  
  // Secondary compound/hypertrophy (4 sets, 10 reps avg, 90s rest): ~6.7min
  const secondaryCompoundTime = calculateExerciseTime({
    sets: 4,
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
  // Power exercises have longer rest periods based on fitness level
  const powerExerciseTime = calculateExerciseTime({
    sets: fitnessLevel === "beginner" ? 3 : fitnessLevel === "intermediate" ? 4 : 5,
    repsMin: fitnessLevel === "advanced" ? 1 : 2,
    repsMax: fitnessLevel === "beginner" ? 3 : 3,
    restSeconds: fitnessLevel === "beginner" ? 180 : fitnessLevel === "intermediate" ? 240 : 300
  });
  
  // PERCENTAGE-BASED TIME ALLOCATION
  // Use calculated budgets from allocation matrix to determine exercise counts
  
  // Step 1: WARMUP ALLOCATION (percentage-based)
  const warmupCount = Math.max(1, Math.floor(warmupTimeBudget / warmupTimePerExercise));
  console.log(`[TIME-ALLOC] Warmup: ${warmupTimeBudget.toFixed(1)}min (${allocation.warmup}%) → ${warmupCount} exercises`);
  
  // Step 2: POWER EXERCISE ALLOCATION (percentage-based)
  const powerCount = Math.max(0, Math.floor(powerTimeBudget / powerExerciseTime));
  console.log(`[TIME-ALLOC] Power: ${powerTimeBudget.toFixed(1)}min (${allocation.power}%) → ${powerCount} exercises`);
  
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
  const templateWantsCardio = selectedTemplate.structure.workoutStructure.cardioExercises > 0;
  const cardioCount = (templateWantsCardio && cardioTimeBudget > 0) ? 1 : 0;
  console.log(`[TIME-ALLOC] Cardio: ${cardioTimeBudget.toFixed(1)}min (${allocation.cardio}%) → ${cardioCount} finisher`);
  
  const mainCount = primaryCount + secondaryCount;
  
  const estimatedTotal = (warmupCount * warmupTimePerExercise) + 
                         (powerCount * powerExerciseTime) +
                         (primaryCount * primaryCompoundTime) +
                         (secondaryCount * secondaryCompoundTime) +
                         (cardioCount * cardioTimeBudget);
  
  console.log(`[EXERCISE-CALC] For ${workoutDuration}min ${nutritionGoal.toUpperCase()} session: ${warmupCount}w + ${powerCount}p + ${primaryCount}pri + ${secondaryCount}sec + ${cardioCount}c = ${estimatedTotal.toFixed(1)}min. Supersets: ${useSupersets ? 'YES' : 'NO'}`);
  
  // Template-based workout generation - Generate ALL 7 days for entire program duration
  const workouts: GeneratedWorkout[] = [];
  
  // SMART EXERCISE REUSE TRACKING
  // Track when each exercise was used (day number) for intelligent reuse
  // Core/rotation/carry can repeat after 2+ days, compounds blocked for full week
  const exerciseUsageMap = new Map<string, number>(); // exerciseId -> dayOfWeek used
  const firstDayExercises = new Set<string>(); // Track day 1 exercises for cross-week recovery
  
  // Helper function to check if exercise can be used
  const canUseExercise = (exerciseId: string, currentDay: number, exercisePattern: string): boolean => {
    const lastUsedDay = exerciseUsageMap.get(exerciseId);
    
    // Not used yet - can use
    if (lastUsedDay === undefined) return true;
    
    // Reusable patterns (core, rotation, carry) can repeat after 2+ days
    const reusablePatterns = ['core', 'rotation', 'carry'];
    if (reusablePatterns.includes(exercisePattern)) {
      const daysSince = currentDay - lastUsedDay;
      return daysSince >= 2;
    }
    
    // Main compound lifts blocked for full week
    return false;
  };
  
  // Helper to check cross-week recovery (last day can't reuse first day exercises)
  const canUseOnLastDay = (exerciseId: string, isLastScheduledDay: boolean): boolean => {
    if (!isLastScheduledDay) return true;
    return !firstDayExercises.has(exerciseId);
  };
  
  // Generate workouts for each day of the week (1-7 = Monday-Sunday)
  for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
    const dayName = dayNames[dayOfWeek];
    const isScheduledDay = scheduledDays.includes(dayOfWeek);
    
    if (isScheduledDay) {
      // WORKOUT DAY: Generate actual workout with exercises
      const exercises: GeneratedExercise[] = [];
      const movementFocus: string[] = [];
      
      // Get workout index (1st workout, 2nd workout, etc.)
      const workoutIndex = scheduledDays.indexOf(dayOfWeek) + 1;
      
      // Get weekly pattern distribution for this specific workout
      const weekPlan = weeklyPatternDistribution[daysPerWeek];
      const dayPlan = weekPlan[workoutIndex];
      
      if (!dayPlan) {
        console.warn(`[WEEK-PLAN] No pattern distribution found for day ${workoutIndex} in ${daysPerWeek}-day program, using default`);
      }
      
      // PRIORITY-BASED PATTERN DISTRIBUTION SYSTEM
      // Use week-level pattern distribution with priority/emphasis approach
      // First select from priority patterns, then fill remaining time from other patterns
      const primaryPatterns = dayPlan?.primary || [];
      const secondaryPatterns = dayPlan?.secondary || [];
      const allPatterns = ['horizontal_push', 'vertical_push', 'pull', 'squat', 'lunge', 'hinge', 'core', 'rotation', 'carry'];
      const usedPatterns = new Set([...primaryPatterns, ...secondaryPatterns]);
      const fallbackPatterns = allPatterns.filter(p => !usedPatterns.has(p));
      
      console.log(`[WEEK-PLAN] Day ${workoutIndex} (${dayName}): Primary=${primaryPatterns.join(', ')}, Secondary=${secondaryPatterns.join(', ')}, Fallback=${fallbackPatterns.join(', ')}`);
      const compoundExercises: { exercise: Exercise; pattern: string }[] = [];
      
      // Track if this is the last scheduled workout day
      const isLastScheduledDay = workoutIndex === scheduledDays.length;
      
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
      const compoundSlotsToFill = mainCount - reservedSupersetSlots;
      
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
          ex.exerciseType === "main" &&
          ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight") &&
          allowedDifficulties.includes(ex.difficulty) &&
          canUseExercise(ex.id, dayOfWeek, ex.movementPattern) &&
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
          
          if (foundExercise.liftType === 'compound') {
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
          exercises.push({
            exerciseName: foundExercise.name,
            equipment: foundExercise.equipment?.[0] || "bodyweight",
            ...params,
          });
          movementFocus.push(requiredMov.pattern);
          
          if (foundExercise.liftType === 'compound') {
            compoundExercises.push({ exercise: foundExercise, pattern: requiredMov.pattern });
            compoundExercisesAdded++;  // Count compounds toward slot limit
          }
          
          // Mark as used in tracking systems
          weeklyMovementTracker.add(requiredMov.name);
          exerciseUsageMap.set(foundExercise.id, dayOfWeek);
          if (workoutIndex === 1) {
            firstDayExercises.add(foundExercise.id);
          }
          
          console.log(`[REQUIRED-ADDED] ✓ ${foundExercise.name} (${requiredMov.pattern}) - Required movement added on day ${workoutIndex}, Compounds: ${compoundExercisesAdded}/${compoundSlotsToFill}`);
        }
      }
      
      // Check for core pattern requirement (any core exercise counts)
      if (!hasUsedCoreMovement.used && (primaryPatterns.includes('core') || secondaryPatterns.includes('core'))) {
        const coreExercises = exercisesByPattern['core'] || [];
        const coreEx = coreExercises.find(ex => 
          canUseExercise(ex.id, dayOfWeek, ex.movementPattern) &&
          canUseOnLastDay(ex.id, isLastScheduledDay)
        );
        
        if (coreEx && exercises.length < compoundSlotsToFill) {
          const params = assignTrainingParameters(coreEx, fitnessLevel, selectedTemplate, latestAssessment, user, 'core-accessory');
          exercises.push({
            exerciseName: coreEx.name,
            equipment: coreEx.equipment?.[0] || "bodyweight",
            ...params,
          });
          movementFocus.push('core');
          exerciseUsageMap.set(coreEx.id, dayOfWeek);
          if (workoutIndex === 1) {
            firstDayExercises.add(coreEx.id);
          }
          hasUsedCoreMovement.used = true;
          console.log(`[REQUIRED-ADDED] ✓ ${coreEx.name} (core) - Core requirement fulfilled on day ${workoutIndex}`);
        }
      }
      
      console.log(`[REQUIRED-CHECK] After required movements: ${exercises.length}/${compoundSlotsToFill} exercises`);
      
      // TIERED PATTERN SELECTION: Priority → Secondary → Fallback
      // This ensures workouts fill the target duration while maintaining variety
      const patternTiers = [
        { name: 'PRIMARY', patterns: primaryPatterns },
        { name: 'SECONDARY', patterns: secondaryPatterns },
        { name: 'FALLBACK', patterns: fallbackPatterns }
      ];
      
      for (const tier of patternTiers) {
        if (exercises.length >= compoundSlotsToFill) break;
        
        const exercisesPerPattern = Math.ceil((compoundSlotsToFill - exercises.length) / tier.patterns.length);
        console.log(`[PATTERN-TIER] ${tier.name} tier: need ${compoundSlotsToFill - exercises.length} more exercises, ${exercisesPerPattern} per pattern from [${tier.patterns.join(', ')}]`);
        
        for (const pattern of tier.patterns) {
          if (exercises.length >= compoundSlotsToFill) break;
          
          // Use pre-filtered exercises from pattern map (optimization)
          const patternExercises = exercisesByPattern[pattern] || [];
          const selected = selectExercisesByPattern(
            patternExercises, 
            pattern, 
            exercisesPerPattern, 
            (exId, exPattern) => canUseExercise(exId, dayOfWeek, exPattern) && canUseOnLastDay(exId, isLastScheduledDay),
            (exId) => {
              // Track immediately when selected
              exerciseUsageMap.set(exId, dayOfWeek);
              if (workoutIndex === 1) {
                firstDayExercises.add(exId);
              }
            }
          );
          
          for (const ex of selected) {
            if (exercises.length >= compoundSlotsToFill) break;
            
            // Determine exercise role based on REMAINING SLOTS (respects time-based allocation)
            let exerciseRole: 'primary-compound' | 'secondary-compound' | 'isolation' | 'core-accessory' | 'warmup' | 'cardio';
            
            if (ex.liftType === 'compound') {
              if (primarySlotsRemaining > 0) {
                exerciseRole = 'primary-compound';
                primarySlotsRemaining--;
              } else if (secondarySlotsRemaining > 0) {
                exerciseRole = 'secondary-compound';
                secondarySlotsRemaining--;
              } else {
                // No slots remaining, skip this exercise
                continue;
              }
            } else if (ex.movementPattern === 'core' || ex.movementPattern === 'rotation' || ex.movementPattern === 'carry') {
              exerciseRole = 'core-accessory';
            } else {
              exerciseRole = 'isolation';
            }
            
            const params = assignTrainingParameters(ex, fitnessLevel, selectedTemplate, latestAssessment, user, exerciseRole);
            exercises.push({
              exerciseName: ex.name,
              equipment: ex.equipment?.[0] || "bodyweight",
              ...params,
            });
            movementFocus.push(pattern);
            
            // Note: Exercise usage already tracked in selectExercisesByPattern callback
            
            // Track compound exercises for superset logic
            if (ex.liftType === 'compound') {
              compoundExercises.push({ exercise: ex, pattern });
            }
          }
        }
      }
      
      console.log(`[PATTERN-TIER] Final: ${exercises.length}/${compoundSlotsToFill} exercises selected`);
      
      // SUPERSET PAIRING FOR 30-45 MIN WORKOUTS
      // Pair antagonistic or non-competing exercises to maximize time efficiency
      if (useSupersets && exercises.length >= 2) {
        console.log(`[SUPERSET] Short workout (${workoutDuration}min) - pairing exercises for efficiency`);
        
        // Define antagonistic pattern pairs (can be done back-to-back with minimal fatigue)
        const antagonisticPairs: Record<string, string[]> = {
          push: ['pull', 'hinge'],
          pull: ['push', 'squat'],
          squat: ['hinge', 'pull'],
          hinge: ['squat', 'push'],
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
      
      // Backfill unused reserved slots with additional exercises (compound or isolation)
      // Use the same tiered pattern approach: Primary → Secondary → Fallback
      if (reservedSupersetSlots > 0 && exercises.length < mainCount) {
        const exercisesNeeded = mainCount - exercises.length;
        console.log(`[BACKFILL] Need ${exercisesNeeded} more exercises to reach mainCount`);
        
        // Use same tiered pattern approach for backfilling
        for (const tier of patternTiers) {
          if (exercises.length >= mainCount) break;
          
          for (const pattern of tier.patterns) {
            if (exercises.length >= mainCount) break;
            
            const patternExercises = exercisesByPattern[pattern] || [];
            const available = patternExercises.filter(ex => 
              canUseExercise(ex.id, dayOfWeek, ex.movementPattern) &&
              canUseOnLastDay(ex.id, isLastScheduledDay)
            );
            
            for (const ex of available) {
              if (exercises.length >= mainCount) break;
              
              // Backfill exercises are treated as secondary/accessory work
              const exerciseRole = ex.liftType === 'compound' ? 'secondary-compound' 
                : ex.movementPattern === 'core' || ex.movementPattern === 'rotation' || ex.movementPattern === 'carry'
                ? 'core-accessory'
                : 'isolation';
              
              const params = assignTrainingParameters(ex, fitnessLevel, selectedTemplate, latestAssessment, user, exerciseRole);
              exercises.push({
                exerciseName: ex.name,
                equipment: ex.equipment?.[0] || "bodyweight",
                ...params,
              });
              movementFocus.push(pattern);
              exerciseUsageMap.set(ex.id, dayOfWeek);
              if (workoutIndex === 1) {
                firstDayExercises.add(ex.id);
              }
            }
          }
        }
        console.log(`[BACKFILL] After backfill: ${exercises.length}/${mainCount} exercises`);
      }
      
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
          const available = patternExercises.filter(ex => 
            canUseExercise(ex.id, dayOfWeek, ex.movementPattern) &&
            canUseOnLastDay(ex.id, isLastScheduledDay)
          );
          
          // Prioritize compound exercises for fallback
          const compounds = available.filter(ex => ex.liftType === 'compound');
          const toAdd = compounds.length > 0 ? compounds : available;
          
          for (const ex of toAdd) {
            if (actualStrengthDuration >= strengthTimeBudget - 1) break;
            
            // Determine exercise role
            const exerciseRole = ex.liftType === 'compound' ? 'secondary-compound' 
              : ex.movementPattern === 'core' || ex.movementPattern === 'rotation' || ex.movementPattern === 'carry'
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
            
            exercises.push({
              exerciseName: ex.name,
              equipment: ex.equipment?.[0] || "bodyweight",
              ...params,
            });
            movementFocus.push(pattern);
            exerciseUsageMap.set(ex.id, dayOfWeek);
            if (workoutIndex === 1) {
              firstDayExercises.add(ex.id);
            }
            
            actualStrengthDuration += exerciseTime;
            fallbackAdded++;
            
            console.log(`[FALLBACK] Added ${ex.name} (${pattern}, ${exerciseTime.toFixed(1)}min) - new strength total: ${actualStrengthDuration.toFixed(1)}min`);
          }
        }
        
        console.log(`[FALLBACK] Complete: Added ${fallbackAdded} exercises, final strength duration: ${actualStrengthDuration.toFixed(1)}min/${strengthTimeBudget.toFixed(1)}min`);
      } else {
        console.log(`[TIME-CHECK] Strength duration OK: ${actualStrengthDuration.toFixed(1)}min/${strengthTimeBudget.toFixed(1)}min (gap: ${strengthDurationGap.toFixed(1)}min)`);
      }
      
      // Movement-specific warmup selection based on actual workout patterns
      // Define warmup mapping based on movement patterns
      const warmupMapping: Record<string, string[]> = {
        horizontal_push: ['Band Pull-Aparts', 'Arm Circles', 'Band Shoulder Dislocates', 'Cat-Cow Stretch'],
        vertical_push: ['Arm Circles', 'Band Shoulder Dislocates', 'Cat-Cow Stretch', 'Band Pull-Aparts'],
        pull: ['Band Pull-Aparts', 'Arm Circles', 'Cat-Cow Stretch', 'Thoracic Rotation'],
        squat: ['Dynamic Leg Swings', 'Hip Circles', 'Bodyweight Squats', 'Ankle Circles'],
        lunge: ['Dynamic Leg Swings', 'Hip Circles', 'Walking Lunges', 'Hip Flexor Stretch'],
        hinge: ['Dynamic Leg Swings', 'Hip Circles', 'Good Mornings', 'Cat-Cow Stretch'],
        core: ['Cat-Cow Stretch', 'Torso Twists', 'Dead Bug', 'Bird Dog'],
        rotation: ['Torso Twists', 'Thoracic Rotation', 'Cat-Cow Stretch'],
        carry: ['Arm Circles', 'Band Shoulder Dislocates', 'Dynamic Shoulder Rolls'],
      };
      
      // Analyze the actual patterns used in this workout (from movementFocus array)
      const workoutPatterns = Array.from(new Set(movementFocus.filter(p => p !== 'cardio')));
      const selectedWarmups: Exercise[] = [];
      const warmupNames = new Set<string>();
      
      // Priority: Select warmups that match this workout's actual movement patterns
      for (const pattern of workoutPatterns) {
        if (selectedWarmups.length >= warmupCount) break;
        
        const recommendedWarmupNames = warmupMapping[pattern] || [];
        for (const warmupName of recommendedWarmupNames) {
          if (selectedWarmups.length >= warmupCount) break;
          if (warmupNames.has(warmupName)) continue;
          
          const warmupEx = warmupExercises.find(ex => ex.name === warmupName);
          
          if (warmupEx) {
            selectedWarmups.push(warmupEx);
            warmupNames.add(warmupName);
          }
        }
      }
      
      // Fallback: If not enough pattern-specific warmups found, add general ones
      if (selectedWarmups.length < warmupCount) {
        for (const warmupEx of warmupExercises) {
          if (selectedWarmups.length >= warmupCount) break;
          if (!warmupNames.has(warmupEx.name)) {
            selectedWarmups.push(warmupEx);
            warmupNames.add(warmupEx.name);
          }
        }
      }
      
      // Insert warmups at the beginning of exercises array
      const warmupExercises_toAdd: GeneratedExercise[] = [];
      for (const warmupEx of selectedWarmups) {
        const params = assignTrainingParameters(warmupEx, fitnessLevel, selectedTemplate, latestAssessment, user, 'warmup');
        warmupExercises_toAdd.push({
          exerciseName: warmupEx.name,
          equipment: warmupEx.equipment?.[0] || "bodyweight",
          ...params,
          isWarmup: true,
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
              equipment: additionalWarmup.equipment?.[0] || "bodyweight",
              ...params,
              isWarmup: true,
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
      exercises.unshift(...warmupExercises_toAdd);
      
      console.log(`[WARMUP] Selected ${selectedWarmups.length} warmups for ${workoutPatterns.join(', ')} patterns: ${selectedWarmups.map(w => w.name).join(', ')}`);
      
      // POWER EXERCISE SELECTION
      // Filter power exercises by primary patterns for this day and user's difficulty level
      if (powerCount > 0) {
        const powerExercisesFiltered = availableExercises.filter(ex => 
          ex.isPower === 1 &&
          ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight") &&
          isExerciseAllowed(ex, movementDifficulties, fitnessLevel) &&
          canUseExercise(ex.id, dayOfWeek, ex.movementPattern) &&
          canUseOnLastDay(ex.id, isLastScheduledDay)
        );
        
        // Select power exercises from PRIMARY patterns first (follows tiered approach)
        const selectedPowerExercises: Exercise[] = [];
        
        for (const tier of [primaryPatterns, secondaryPatterns, fallbackPatterns]) {
          if (selectedPowerExercises.length >= powerCount) break;
          
          const tierPowerExercises = powerExercisesFiltered.filter(ex => tier.includes(ex.movementPattern));
          
          for (const powerEx of tierPowerExercises) {
            if (selectedPowerExercises.length >= powerCount) break;
            selectedPowerExercises.push(powerEx);
            exerciseUsageMap.set(powerEx.id, dayOfWeek);
            if (workoutIndex === 1) {
              firstDayExercises.add(powerEx.id);
            }
          }
        }
        
        // Add selected power exercises after warmups (splice after warmup count)
        const powerExercisesToAdd: GeneratedExercise[] = [];
        for (const powerEx of selectedPowerExercises) {
          const params = assignTrainingParameters(powerEx, fitnessLevel, selectedTemplate, latestAssessment, user, 'power');
          powerExercisesToAdd.push({
            exerciseName: powerEx.name,
            equipment: powerEx.equipment?.[0] || "bodyweight",
            ...params,
          });
        }
        
        // Insert power exercises right after warmups
        exercises.splice(warmupCount, 0, ...powerExercisesToAdd);
        
        console.log(`[POWER] Selected ${selectedPowerExercises.length} power exercises: ${selectedPowerExercises.map(p => p.name).join(', ')}`);
      }
      
      // Add cardio exercises based on calculated time requirements and goal-specific type rotation
      // Use calculated cardioCount from above (based on workout duration)
      if (cardioCount > 0 && cardioExercises.length > 0) {
        // Determine cardio type based on nutrition goal and workout rotation
        // For MAINTAIN and LOSE goals, rotate through available types to prevent adaptation
        const availableTypes = cardioConfig.types;
        const workoutIndex = scheduledDays.indexOf(dayOfWeek);
        
        let selectedCardioType: string;
        if (availableTypes.length === 1) {
          // GAIN: HIIT only
          selectedCardioType = "hiit";
        } else if (availableTypes.includes("hiit") && availableTypes.includes("steady-state") && availableTypes.length === 2) {
          // MAINTAIN: Rotate between HIIT (70%) and Steady-State (30%)
          selectedCardioType = workoutIndex % 3 === 0 ? "steady-state" : "hiit";
        } else {
          // LOSE: Rotate through all 4 types (HIIT 40%, Steady 25%, Tempo 20%, Circuit 15%)
          const rotation = workoutIndex % 20; // Use modulo 20 for percentage-based rotation
          if (rotation < 8) selectedCardioType = "hiit";          // 40%
          else if (rotation < 13) selectedCardioType = "steady-state"; // 25%
          else if (rotation < 17) selectedCardioType = "tempo";         // 20%
          else selectedCardioType = "circuit";                          // 15%
        }
        
        console.log(`[CARDIO-TYPE] ${nutritionGoal} goal - Selected ${selectedCardioType} cardio for workout ${workoutIndex + 1}`);
        
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
          if (canUseExercise(cardioEx.id, dayOfWeek, cardioEx.movementPattern) && 
              canUseOnLastDay(cardioEx.id, isLastScheduledDay)) {
            selectedCardio.push(cardioEx);
            exerciseUsageMap.set(cardioEx.id, dayOfWeek);
            if (workoutIndex === 1) {
              firstDayExercises.add(cardioEx.id);
            }
          }
        }
        
        for (const cardioEx of selectedCardio) {
          const params = assignTrainingParameters(cardioEx, fitnessLevel, selectedTemplate, latestAssessment, user, 'cardio', undefined, undefined, cardioTimeBudget);
          exercises.push({
            exerciseName: cardioEx.name,
            equipment: cardioEx.equipment?.[0] || "bodyweight",
            ...params,
          });
          movementFocus.push("cardio");
        }
      }
      
      // Determine workout type based on primary focus
      let workoutType: "strength" | "cardio" | "hiit" | "mobility" | null = "strength";
      if (selectedTemplate.structure.cardioFocus > 50) {
        workoutType = "cardio";
      }
      
      // Generate descriptive workout name based on movement patterns
      const descriptiveWorkoutName = generateWorkoutName(movementFocus, workoutType, dayName);
      
      workouts.push({
        dayOfWeek,
        workoutName: descriptiveWorkoutName,
        workoutType,
        movementFocus: Array.from(new Set(movementFocus)),
        exercises,
      });
    } else {
      // REST DAY: Generate rest day with null workoutType and no exercises
      workouts.push({
        dayOfWeek,
        workoutName: `${dayName} - Rest Day`,
        workoutType: null,
        movementFocus: [],
        exercises: [],
      });
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
