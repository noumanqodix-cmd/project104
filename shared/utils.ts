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
}

interface UserData {
  weight?: number | null;
  unitPreference?: string;
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
  
  return {
    push: pushLevel,
    pull: pullLevel,
    lowerBody: lowerBodyLevel,
    hinge: hingeLevel,
    cardio: cardioLevel,
  };
}
