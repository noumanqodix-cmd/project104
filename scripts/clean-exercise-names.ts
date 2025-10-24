import { db } from "../server/db";
import { exercises } from "../shared/schema";
import { sql } from "drizzle-orm";

/**
 * Migration script to remove equipment prefixes from exercise names
 * Equipment info should only be in the equipment field, not the name
 */

const EQUIPMENT_PREFIXES = [
  'bodyweight',
  'barbell',
  'dumbbell',
  'dumbbells',
  'kettlebell',
  'cable',
  'machine',
  'resistance band',
  'resistance bands',
  'trx',
  'ez bar',
  'trap bar',
  'smith machine',
  'leg press machine',
  'hack squat machine'
];

async function cleanExerciseNames() {
  console.log('[MIGRATION] Starting exercise name cleanup...');
  
  try {
    // Fetch all exercises
    const allExercises = await db.select().from(exercises);
    console.log(`[MIGRATION] Found ${allExercises.length} exercises to check`);
    
    const updates: Array<{ id: string; oldName: string; newName: string }> = [];
    
    for (const exercise of allExercises) {
      const originalName = exercise.name;
      let cleanedName = originalName;
      
      // Check if name starts with any equipment prefix (case-insensitive)
      for (const prefix of EQUIPMENT_PREFIXES) {
        const regex = new RegExp(`^${prefix}\\s+`, 'i');
        if (regex.test(cleanedName)) {
          // Remove the prefix and trim
          cleanedName = cleanedName.replace(regex, '').trim();
          break; // Only remove the first matching prefix
        }
      }
      
      // If name changed, record it for update
      if (cleanedName !== originalName && cleanedName.length > 0) {
        updates.push({
          id: exercise.id,
          oldName: originalName,
          newName: cleanedName
        });
      }
    }
    
    console.log(`[MIGRATION] Found ${updates.length} exercises to update:`);
    updates.forEach(u => {
      console.log(`  - "${u.oldName}" → "${u.newName}"`);
    });
    
    // Apply updates
    for (const update of updates) {
      await db.update(exercises)
        .set({ name: update.newName })
        .where(sql`${exercises.id} = ${update.id}`);
    }
    
    console.log(`[MIGRATION] Successfully updated ${updates.length} exercise names`);
    console.log('[MIGRATION] Migration complete!');
    
    return updates;
  } catch (error) {
    console.error('[MIGRATION] Error during cleanup:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanExerciseNames()
    .then(() => {
      console.log('[MIGRATION] Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[MIGRATION] Failed:', error);
      process.exit(1);
    });
}

export { cleanExerciseNames };
