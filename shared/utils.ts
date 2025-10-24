// ==========================================
// FITNESS CALCULATION UTILITIES
// ==========================================
// This file contains helper functions for fitness level calculations
// Used by both frontend (UI display) and backend (workout generation)
//
// KEY FUNCTIONS:
// 1. calculateAge() - Age calculation from DOB
// 2. calculateMovementPatternLevels() - Determines difficulty level for each movement pattern
// 3. getProgressionTargets() - Shows next fitness milestones to achieve
// 4. getAllowedDifficulties() - Filters exercises by user's level
// 5. sortExercisesByDifficultyPriority() - Prioritizes hardest allowed exercises
//
// MOVEMENT PATTERN LEVELS:
// - Each of 10 movement patterns is independently assessed (beginner/intermediate/advanced)
// - Based on bodyweight test results (push-ups, squats, etc.) or weighted 1RMs
// - Weighted tests override bodyweight if available (e.g., bench press > push-ups)
// - Manual overrides can increase (never decrease) calculated levels
// ==========================================

// ==========================================
// AGE CALCULATION
// ==========================================
// Calculate age from date of birth
export function calculateAge(dateOfBirth: Date | string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  // Adjust age if birthday hasn't occurred yet this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

// Movement pattern level calculation based on fitness assessment
// Uses the same logic as server/ai-service.ts difficulty filtering
export type MovementPatternLevel = 'beginner' | 'intermediate' | 'advanced';

export interface MovementPatternLevels {
  horizontal_push: MovementPatternLevel;
  vertical_push: MovementPatternLevel;
  vertical_pull: MovementPatternLevel;
  horizontal_pull: MovementPatternLevel;
  squat: MovementPatternLevel;
  lunge: MovementPatternLevel;
  hinge: MovementPatternLevel;
  core: MovementPatternLevel;
  carry: MovementPatternLevel;
  cardio: MovementPatternLevel;
  rotation: MovementPatternLevel;
}

interface AssessmentData {
  experienceLevel?: string | null;
  pushups?: number | null;
  pikePushups?: number | null;
  pullups?: number | null;
  squats?: number | null;
  walkingLunges?: number | null;
  singleLegRDL?: number | null;
  plankHold?: number | null;
  mileTime?: number | null;
  squat1rm?: number | null;
  deadlift1rm?: number | null;
  benchPress1rm?: number | null;
  overheadPress1rm?: number | null;
  barbellRow1rm?: number | null;
  dumbbellLunge1rm?: number | null;
  farmersCarry1rm?: number | null;
  horizontalPushOverride?: string | null;
  verticalPushOverride?: string | null;
  verticalPullOverride?: string | null;
  horizontalPullOverride?: string | null;
  lowerBodyOverride?: string | null;
  hingeOverride?: string | null;
  coreOverride?: string | null;
  rotationOverride?: string | null;
  carryOverride?: string | null;
  cardioOverride?: string | null;
}

interface UserData {
  weight?: number | null;
  unitPreference?: string;
}

export interface ProgressionTarget {
  bodyweightTest: string;
  bodyweightIntermediate: string;
  bodyweightAdvanced: string;
  weightedTest: string;
  weightedIntermediate: string;
  weightedAdvanced: string;
}

export interface ProgressionTargets {
  horizontal_push: ProgressionTarget;
  vertical_push: ProgressionTarget;
  vertical_pull: ProgressionTarget;
  horizontal_pull: ProgressionTarget;
  lowerBody: ProgressionTarget;
  hinge: ProgressionTarget;
  cardio: ProgressionTarget;
}

export function getProgressionTargets(userWeight?: number, unitPreference?: string): ProgressionTargets {
  const weightUnit = unitPreference === 'imperial' ? 'lbs' : 'kg';
  const weight = userWeight || 0;
  
  return {
    horizontal_push: {
      bodyweightTest: 'Pushups',
      bodyweightIntermediate: '10+ pushups',
      bodyweightAdvanced: '20+ pushups',
      weightedTest: 'Bench Press 1RM',
      weightedIntermediate: `${(weight * 1.0).toFixed(0)}${weightUnit} (1.0×BW)`,
      weightedAdvanced: `${(weight * 1.5).toFixed(0)}${weightUnit} (1.5×BW)`,
    },
    vertical_push: {
      bodyweightTest: 'Pike Pushups',
      bodyweightIntermediate: '8+ pike pushups',
      bodyweightAdvanced: '15+ pike pushups',
      weightedTest: 'Overhead Press 1RM',
      weightedIntermediate: `${(weight * 0.6).toFixed(0)}${weightUnit} (0.6×BW)`,
      weightedAdvanced: `${(weight * 0.9).toFixed(0)}${weightUnit} (0.9×BW)`,
    },
    vertical_pull: {
      bodyweightTest: 'Pullups',
      bodyweightIntermediate: '5+ pullups',
      bodyweightAdvanced: '10+ pullups',
      weightedTest: 'N/A',
      weightedIntermediate: 'N/A',
      weightedAdvanced: 'N/A',
    },
    horizontal_pull: {
      bodyweightTest: 'Inverted Rows',
      bodyweightIntermediate: '10+ rows',
      bodyweightAdvanced: '20+ rows',
      weightedTest: 'Barbell Row 1RM',
      weightedIntermediate: `${(weight * 1.0).toFixed(0)}${weightUnit} (1.0×BW)`,
      weightedAdvanced: `${(weight * 1.5).toFixed(0)}${weightUnit} (1.5×BW)`,
    },
    lowerBody: {
      bodyweightTest: 'Bodyweight Squats',
      bodyweightIntermediate: '25+ squats',
      bodyweightAdvanced: '40+ squats',
      weightedTest: 'Squat 1RM',
      weightedIntermediate: `${(weight * 1.5).toFixed(0)}${weightUnit} (1.5×BW)`,
      weightedAdvanced: `${(weight * 2.0).toFixed(0)}${weightUnit} (2.0×BW)`,
    },
    hinge: {
      bodyweightTest: 'Bodyweight Squats (stability indicator)',
      bodyweightIntermediate: '25+ squats',
      bodyweightAdvanced: '40+ squats',
      weightedTest: 'Deadlift 1RM',
      weightedIntermediate: `${(weight * 1.75).toFixed(0)}${weightUnit} (1.75×BW)`,
      weightedAdvanced: `${(weight * 2.5).toFixed(0)}${weightUnit} (2.5×BW)`,
    },
    cardio: {
      bodyweightTest: 'Mile Run Time',
      bodyweightIntermediate: '7-9 minutes',
      bodyweightAdvanced: 'Under 7 minutes',
      weightedTest: 'N/A',
      weightedIntermediate: 'N/A',
      weightedAdvanced: 'N/A',
    },
  };
}

// ==========================================
// MOVEMENT PATTERN LEVEL CALCULATION
// ==========================================
// Determines beginner/intermediate/advanced level for EACH movement pattern independently
// LOGIC:
// 1. Start with bodyweight test results (push-ups, squats, mile time, etc.)
// 2. If weighted tests available (1RMs), they override bodyweight results
// 3. Manual overrides can only increase levels (never decrease for safety)
// Example: If user does 12 push-ups → intermediate. But bench press 150lbs → advanced. Result = advanced.
// ==========================================
export function calculateMovementPatternLevels(
  assessment: AssessmentData,
  user: UserData
): MovementPatternLevels {
  // Calculate levels based purely on test metrics, allowing progression
  let horizontalPushLevel: MovementPatternLevel = 'beginner';
  let verticalPushLevel: MovementPatternLevel = 'beginner';
  let verticalPullLevel: MovementPatternLevel = 'beginner';
  let horizontalPullLevel: MovementPatternLevel = 'beginner';
  let squatLevel: MovementPatternLevel = 'beginner';
  let lungeLevel: MovementPatternLevel = 'beginner';
  let hingeLevel: MovementPatternLevel = 'beginner';
  let coreLevel: MovementPatternLevel = 'beginner';
  let carryLevel: MovementPatternLevel = 'beginner';
  let cardioLevel: MovementPatternLevel = 'beginner';
  let rotationLevel: MovementPatternLevel = 'beginner';
  
  // Horizontal Push pattern - based on pushups or bench press performance
  const pushups = assessment.pushups || 0;
  if (pushups >= 20) {
    horizontalPushLevel = 'advanced';
  } else if (pushups >= 10) {
    horizontalPushLevel = 'intermediate';
  }
  
  // Vertical Push pattern - based on pike pushups or OHP performance
  const pikePushups = assessment.pikePushups || 0;
  if (pikePushups >= 15) {
    verticalPushLevel = 'advanced';
  } else if (pikePushups >= 8) {
    verticalPushLevel = 'intermediate';
  }
  
  // Vertical Pull pattern - based on pullups performance
  const pullups = assessment.pullups || 0;
  if (pullups >= 10) {
    verticalPullLevel = 'advanced';
  } else if (pullups >= 5) {
    verticalPullLevel = 'intermediate';
  }
  
  // Horizontal Pull pattern - defaults to beginner (can be upgraded via row 1RM)
  horizontalPullLevel = 'beginner';
  
  // Squat pattern - based on bodyweight squats or squat 1RM
  const squats = assessment.squats || 0;
  if (squats >= 40) {
    squatLevel = 'advanced';
  } else if (squats >= 25) {
    squatLevel = 'intermediate';
  }
  
  // Lunge pattern - based on walking lunges or dumbbell lunge 1RM
  const walkingLunges = assessment.walkingLunges || 0;
  if (walkingLunges >= 30) {
    lungeLevel = 'advanced';
  } else if (walkingLunges >= 20) {
    lungeLevel = 'intermediate';
  }
  
  // Hinge pattern - based on single-leg RDL or deadlift 1RM
  const singleLegRDL = assessment.singleLegRDL || 0;
  if (singleLegRDL >= 15) {
    hingeLevel = 'advanced';
  } else if (singleLegRDL >= 10) {
    hingeLevel = 'intermediate';
  }
  
  // Core pattern - based on plank hold time
  const plankHold = assessment.plankHold || 0;
  if (plankHold >= 90) {
    coreLevel = 'advanced';
  } else if (plankHold >= 60) {
    coreLevel = 'intermediate';
  }
  
  // Carry pattern - defaults to beginner (no bodyweight test, only weighted)
  // Will be updated if weighted test is available
  
  // Cardio - based on mile time
  const mileTime = assessment.mileTime || 999;
  if (mileTime < 7) {
    cardioLevel = 'advanced';
  } else if (mileTime <= 9) {
    cardioLevel = 'intermediate';
  }
  
  // Weighted test checks override bodyweight if available
  if (user.weight && user.weight > 0) {
    const weightInKg = user.unitPreference === 'imperial' ? user.weight * 0.453592 : user.weight;
    
    // Squat 1RM for squat level
    if (assessment.squat1rm) {
      const squat1rmKg = user.unitPreference === 'imperial' ? assessment.squat1rm * 0.453592 : assessment.squat1rm;
      const ratio = squat1rmKg / weightInKg;
      if (ratio >= 2.0) {
        squatLevel = 'advanced';
      } else if (ratio >= 1.5) {
        squatLevel = 'intermediate';
      } else if (ratio < 1.0) {
        squatLevel = 'beginner';
      }
    }
    
    // Dumbbell Lunge 1RM for lunge level
    if (assessment.dumbbellLunge1rm) {
      const lunge1rmKg = user.unitPreference === 'imperial' ? assessment.dumbbellLunge1rm * 0.453592 : assessment.dumbbellLunge1rm;
      const ratio = lunge1rmKg / weightInKg;
      if (ratio >= 1.5) {
        lungeLevel = 'advanced';
      } else if (ratio >= 1.0) {
        lungeLevel = 'intermediate';
      } else if (ratio < 0.75) {
        lungeLevel = 'beginner';
      }
    }
    
    // Farmer's Carry 1RM for carry level
    if (assessment.farmersCarry1rm) {
      const carry1rmKg = user.unitPreference === 'imperial' ? assessment.farmersCarry1rm * 0.453592 : assessment.farmersCarry1rm;
      const ratio = carry1rmKg / weightInKg;
      if (ratio >= 2.0) {
        carryLevel = 'advanced';
      } else if (ratio >= 1.5) {
        carryLevel = 'intermediate';
      } else if (ratio < 1.0) {
        carryLevel = 'beginner';
      }
    }
    
    // Deadlift 1RM for hinge level
    if (assessment.deadlift1rm) {
      const deadlift1rmKg = user.unitPreference === 'imperial' ? assessment.deadlift1rm * 0.453592 : assessment.deadlift1rm;
      const ratio = deadlift1rmKg / weightInKg;
      if (ratio >= 2.5) {
        hingeLevel = 'advanced';
      } else if (ratio >= 1.75) {
        hingeLevel = 'intermediate';
      } else if (ratio < 1.25) {
        hingeLevel = 'beginner';
      }
    }
    
    // Bench Press 1RM for horizontal push level
    if (assessment.benchPress1rm) {
      const bench1rmKg = user.unitPreference === 'imperial' ? assessment.benchPress1rm * 0.453592 : assessment.benchPress1rm;
      const ratio = bench1rmKg / weightInKg;
      if (ratio >= 1.5) {
        horizontalPushLevel = 'advanced';
      } else if (ratio >= 1.0) {
        horizontalPushLevel = 'intermediate';
      } else if (ratio < 0.75) {
        horizontalPushLevel = 'beginner';
      }
    }
    
    // Overhead Press 1RM for vertical push level
    if (assessment.overheadPress1rm) {
      const ohp1rmKg = user.unitPreference === 'imperial' ? assessment.overheadPress1rm * 0.453592 : assessment.overheadPress1rm;
      const ratio = ohp1rmKg / weightInKg;
      if (ratio >= 0.9) {
        verticalPushLevel = 'advanced';
      } else if (ratio >= 0.6) {
        verticalPushLevel = 'intermediate';
      } else if (ratio < 0.5) {
        verticalPushLevel = 'beginner';
      }
    }
    
    // Barbell Row 1RM for horizontal pull level
    if (assessment.barbellRow1rm) {
      const row1rmKg = user.unitPreference === 'imperial' ? assessment.barbellRow1rm * 0.453592 : assessment.barbellRow1rm;
      const ratio = row1rmKg / weightInKg;
      if (ratio >= 1.5) {
        horizontalPullLevel = 'advanced';
      } else if (ratio >= 1.0) {
        horizontalPullLevel = 'intermediate';
      } else if (ratio < 0.75) {
        horizontalPullLevel = 'beginner';
      }
    }
  }
  
  // Rotation defaults to beginner (no specific test)
  rotationLevel = assessment.experienceLevel as MovementPatternLevel || 'beginner';
  
  // Apply manual overrides - use the higher of performance level or override
  function getMaxLevel(performanceLevel: MovementPatternLevel, override?: string | null): MovementPatternLevel {
    if (!override) return performanceLevel;
    
    const levels: MovementPatternLevel[] = ['beginner', 'intermediate', 'advanced'];
    const performanceIndex = levels.indexOf(performanceLevel);
    const overrideIndex = levels.indexOf(override as MovementPatternLevel);
    
    return overrideIndex > performanceIndex ? override as MovementPatternLevel : performanceLevel;
  }
  
  return {
    horizontal_push: getMaxLevel(horizontalPushLevel, assessment.horizontalPushOverride),
    vertical_push: getMaxLevel(verticalPushLevel, assessment.verticalPushOverride),
    vertical_pull: getMaxLevel(verticalPullLevel, assessment.verticalPullOverride),
    horizontal_pull: getMaxLevel(horizontalPullLevel, assessment.horizontalPullOverride),
    squat: getMaxLevel(squatLevel, assessment.lowerBodyOverride),
    lunge: getMaxLevel(lungeLevel, assessment.lowerBodyOverride),
    hinge: getMaxLevel(hingeLevel, assessment.hingeOverride),
    core: getMaxLevel(coreLevel, assessment.coreOverride),
    carry: getMaxLevel(carryLevel, assessment.carryOverride),
    cardio: getMaxLevel(cardioLevel, assessment.cardioOverride),
    rotation: getMaxLevel(rotationLevel, assessment.rotationOverride),
  };
}

// ==========================================
// DIFFICULTY FILTERING HELPERS
// ==========================================
// These functions determine which exercise difficulties are safe/appropriate for user's level
// SAFETY RULE: Beginner users get beginner + intermediate (for variety), never advanced
// ==========================================

// Convert movement pattern level to allowed difficulty array
export function getAllowedDifficulties(level: MovementPatternLevel): string[] {
  if (level === 'beginner') return ['beginner', 'intermediate']; // Allow intermediate for exercise variety
  if (level === 'intermediate') return ['beginner', 'intermediate'];
  return ['beginner', 'intermediate', 'advanced'];
}

// Get allowed difficulties map for all movement patterns
export function getMovementDifficultiesMap(
  levels: MovementPatternLevels,
  fitnessLevel: string = 'beginner'
): { [pattern: string]: string[] } {
  return {
    horizontal_push: getAllowedDifficulties(levels.horizontal_push),
    vertical_push: getAllowedDifficulties(levels.vertical_push),
    vertical_pull: getAllowedDifficulties(levels.vertical_pull),
    horizontal_pull: getAllowedDifficulties(levels.horizontal_pull),
    squat: getAllowedDifficulties(levels.squat),
    lunge: getAllowedDifficulties(levels.lunge),
    hinge: getAllowedDifficulties(levels.hinge),
    core: getAllowedDifficulties(levels.core),
    carry: getAllowedDifficulties(levels.carry),
    cardio: getAllowedDifficulties(levels.cardio),
    rotation: getAllowedDifficulties(levels.rotation),
  };
}

// Check if an exercise is allowed based on movement pattern difficulty
export function isExerciseAllowed(
  exercise: { movementPattern?: string; difficulty: string },
  movementDifficulties: { [pattern: string]: string[] },
  fitnessLevel: string = 'beginner'
): boolean {
  const pattern = exercise.movementPattern?.toLowerCase() || '';
  const difficulty = exercise.difficulty;
  
  const getDefault = (level: string): string[] => {
    if (level === 'beginner') return ['beginner', 'intermediate']; // Allow intermediate for exercise variety
    if (level === 'intermediate') return ['beginner', 'intermediate'];
    return ['beginner', 'intermediate', 'advanced'];
  };
  
  const allowedForPattern = movementDifficulties[pattern] || getDefault(fitnessLevel);
  return allowedForPattern.includes(difficulty);
}

// ==========================================
// EXERCISE SORTING BY DIFFICULTY
// ==========================================
// Sorts exercises by difficulty priority (hardest allowed first)
// IMPORTANT: Only sorts within ALLOWED difficulties for that movement pattern
// Example: Beginner user can't get advanced exercises, even if they exist
// Result: Intermediate exercises come first, then beginner exercises
// ==========================================
// Sort exercises by difficulty (hardest first) based on user's level for the pattern
// RESPECTS movement-specific allowed difficulties - only prioritizes within allowed range
export function sortExercisesByDifficultyPriority<T extends { movementPattern?: string; difficulty: string }>(
  exercises: T[],
  movementDifficulties: { [pattern: string]: string[] },
  fitnessLevel: string = 'beginner'
): T[] {
  const difficultyRank: { [key: string]: number } = {
    'advanced': 3,
    'intermediate': 2,
    'beginner': 1
  };
  
  return exercises.sort((a, b) => {
    const patternA = a.movementPattern?.toLowerCase() || 'unknown';
    const patternB = b.movementPattern?.toLowerCase() || 'unknown';
    
    // Get default allowed difficulties if pattern not in map
    const getDefault = (level: string): string[] => {
      if (level === 'beginner') return ['beginner', 'intermediate'];
      if (level === 'intermediate') return ['beginner', 'intermediate'];
      return ['beginner', 'intermediate', 'advanced'];
    };
    
    const allowedA = movementDifficulties[patternA] || getDefault(fitnessLevel);
    const allowedB = movementDifficulties[patternB] || getDefault(fitnessLevel);
    
    // Check if difficulties are allowed for their respective patterns
    const isAllowedA = allowedA.includes(a.difficulty);
    const isAllowedB = allowedB.includes(b.difficulty);
    
    // Disallowed exercises go to the end
    if (!isAllowedA && isAllowedB) return 1;
    if (isAllowedA && !isAllowedB) return -1;
    if (!isAllowedA && !isAllowedB) return 0;
    
    // Both allowed - sort by difficulty rank (higher rank first)
    const rankA = difficultyRank[a.difficulty] || 0;
    const rankB = difficultyRank[b.difficulty] || 0;
    return rankB - rankA; // Higher difficulty first
  });
}
