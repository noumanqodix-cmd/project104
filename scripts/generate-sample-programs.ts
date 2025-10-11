import { generateWorkoutProgram } from '../server/ai-service';
import { db } from '../server/db';
import { users, fitnessAssessments, workoutPrograms, exercises, programWorkouts, programExercises } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

async function generateSamplePrograms() {
  const userIds = ['test_beginner', 'test_intermediate', 'test_advanced'];
  
  for (const userId of userIds) {
    console.log(`\nGenerating program for ${userId}...`);
    
    // Delete existing program
    await db.delete(workoutPrograms).where(eq(workoutPrograms.userId, userId));
    
    // Get user and assessment
    const [userRow] = await db.select().from(users).where(eq(users.id, userId));
    const [assessmentRow] = await db.select().from(fitnessAssessments).where(eq(fitnessAssessments.userId, userId));
    
    if (!userRow || !assessmentRow) {
      console.log(`Missing user or assessment for ${userId}`);
      continue;
    }
    
    // Get all exercises
    const availableExercises = await db.select().from(exercises);
    
    // Generate program with correct input format
    const generatedProgram = await generateWorkoutProgram({
      user: userRow as any,
      latestAssessment: assessmentRow as any,
      availableExercises: availableExercises as any,
    });
    
    // Save the generated program
    const [newProgram] = await db.insert(workoutPrograms).values({
      userId,
      programType: generatedProgram.programType || "AI Generated Program",
      weeklyStructure: generatedProgram.weeklyStructure || "Personalized training program",
      durationWeeks: generatedProgram.durationWeeks || 8,
      isActive: 1,
    }).returning();
    
    // Save workouts and exercises
    for (const workout of generatedProgram.workouts) {
      const [programWorkout] = await db.insert(programWorkouts).values({
        programId: newProgram.id,
        workoutName: workout.workoutName,
        dayOfWeek: workout.dayOfWeek,
        workoutType: workout.workoutType || null,
        movementFocus: workout.movementFocus || [],
      }).returning();
      
      for (let i = 0; i < workout.exercises.length; i++) {
        const exercise = workout.exercises[i];
        const matchingExercise = availableExercises.find(
          ex => ex.name.toLowerCase() === exercise.exerciseName.toLowerCase()
        );
        
        if (matchingExercise) {
          await db.insert(programExercises).values({
            workoutId: programWorkout.id,
            exerciseId: matchingExercise.id,
            equipment: exercise.equipment,
            orderIndex: i,
            sets: exercise.sets,
            repsMin: exercise.repsMin,
            repsMax: exercise.repsMax,
            recommendedWeight: exercise.recommendedWeight,
            durationSeconds: exercise.durationSeconds,
            workSeconds: exercise.workSeconds,
            restSeconds: exercise.restSeconds,
            targetRPE: exercise.targetRPE,
            targetRIR: exercise.targetRIR,
            notes: exercise.notes,
            supersetGroup: exercise.supersetGroup,
            supersetOrder: exercise.supersetOrder,
          });
        }
      }
    }
    
    console.log(`✓ Program saved: ${generatedProgram.programType}`);
  }
  
  console.log('\nDone!');
  process.exit(0);
}

generateSamplePrograms().catch(console.error);
