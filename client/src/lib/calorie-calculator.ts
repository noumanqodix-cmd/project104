/**
 * Frontend calorie calculation utilities
 * Mirrors the backend MET-based calculation logic
 */

type IntensityLevel = "light" | "moderate" | "vigorous" | "circuit";

const MET_VALUES: Record<IntensityLevel, number> = {
  light: 3.5,
  moderate: 5.0,
  vigorous: 6.0,
  circuit: 8.0,
};

/**
 * Calculate calories burned using the MET formula
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
