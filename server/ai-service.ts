import type { User, FitnessAssessment, Exercise } from "@shared/schema";
import { selectProgramTemplate, type ProgramTemplate } from "./programTemplates";
import { 
  calculateMovementPatternLevels, 
  getMovementDifficultiesMap, 
  isExerciseAllowed 
} from "@shared/utils";

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
  const upperPush = uniquePatterns.filter(p => p === "push").length > 0;
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
  usedExerciseIds: Set<string> = new Set()
): Exercise[] {
  const available = exercises.filter(
    ex => ex.movementPattern === pattern && !usedExerciseIds.has(ex.id)
  );
  
  // Prioritize compound exercises
  const compound = available.filter(ex => ex.liftType === "compound");
  const isolation = available.filter(ex => ex.liftType === "isolation");
  
  const selected: Exercise[] = [];
  
  // First, add compound exercises
  for (const ex of compound) {
    if (selected.length >= count) break;
    selected.push(ex);
    usedExerciseIds.add(ex.id);
  }
  
  // Then add isolation if needed
  for (const ex of isolation) {
    if (selected.length >= count) break;
    selected.push(ex);
    usedExerciseIds.add(ex.id);
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
  
  // Check push strength (chest, shoulders, triceps)
  if (assessment.pushups !== null && assessment.pushups !== undefined && assessment.pushups < threshold.pushups) {
    weakPatterns.push('push');
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
  exerciseRole: 'primary-compound' | 'secondary-compound' | 'isolation' | 'core-accessory' | 'warmup' | 'cardio',
  supersetGroup?: string,
  supersetOrder?: number
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
  supersetGroup?: string;
  supersetOrder?: number;
} {
  
  // Warmup exercises
  if (exerciseRole === 'warmup' || exercise.exerciseType === "warmup") {
    return {
      sets: 2,
      repsMin: 10,
      repsMax: 15,
      restSeconds: 30,
    };
  }
  
  // HIIT/Cardio exercises
  if (exerciseRole === 'cardio' || exercise.workoutType === "hiit" || exercise.workoutType === "cardio") {
    if (exercise.trackingType === "duration") {
      // HIIT intervals - work/rest based on fitness level
      const workSeconds = fitnessLevel === "beginner" ? 20 : fitnessLevel === "intermediate" ? 30 : 40;
      const restSeconds = fitnessLevel === "beginner" ? 40 : fitnessLevel === "intermediate" ? 30 : 20;
      
      return {
        sets: 8,
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
    const duration = fitnessLevel === "beginner" ? 30 : fitnessLevel === "intermediate" ? 45 : 60;
    const sets = fitnessLevel === "beginner" ? 2 : 3;
    return {
      sets,
      durationSeconds: duration,
      restSeconds: 60, // Core work gets 60s rest
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
  
  return {
    sets,
    repsMin,
    repsMax,
    restSeconds,
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

  const daysPerWeek = Math.min(7, Math.max(1, user.daysPerWeek || 3));
  const fitnessLevel = latestAssessment.experienceLevel || user.fitnessLevel || "beginner";
  const workoutDuration = user.workoutDuration || 60; // Default to 60 minutes

  // Calculate movement pattern levels using centralized utility
  const movementPatternLevels = calculateMovementPatternLevels(latestAssessment, user);
  
  // Get movement difficulties map using centralized utility
  const movementDifficulties = getMovementDifficultiesMap(movementPatternLevels, fitnessLevel);
  
  console.log(`[TEMPLATE-BASED] Generating program for ${fitnessLevel} level user with ${daysPerWeek} days/week and ${workoutDuration} min sessions`);
  console.log(`[DIFFICULTY] Movement pattern difficulties:`, {
    push: movementDifficulties.push,
    pull: movementDifficulties.pull,
    squat: movementDifficulties.squat,
    lunge: movementDifficulties.lunge,
    hinge: movementDifficulties.hinge,
    core: movementDifficulties.core,
    carry: movementDifficulties.carry,
    cardio: movementDifficulties.cardio,
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
  availableExercises.forEach((ex) => {
    if (ex.exerciseType !== "cooldown" && 
        ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight") &&
        isExerciseAllowed(ex, movementDifficulties, fitnessLevel) &&
        exercisesByPattern[ex.movementPattern]) {
      exercisesByPattern[ex.movementPattern].push(ex);
    }
  });

  //  Determine scheduled days for the week
  const daySchedules: { [key: number]: number[] } = {
    1: [1],             // Monday only
    2: [1, 4],          // Monday, Thursday
    3: [1, 3, 5],       // Monday, Wednesday, Friday
    4: [1, 2, 4, 5],    // Monday, Tuesday, Thursday, Friday
    5: [1, 2, 3, 4, 5], // Monday-Friday
    6: [1, 2, 3, 4, 5, 6], // Monday-Saturday
    7: [1, 2, 3, 4, 5, 6, 7], // Every day
  };

  const scheduledDays = user.selectedDays && user.selectedDays.length === daysPerWeek 
    ? user.selectedDays 
    : daySchedules[daysPerWeek] || daySchedules[3];
  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Select the appropriate program template based on user's nutrition goal
  const selectedTemplate = selectProgramTemplate(user.nutritionGoal, latestAssessment.experienceLevel);
  console.log(`[TEMPLATE] Selected template: ${selectedTemplate.name} for nutrition goal: ${user.nutritionGoal}`);
  
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
  
  // HIIT cardio finisher (8 intervals, 30s work, 30s rest): ~8min
  const cardioFinisherTime = calculateExerciseTime({
    sets: 8,
    workSeconds: 30,
    restSeconds: 30
  });
  
  // PRECISE TIME-AWARE ALLOCATION
  // Account for the fact that first 2 main exercises are ALWAYS primary compounds (13.5min each)
  let timeRemaining = workoutDuration;
  
  // Step 1: Allocate warmups (minimum 2, scale up for longer sessions)
  let warmupCount = 2;
  if (workoutDuration >= 60) {
    warmupCount = 3;
  }
  timeRemaining -= warmupCount * warmupTimePerExercise;
  console.log(`[TIME-ALLOC] After ${warmupCount} warmups: ${timeRemaining.toFixed(1)}min remaining`);
  
  // Step 2: Reserve cardio time FIRST if template wants it (before calculating secondary count)
  let cardioCount = 0;
  const templateWantsCardio = selectedTemplate.structure.workoutStructure.cardioExercises > 0;
  const minTimeForCardio = primaryCompoundTime * 2 + cardioFinisherTime; // Need at least 2 primaries + cardio
  
  if (templateWantsCardio && timeRemaining >= minTimeForCardio) {
    cardioCount = 1;
    timeRemaining -= cardioFinisherTime;
    console.log(`[TIME-ALLOC] Reserved cardio finisher: ${timeRemaining.toFixed(1)}min remaining for strength work`);
  }
  
  // Step 3: Allocate primary and secondary compounds with remaining time
  let primaryCount = 0;
  let secondaryCount = 0;
  
  if (timeRemaining >= primaryCompoundTime * 2) {
    primaryCount = 2;
    timeRemaining -= primaryCompoundTime * 2;
    console.log(`[TIME-ALLOC] After 2 primary compounds: ${timeRemaining.toFixed(1)}min remaining`);
    
    // Fill remaining time with secondary compounds
    secondaryCount = Math.floor(timeRemaining / secondaryCompoundTime);
    if (secondaryCount > 0) {
      timeRemaining -= secondaryCount * secondaryCompoundTime;
      console.log(`[TIME-ALLOC] After ${secondaryCount} secondary compounds: ${timeRemaining.toFixed(1)}min remaining`);
    }
  } else if (timeRemaining >= primaryCompoundTime) {
    // Only room for 1 primary compound
    primaryCount = 1;
    timeRemaining -= primaryCompoundTime;
    console.log(`[TIME-ALLOC] After 1 primary compound: ${timeRemaining.toFixed(1)}min remaining`);
  }
  
  const mainCount = primaryCount + secondaryCount;
  
  const estimatedTotal = (warmupCount * warmupTimePerExercise) + 
                         (primaryCount * primaryCompoundTime) +
                         (secondaryCount * secondaryCompoundTime) +
                         (cardioCount * cardioFinisherTime);
  
  console.log(`[EXERCISE-CALC] For ${workoutDuration}min session: ${warmupCount} warmups, ${primaryCount} primary compounds, ${secondaryCount} secondary compounds, ${cardioCount} cardio finisher. Estimated total: ${estimatedTotal.toFixed(1)}min`);
  
  // Template-based workout generation - Generate ALL 7 days for entire program duration
  const workouts: GeneratedWorkout[] = [];
  
  // Generate workouts for each day of the week (1-7 = Monday-Sunday)
  for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
    const dayName = dayNames[dayOfWeek];
    const isScheduledDay = scheduledDays.includes(dayOfWeek);
    
    if (isScheduledDay) {
      // WORKOUT DAY: Generate actual workout with exercises
      // Reset usedExerciseIds for each workout to allow exercise reuse across different days
      // This prevents running out of exercises for users with limited equipment
      const usedExerciseIds = new Set<string>();
      const exercises: GeneratedExercise[] = [];
      const movementFocus: string[] = [];
      
      // Add main strength exercises respecting precise time-based counts
      const strengthPatterns = selectedTemplate.structure.movementPatternDistribution.strength;
      const compoundExercises: { exercise: Exercise; pattern: string }[] = [];
      
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
      
      // Distribute exercises across movement patterns
      const exercisesPerPattern = Math.ceil(compoundSlotsToFill / strengthPatterns.length);
      
      for (const pattern of strengthPatterns) {
        // Use pre-filtered exercises from pattern map (optimization)
        const patternExercises = exercisesByPattern[pattern] || [];
        const selected = selectExercisesByPattern(patternExercises, pattern, exercisesPerPattern, usedExerciseIds);
        
        for (const ex of selected) {
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
          
          // Track compound exercises for superset logic
          if (ex.liftType === 'compound') {
            compoundExercises.push({ exercise: ex, pattern });
          }
        }
        
        // Stop when we reach the compound slot count (isolation slots reserved for supersets)
        if (exercises.length >= compoundSlotsToFill) break;
      }
      
      // Strategic superset logic: Add isolation exercises for weak patterns
      // Capacity was pre-reserved above, now fill those slots with isolation work
      if (shouldAddSupersets && reservedSupersetSlots > 0 && compoundExercises.length > 0) {
        const weakPatterns = identifyWeakMovementPatterns(latestAssessment, user);
        let supersetsAdded = 0;
        const supersetGroups = ['A', 'B', 'C'];
        
        for (const weakPattern of weakPatterns) {
          if (supersetsAdded >= reservedSupersetSlots) break;
          
          // Find a compound exercise with this pattern
          const compoundIndex = compoundExercises.findIndex(ce => ce.pattern === weakPattern);
          if (compoundIndex === -1) continue;
          
          // Find matching isolation exercise
          const isolationEx = findIsolationExercise(
            weakPattern,
            availableExercises,
            usedExerciseIds,
            user.equipment || []
          );
          
          if (isolationEx) {
            // Mark the compound exercise with superset group
            const compoundExInList = exercises.find(
              e => e.exerciseName === compoundExercises[compoundIndex].exercise.name && !e.isWarmup
            );
            if (compoundExInList) {
              const supersetGroup = supersetGroups[supersetsAdded];
              compoundExInList.supersetGroup = supersetGroup;
              compoundExInList.supersetOrder = 1;
              
              // Add isolation exercise with same superset group (only if within budget)
              const isolationParams = assignTrainingParameters(
                isolationEx,
                fitnessLevel,
                selectedTemplate,
                latestAssessment,
                user,
                'isolation', // Superset isolation exercises
                supersetGroup,
                2
              );
              
              exercises.push({
                exerciseName: isolationEx.name,
                equipment: isolationEx.equipment?.[0] || "bodyweight",
                ...isolationParams,
              });
              movementFocus.push(weakPattern);
              usedExerciseIds.add(isolationEx.id);
              supersetsAdded++;
              
              console.log(`[SUPERSET] Added ${supersetGroup}: ${compoundExInList.exerciseName} + ${isolationEx.name} for weak ${weakPattern}`);
            }
          }
        }
        
        console.log(`[SUPERSET] Added ${supersetsAdded} supersets, total strength exercises: ${exercises.length}/${mainCount}`);
      }
      
      // Backfill unused reserved slots with additional exercises (compound or isolation)
      // This runs regardless of whether compounds were found, ensuring we always reach mainCount
      if (reservedSupersetSlots > 0 && exercises.length < mainCount) {
        const exercisesNeeded = mainCount - exercises.length;
        console.log(`[SUPERSET] Backfilling ${exercisesNeeded} slots to reach mainCount`);
        
        for (const pattern of strengthPatterns) {
          if (exercises.length >= mainCount) break;
          
          const patternExercises = exercisesByPattern[pattern] || [];
          const available = patternExercises.filter(ex => !usedExerciseIds.has(ex.id));
          
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
            usedExerciseIds.add(ex.id);
          }
        }
      }
      
      // Movement-specific warmup selection based on actual workout patterns
      // Define warmup mapping based on movement patterns
      const warmupMapping: Record<string, string[]> = {
        push: ['Band Pull-Aparts', 'Arm Circles', 'Shoulder Dislocations', 'Cat-Cow Stretch'],
        pull: ['Band Pull-Aparts', 'Arm Circles', 'Cat-Cow Stretch', 'Thoracic Rotation'],
        squat: ['Leg Swings', 'Hip Circles', 'Bodyweight Squats', 'Ankle Circles'],
        lunge: ['Leg Swings', 'Hip Circles', 'Walking Lunges', 'Hip Flexor Stretch'],
        hinge: ['Leg Swings', 'Hip Circles', 'Good Mornings', 'Cat-Cow Stretch'],
        core: ['Cat-Cow Stretch', 'Torso Twists', 'Dead Bug', 'Bird Dog'],
        rotation: ['Torso Twists', 'Thoracic Rotation', 'Cat-Cow Stretch'],
        carry: ['Arm Circles', 'Shoulder Dislocations', 'Farmer Walk'],
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
      
      // Insert warmups at the beginning
      exercises.unshift(...warmupExercises_toAdd);
      
      console.log(`[WARMUP] Selected warmups for ${workoutPatterns.join(', ')} patterns: ${selectedWarmups.map(w => w.name).join(', ')}`);
      
      // Add cardio exercises based on calculated time requirements
      // Use calculated cardioCount from above (based on workout duration)
      if (cardioCount > 0 && cardioExercises.length > 0) {
        const selectedCardio: Exercise[] = [];
        
        for (const cardioEx of cardioExercises) {
          if (selectedCardio.length >= cardioCount) break;
          if (!usedExerciseIds.has(cardioEx.id)) {
            selectedCardio.push(cardioEx);
            usedExerciseIds.add(cardioEx.id);
          }
        }
        
        for (const cardioEx of selectedCardio) {
          const params = assignTrainingParameters(cardioEx, fitnessLevel, selectedTemplate, latestAssessment, user, 'cardio');
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
