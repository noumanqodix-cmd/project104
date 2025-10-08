/**
 * Calorie calculation utilities based on MET (Metabolic Equivalent of Task) values
 */

type IntensityLevel = "light" | "moderate" | "vigorous" | "circuit";

const MET_VALUES: Record<IntensityLevel, number> = {
  light: 3.5,      // Easy pace, lighter weights
  moderate: 5.0,   // Typical gym workout
  vigorous: 6.0,   // Heavy lifting, minimal rest
  circuit: 8.0,    // Fast-paced circuit training
};

/**
 * Calculate calories burned during a workout using the MET formula
 * Formula: Calories = Duration (minutes) × ((MET × 3.5) × Body Weight (kg) / 200)
 * 
 * @param durationMinutes - Total workout duration in minutes
 * @param bodyWeightKg - User's body weight in kilograms
 * @param intensityLevel - Workout intensity level
 * @returns Estimated calories burned (rounded to nearest integer)
 */
export function calculateCaloriesBurned(
  durationMinutes: number,
  bodyWeightKg: number,
  intensityLevel: IntensityLevel = "moderate"
): number {
  const met = MET_VALUES[intensityLevel];
  const caloriesPerMinute = (met * 3.5 * bodyWeightKg) / 200;
  const totalCalories = caloriesPerMinute * durationMinutes;
  
  return Math.round(totalCalories);
}

/**
 * Convert pounds to kilograms
 */
export function poundsToKg(pounds: number): number {
  return pounds * 0.453592;
}

/**
 * Determine intensity level from program type
 * This maps common program characteristics to appropriate MET intensity levels
 */
export function determineIntensityFromProgramType(programType: string | null | undefined): IntensityLevel {
  // Guard against undefined/null/empty inputs
  if (!programType || typeof programType !== 'string') {
    return "moderate";
  }
  
  const type = programType.toLowerCase();
  
  // Circuit training patterns
  if (type.includes("circuit") || type.includes("hiit") || type.includes("metcon")) {
    return "circuit";
  }
  
  // Vigorous patterns
  if (type.includes("strength") || type.includes("power") || type.includes("olympic") || 
      type.includes("advanced") || type.includes("intense")) {
    return "vigorous";
  }
  
  // Light patterns
  if (type.includes("beginner") || type.includes("recovery") || type.includes("mobility") ||
      type.includes("flexibility") || type.includes("rehab")) {
    return "light";
  }
  
  // Default to moderate for everything else
  return "moderate";
}
