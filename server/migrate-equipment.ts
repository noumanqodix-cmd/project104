import { db } from "./db";
import { equipment, exercises } from "@shared/schema";
import { sql } from "drizzle-orm";

/**
 * Migration script to populate the equipment table from exercises.equipment field
 * Extracts unique equipment items, categorizes them, and sets display order
 */
async function migrateEquipment() {
  console.log("Starting equipment migration...");
  
  try {
    // Step 1: Get all exercises with their equipment arrays
    const allExercises = await db.select({
      equipment: exercises.equipment
    }).from(exercises);
    
    console.log(`Found ${allExercises.length} exercises`);
    
    // Step 2: Extract unique equipment items
    const equipmentSet = new Set<string>();
    allExercises.forEach(exercise => {
      if (exercise.equipment && Array.isArray(exercise.equipment)) {
        exercise.equipment.forEach(item => {
          if (item && item.trim()) {
            equipmentSet.add(item.trim());
          }
        });
      }
    });
    
    const uniqueEquipment = Array.from(equipmentSet).sort();
    console.log(`Found ${uniqueEquipment.length} unique equipment items:`, uniqueEquipment);
    
    // Step 3: Categorize equipment and assign display order
    const categorizeEquipment = (name: string): string => {
      const lowerName = name.toLowerCase();
      
      // Cardio equipment
      if (lowerName.includes('treadmill') || 
          lowerName.includes('bike') || 
          lowerName.includes('rower') || 
          lowerName.includes('elliptical') ||
          lowerName.includes('jump rope') ||
          lowerName.includes('stairs')) {
        return 'cardio';
      }
      
      // Weights equipment
      if (lowerName.includes('barbell') || 
          lowerName.includes('dumbbell') || 
          lowerName.includes('kettlebell') ||
          lowerName.includes('cable') ||
          lowerName.includes('smith') ||
          lowerName.includes('ez bar') ||
          lowerName.includes('trap bar') ||
          lowerName.includes('weight plate') ||
          lowerName.includes('medicine ball')) {
        return 'weights';
      }
      
      // Bodyweight equipment
      if (lowerName === 'bodyweight' || 
          lowerName === 'pull-up bar' || 
          lowerName === 'none' ||
          lowerName.includes('parallettes') ||
          lowerName.includes('gymnastics')) {
        return 'bodyweight';
      }
      
      // Default category
      return 'other';
    };
    
    // Step 4: Prepare equipment data with categories and display order
    const equipmentData = uniqueEquipment.map((name, index) => ({
      name,
      category: categorizeEquipment(name),
      displayOrder: index,
    }));
    
    // Sort by category then name for better display order
    const sortedEquipment = equipmentData.sort((a, b) => {
      const categoryOrder = { bodyweight: 0, weights: 1, cardio: 2, other: 3 };
      const catA = categoryOrder[a.category as keyof typeof categoryOrder] ?? 99;
      const catB = categoryOrder[b.category as keyof typeof categoryOrder] ?? 99;
      
      if (catA !== catB) return catA - catB;
      return a.name.localeCompare(b.name);
    });
    
    // Reassign display order after sorting
    sortedEquipment.forEach((item, index) => {
      item.displayOrder = index;
    });
    
    // Step 5: Insert equipment into database (with conflict resolution)
    console.log("\nInserting equipment into database...");
    
    for (const item of sortedEquipment) {
      try {
        await db.insert(equipment)
          .values(item)
          .onConflictDoUpdate({
            target: equipment.name,
            set: {
              category: item.category,
              displayOrder: item.displayOrder
            }
          });
        console.log(`✓ ${item.category.padEnd(12)} | ${item.name}`);
      } catch (error) {
        console.error(`✗ Failed to insert ${item.name}:`, error);
      }
    }
    
    // Step 6: Show summary
    const finalCount = await db.select({ count: sql<number>`count(*)` }).from(equipment);
    console.log(`\n✅ Migration complete! ${finalCount[0].count} equipment items in database.`);
    
    // Display by category
    console.log("\nEquipment by category:");
    const categories = ['bodyweight', 'weights', 'cardio', 'other'];
    for (const cat of categories) {
      const items = sortedEquipment.filter(e => e.category === cat);
      if (items.length > 0) {
        console.log(`\n${cat.toUpperCase()} (${items.length}):`);
        items.forEach(item => console.log(`  - ${item.name}`));
      }
    }
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run migration
migrateEquipment()
  .then(() => {
    console.log("\n🎉 Equipment migration successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Equipment migration failed:", error);
    process.exit(1);
  });
