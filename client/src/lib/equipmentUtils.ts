/**
 * Shared equipment toggle logic for onboarding and settings
 * Implements bodyweight-only mutual exclusivity:
 * - Selecting "bodyweight" clears all other equipment
 * - Selecting any other equipment removes "bodyweight" from the list
 */
export function toggleEquipment(
  currentEquipment: string[],
  equipmentId: string
): string[] {
  if (equipmentId === "bodyweight") {
    // If bodyweight only is selected, clear all other equipment
    return currentEquipment.includes("bodyweight") ? [] : ["bodyweight"];
  } else {
    // Remove bodyweight if other equipment is selected
    const filtered = currentEquipment.filter(e => e !== "bodyweight");
    if (filtered.includes(equipmentId)) {
      return filtered.filter(e => e !== equipmentId);
    } else {
      return [...filtered, equipmentId];
    }
  }
}
