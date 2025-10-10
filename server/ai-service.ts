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

// Helper function to assign training parameters based on fitness level
function assignTrainingParameters(
  exercise: Exercise,
  fitnessLevel: string,
  template: ProgramTemplate,
  assessment: FitnessAssessment,
  user: User
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
} {
  // Base parameters by fitness level
  const baseSets = fitnessLevel === "beginner" ? 3 : fitnessLevel === "intermediate" ? 4 : 4;
  
  // Warmup exercises
  if (exercise.exerciseType === "warmup") {
    return {
      sets: 2,
      repsMin: 10,
      repsMax: 15,
      restSeconds: 30,
    };
  }
  
  // HIIT/Cardio exercises
  if (exercise.workoutType === "hiit" || exercise.workoutType === "cardio") {
    if (exercise.trackingType === "duration") {
      // HIIT intervals
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
  
  // Duration-based exercises (planks, holds, etc.)
  if (exercise.trackingType === "duration" || exercise.name.toLowerCase().includes("plank") || exercise.name.toLowerCase().includes("hold")) {
    const duration = fitnessLevel === "beginner" ? 30 : fitnessLevel === "intermediate" ? 45 : 60;
    return {
      sets: baseSets,
      durationSeconds: duration,
      restSeconds: 60,
      targetRPE: template.intensityGuidelines.strengthRPE[0],
      targetRIR: template.intensityGuidelines.strengthRIR[1],
    };
  }
  
  // Strength exercises - assign reps based on fitness level
  let repsMin: number, repsMax: number;
  
  if (fitnessLevel === "beginner") {
    repsMin = 10;
    repsMax = 12;
  } else if (fitnessLevel === "intermediate") {
    repsMin = 8;
    repsMax = 12;
  } else {
    repsMin = 6;
    repsMax = 10;
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
    sets: baseSets,
    repsMin,
    repsMax,
    restSeconds: exercise.liftType === "compound" ? 90 : 60,
    targetRPE: template.intensityGuidelines.strengthRPE[fitnessLevel === "beginner" ? 0 : 1],
    targetRIR: template.intensityGuidelines.strengthRIR[fitnessLevel === "beginner" ? 1 : 0],
    recommendedWeight,
  };
}

export async function generateWorkoutProgram(
  input: ProgramGenerationInput
): Promise<GeneratedProgram> {
  const { user, latestAssessment, availableExercises } = input;

  const daysPerWeek = Math.min(7, Math.max(1, user.daysPerWeek || 3));
  const fitnessLevel = latestAssessment.experienceLevel || user.fitnessLevel || "beginner";

  // Calculate movement pattern levels using centralized utility
  const movementPatternLevels = calculateMovementPatternLevels(latestAssessment, user);
  
  // Get movement difficulties map using centralized utility
  const movementDifficulties = getMovementDifficultiesMap(movementPatternLevels, fitnessLevel);
  
  console.log(`[TEMPLATE-BASED] Generating program for ${fitnessLevel} level user with ${daysPerWeek} days/week`);
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
  
  // Template-based workout generation - Generate ALL 7 days for entire program duration
  const workouts: GeneratedWorkout[] = [];
  const usedExerciseIds = new Set<string>();
  
  // Generate workouts for each day of the week (1-7 = Monday-Sunday)
  for (let dayOfWeek = 1; dayOfWeek <= 7; dayOfWeek++) {
    const dayName = dayNames[dayOfWeek];
    const isScheduledDay = scheduledDays.includes(dayOfWeek);
    
    if (isScheduledDay) {
      // WORKOUT DAY: Generate actual workout with exercises
      const exercises: GeneratedExercise[] = [];
      const movementFocus: string[] = [];
      
      // Add warmup exercises
      const warmupCount = selectedTemplate.structure.workoutStructure.warmupExercises;
      const selectedWarmups: Exercise[] = [];
      
      for (const warmupEx of warmupExercises) {
        if (selectedWarmups.length >= warmupCount) break;
        if (!usedExerciseIds.has(warmupEx.id)) {
          selectedWarmups.push(warmupEx);
          usedExerciseIds.add(warmupEx.id);
        }
      }
      
      for (const warmupEx of selectedWarmups) {
        const params = assignTrainingParameters(warmupEx, fitnessLevel, selectedTemplate, latestAssessment, user);
        exercises.push({
          exerciseName: warmupEx.name,
          equipment: warmupEx.equipment?.[0] || "bodyweight",
          ...params,
          isWarmup: true,
        });
      }
      
      // Add main strength exercises based on template
      const mainCount = selectedTemplate.structure.workoutStructure.mainStrengthExercises;
      const strengthPatterns = selectedTemplate.structure.movementPatternDistribution.strength;
      
      // Distribute exercises across movement patterns
      const exercisesPerPattern = Math.ceil(mainCount / strengthPatterns.length);
      
      for (const pattern of strengthPatterns) {
        // Use pre-filtered exercises from pattern map (optimization)
        const patternExercises = exercisesByPattern[pattern] || [];
        const selected = selectExercisesByPattern(patternExercises, pattern, exercisesPerPattern, usedExerciseIds);
        
        for (const ex of selected) {
          const params = assignTrainingParameters(ex, fitnessLevel, selectedTemplate, latestAssessment, user);
          exercises.push({
            exerciseName: ex.name,
            equipment: ex.equipment?.[0] || "bodyweight",
            ...params,
          });
          movementFocus.push(pattern);
        }
        
        if (exercises.length >= mainCount + warmupCount) break;
      }
      
      // Add cardio exercises based on template
      const cardioCount = selectedTemplate.structure.workoutStructure.cardioExercises;
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
          const params = assignTrainingParameters(cardioEx, fitnessLevel, selectedTemplate, latestAssessment, user);
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

// Remove all the old OpenAI functions below
const oldCodeRemoved = true;
