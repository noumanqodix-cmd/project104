import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatExerciseName(exerciseName: string, equipment?: string | null): string {
  if (!equipment) {
    return exerciseName;
  }
  
  const capitalizedEquipment = equipment.charAt(0).toUpperCase() + equipment.slice(1);
  return `${capitalizedEquipment} ${exerciseName}`;
}
