import { 
  Dumbbell, 
  Box, 
  Anchor, 
  Cable, 
  Grid3x3,
  Link,
  Repeat,
  User,
  CircleDot,
  Activity,
  Bike,
  Wind,
  type LucideIcon
} from "lucide-react";

/**
 * Maps equipment names to their corresponding Lucide icons
 * This provides consistent icon representation across the application
 */
export function getEquipmentIcon(equipmentName: string): LucideIcon {
  const name = equipmentName.toLowerCase();
  
  // Strength equipment icons
  if (name === 'bodyweight') return User;
  if (name === 'dumbbells' || name === 'dumbbell') return Dumbbell;
  if (name === 'kettlebell') return CircleDot;
  if (name === 'barbell' || name === 'bar') return Anchor;
  if (name === 'resistance bands' || name.includes('band')) return Cable;
  if (name.includes('cable')) return Cable;
  if (name === 'pull-up bar' || name.includes('pull')) return Grid3x3;
  if (name === 'trx' || name.includes('suspension')) return Link;
  if (name === 'medicine ball' || name.includes('medicine')) return Box;
  if (name === 'box' || name.includes('box') || name.includes('bench')) return Box;
  if (name === 'jump rope' || name.includes('rope')) return Repeat;
  
  // Cardio equipment icons
  if (name === 'rower' || name.includes('row')) return Activity;
  if (name === 'bike' || name === 'assault bike') return name.includes('assault') ? Wind : Bike;
  if (name === 'treadmill') return Activity;
  if (name === 'elliptical') return Activity;
  if (name.includes('stair')) return Activity;
  
  // Default icon
  return Activity;
}

/**
 * Formats equipment name for display
 * Capitalizes words and handles special cases
 */
export function formatEquipmentLabel(equipmentName: string): string {
  const name = equipmentName.toLowerCase();
  
  // Special cases
  if (name === 'trx') return 'TRX/Suspension Trainer';
  if (name === 'suspension trainer') return 'TRX/Suspension Trainer';
  if (name === 'box') return 'Box/Bench';
  if (name === 'pull-up bar') return 'Pull-up Bar';
  if (name === 'jump rope') return 'Jump Rope';
  if (name === 'assault bike') return 'Assault Bike';
  if (name === 'stair climber') return 'Stair Climber';
  if (name === 'medicine ball') return 'Medicine Ball';
  if (name === 'resistance bands') return 'Resistance Bands';
  
  // Default: capitalize first letter of each word
  return equipmentName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Formats category name for display
 */
export function formatCategoryName(category: string): string {
  if (category === 'bodyweight') return 'Bodyweight';
  if (category === 'weights') return 'Strength Equipment';
  if (category === 'cardio') return 'Cardio Equipment';
  if (category === 'other') return 'Other Equipment';
  return category.charAt(0).toUpperCase() + category.slice(1);
}
