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
  experienceLevel?: string;
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
  const fitnessLevel = assessment.experienceLevel || 'beginner';
  
  // Start with self-reported level
  let pushLevel: MovementPatternLevel = fitnessLevel as MovementPatternLevel;
  let pullLevel: MovementPatternLevel = fitnessLevel as MovementPatternLevel;
  let lowerBodyLevel: MovementPatternLevel = fitnessLevel as MovementPatternLevel;
  let hingeLevel: MovementPatternLevel = fitnessLevel as MovementPatternLevel;
  let cardioLevel: MovementPatternLevel = fitnessLevel as MovementPatternLevel;
  
  // Bodyweight test checks
  const pushups = assessment.pushups || 0;
  const pullups = assessment.pullups || 0;
  const squats = assessment.squats || 0;
  
  if (pushups < 5) {
    pushLevel = 'beginner';
  } else if (pushups >= 5 && pushups < 15 && pushLevel === 'advanced') {
    pushLevel = 'intermediate';
  }
  
  if (pullups < 2) {
    pullLevel = 'beginner';
  } else if (pullups >= 2 && pullups < 8 && pullLevel === 'advanced') {
    pullLevel = 'intermediate';
  }
  
  if (squats < 15) {
    lowerBodyLevel = 'beginner';
    hingeLevel = 'beginner';
  } else if (squats >= 15 && squats < 30 && (lowerBodyLevel === 'advanced' || hingeLevel === 'advanced')) {
    lowerBodyLevel = lowerBodyLevel === 'advanced' ? 'intermediate' : lowerBodyLevel;
    hingeLevel = hingeLevel === 'advanced' ? 'intermediate' : hingeLevel;
  }
  
  // Mile time check for cardio
  const mileTime = assessment.mileTime || 999;
  if (mileTime > 12) {
    cardioLevel = 'beginner';
  } else if (mileTime > 9) {
    cardioLevel = cardioLevel === 'advanced' ? 'intermediate' : cardioLevel;
  }
  
  // Weighted test checks (using bodyweight ratios)
  if (user.weight && user.weight > 0) {
    const weightInKg = user.unitPreference === 'imperial' ? user.weight * 0.453592 : user.weight;
    
    if (assessment.squat1rm) {
      const squat1rmKg = user.unitPreference === 'imperial' ? assessment.squat1rm * 0.453592 : assessment.squat1rm;
      if (squat1rmKg < weightInKg * 1.0) {
        lowerBodyLevel = 'beginner';
      } else if (squat1rmKg < weightInKg * 1.5 && lowerBodyLevel === 'advanced') {
        lowerBodyLevel = 'intermediate';
      }
    }
    
    if (assessment.deadlift1rm) {
      const deadlift1rmKg = user.unitPreference === 'imperial' ? assessment.deadlift1rm * 0.453592 : assessment.deadlift1rm;
      if (deadlift1rmKg < weightInKg * 1.25) {
        hingeLevel = 'beginner';
      } else if (deadlift1rmKg < weightInKg * 2.0 && hingeLevel === 'advanced') {
        hingeLevel = 'intermediate';
      }
    }
    
    if (assessment.benchPress1rm) {
      const bench1rmKg = user.unitPreference === 'imperial' ? assessment.benchPress1rm * 0.453592 : assessment.benchPress1rm;
      if (bench1rmKg < weightInKg * 0.75) {
        pushLevel = 'beginner';
      } else if (bench1rmKg < weightInKg * 1.25 && pushLevel === 'advanced') {
        pushLevel = 'intermediate';
      }
    }
    
    if (assessment.overheadPress1rm) {
      const ohp1rmKg = user.unitPreference === 'imperial' ? assessment.overheadPress1rm * 0.453592 : assessment.overheadPress1rm;
      if (ohp1rmKg < weightInKg * 0.5) {
        pushLevel = 'beginner';
      } else if (ohp1rmKg < weightInKg * 0.75 && pushLevel === 'advanced') {
        pushLevel = 'intermediate';
      }
    }
    
    if (assessment.barbellRow1rm) {
      const row1rmKg = user.unitPreference === 'imperial' ? assessment.barbellRow1rm * 0.453592 : assessment.barbellRow1rm;
      if (row1rmKg < weightInKg * 0.75) {
        pullLevel = 'beginner';
      } else if (row1rmKg < weightInKg * 1.25 && pullLevel === 'advanced') {
        pullLevel = 'intermediate';
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
