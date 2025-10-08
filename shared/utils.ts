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
  push: MovementPatternLevel;
  pull: MovementPatternLevel;
  lowerBody: MovementPatternLevel; // Squat/Lunge combined
  hinge: MovementPatternLevel;
  cardio: MovementPatternLevel;
}

interface AssessmentData {
  experienceLevel?: string | null;
  pushups?: number | null;
  pullups?: number | null;
  squats?: number | null;
  mileTime?: number | null;
  squat1rm?: number | null;
  deadlift1rm?: number | null;
  benchPress1rm?: number | null;
  overheadPress1rm?: number | null;
  barbellRow1rm?: number | null;
  pushOverride?: string | null;
  pullOverride?: string | null;
  lowerBodyOverride?: string | null;
  hingeOverride?: string | null;
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
  push: ProgressionTarget;
  pull: ProgressionTarget;
  lowerBody: ProgressionTarget;
  hinge: ProgressionTarget;
  cardio: ProgressionTarget;
}

export function getProgressionTargets(userWeight?: number, unitPreference?: string): ProgressionTargets {
  const weightUnit = unitPreference === 'imperial' ? 'lbs' : 'kg';
  const weight = userWeight || 0;
  
  return {
    push: {
      bodyweightTest: 'Pushups',
      bodyweightIntermediate: '10+ pushups',
      bodyweightAdvanced: '20+ pushups',
      weightedTest: 'Bench Press or OHP 1RM',
      weightedIntermediate: `Bench: ${(weight * 1.0).toFixed(0)}${weightUnit} (1.0×BW) or OHP: ${(weight * 0.6).toFixed(0)}${weightUnit} (0.6×BW)`,
      weightedAdvanced: `Bench: ${(weight * 1.5).toFixed(0)}${weightUnit} (1.5×BW) or OHP: ${(weight * 0.9).toFixed(0)}${weightUnit} (0.9×BW)`,
    },
    pull: {
      bodyweightTest: 'Pullups',
      bodyweightIntermediate: '5+ pullups',
      bodyweightAdvanced: '10+ pullups',
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

export function calculateMovementPatternLevels(
  assessment: AssessmentData,
  user: UserData
): MovementPatternLevels {
  // Calculate levels based purely on test metrics, allowing progression
  let pushLevel: MovementPatternLevel = 'beginner';
  let pullLevel: MovementPatternLevel = 'beginner';
  let lowerBodyLevel: MovementPatternLevel = 'beginner';
  let hingeLevel: MovementPatternLevel = 'beginner';
  let cardioLevel: MovementPatternLevel = 'beginner';
  
  // Push pattern - based on pushups or bench/OHP performance
  const pushups = assessment.pushups || 0;
  if (pushups >= 20) {
    pushLevel = 'advanced';
  } else if (pushups >= 10) {
    pushLevel = 'intermediate';
  }
  
  // Pull pattern - based on pullups or row performance
  const pullups = assessment.pullups || 0;
  if (pullups >= 10) {
    pullLevel = 'advanced';
  } else if (pullups >= 5) {
    pullLevel = 'intermediate';
  }
  
  // Lower body - based on squats or squat 1RM
  const squats = assessment.squats || 0;
  if (squats >= 40) {
    lowerBodyLevel = 'advanced';
  } else if (squats >= 25) {
    lowerBodyLevel = 'intermediate';
  }
  
  // Hinge - based on squats (stability) or deadlift 1RM
  if (squats >= 40) {
    hingeLevel = 'advanced';
  } else if (squats >= 25) {
    hingeLevel = 'intermediate';
  }
  
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
    
    // Squat 1RM for lower body level
    if (assessment.squat1rm) {
      const squat1rmKg = user.unitPreference === 'imperial' ? assessment.squat1rm * 0.453592 : assessment.squat1rm;
      const ratio = squat1rmKg / weightInKg;
      if (ratio >= 2.0) {
        lowerBodyLevel = 'advanced';
      } else if (ratio >= 1.5) {
        lowerBodyLevel = 'intermediate';
      } else if (ratio < 1.0) {
        lowerBodyLevel = 'beginner';
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
    
    // Bench Press 1RM for push level
    if (assessment.benchPress1rm) {
      const bench1rmKg = user.unitPreference === 'imperial' ? assessment.benchPress1rm * 0.453592 : assessment.benchPress1rm;
      const ratio = bench1rmKg / weightInKg;
      if (ratio >= 1.5) {
        pushLevel = 'advanced';
      } else if (ratio >= 1.0) {
        pushLevel = 'intermediate';
      } else if (ratio < 0.75) {
        pushLevel = 'beginner';
      }
    }
    
    // Overhead Press 1RM for push level (more conservative)
    if (assessment.overheadPress1rm) {
      const ohp1rmKg = user.unitPreference === 'imperial' ? assessment.overheadPress1rm * 0.453592 : assessment.overheadPress1rm;
      const ratio = ohp1rmKg / weightInKg;
      if (ratio >= 0.9) {
        pushLevel = 'advanced';
      } else if (ratio >= 0.6) {
        pushLevel = pushLevel === 'advanced' ? 'advanced' : 'intermediate';
      } else if (ratio < 0.5) {
        pushLevel = 'beginner';
      }
    }
    
    // Barbell Row 1RM for pull level
    if (assessment.barbellRow1rm) {
      const row1rmKg = user.unitPreference === 'imperial' ? assessment.barbellRow1rm * 0.453592 : assessment.barbellRow1rm;
      const ratio = row1rmKg / weightInKg;
      if (ratio >= 1.5) {
        pullLevel = 'advanced';
      } else if (ratio >= 1.0) {
        pullLevel = 'intermediate';
      } else if (ratio < 0.75) {
        pullLevel = 'beginner';
      }
    }
  }
  
  // Apply manual overrides - use the higher of performance level or override
  function getMaxLevel(performanceLevel: MovementPatternLevel, override?: string | null): MovementPatternLevel {
    if (!override) return performanceLevel;
    
    const levels: MovementPatternLevel[] = ['beginner', 'intermediate', 'advanced'];
    const performanceIndex = levels.indexOf(performanceLevel);
    const overrideIndex = levels.indexOf(override as MovementPatternLevel);
    
    return overrideIndex > performanceIndex ? override as MovementPatternLevel : performanceLevel;
  }
  
  return {
    push: getMaxLevel(pushLevel, assessment.pushOverride),
    pull: getMaxLevel(pullLevel, assessment.pullOverride),
    lowerBody: getMaxLevel(lowerBodyLevel, assessment.lowerBodyOverride),
    hinge: getMaxLevel(hingeLevel, assessment.hingeOverride),
    cardio: getMaxLevel(cardioLevel, assessment.cardioOverride),
  };
}

// Convert movement pattern level to allowed difficulty array
export function getAllowedDifficulties(level: MovementPatternLevel): string[] {
  if (level === 'beginner') return ['beginner'];
  if (level === 'intermediate') return ['beginner', 'intermediate'];
  return ['beginner', 'intermediate', 'advanced'];
}

// Get allowed difficulties map for all movement patterns
export function getMovementDifficultiesMap(
  levels: MovementPatternLevels,
  fitnessLevel: string = 'beginner'
): { [pattern: string]: string[] } {
  const getDefault = (level: string): string[] => {
    if (level === 'beginner') return ['beginner'];
    if (level === 'intermediate') return ['beginner', 'intermediate'];
    return ['beginner', 'intermediate', 'advanced'];
  };
  
  return {
    push: getAllowedDifficulties(levels.push),
    pull: getAllowedDifficulties(levels.pull),
    squat: getAllowedDifficulties(levels.lowerBody),
    lunge: getAllowedDifficulties(levels.lowerBody),
    hinge: getAllowedDifficulties(levels.hinge),
    cardio: getAllowedDifficulties(levels.cardio),
    core: getDefault(fitnessLevel),
    rotation: getDefault(fitnessLevel),
    carry: getDefault(fitnessLevel),
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
    if (level === 'beginner') return ['beginner'];
    if (level === 'intermediate') return ['beginner', 'intermediate'];
    return ['beginner', 'intermediate', 'advanced'];
  };
  
  const allowedForPattern = movementDifficulties[pattern] || getDefault(fitnessLevel);
  return allowedForPattern.includes(difficulty);
}
