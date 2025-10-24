import { db } from '../server/db';
import { users, workoutSessions, programExercises, exercises } from '../shared/schema';
import { eq, asc } from 'drizzle-orm';

async function analyzeUserPrograms() {
  try {
    console.log('='.repeat(80));
    console.log('ANALYZING ACTUAL USER PROGRAMS FROM DATABASE');
    console.log('='.repeat(80));

    // Get all users
    const allUsers = await db.select().from(users);

    if (allUsers.length === 0) {
      console.log('\n❌ No users found in database');
      process.exit(0);
    }

    console.log(`\n📊 Found ${allUsers.length} user(s) in database\n`);

    for (const user of allUsers) {
      console.log('─'.repeat(80));
      console.log(`USER: ${user.username || 'Anonymous'} (ID: ${user.id})`);
      console.log('─'.repeat(80));
      console.log(`Fitness Level: ${user.fitnessLevel || 'N/A'}`);
      console.log(`Days/Week: ${user.daysPerWeek || 'N/A'}`);
      console.log(`Session Duration: ${user.sessionDuration || 'N/A'} min`);
      console.log(`Nutrition Goal: ${user.nutritionGoal || 'N/A'}`);
      console.log(`Equipment: ${user.equipment?.join(', ') || 'N/A'}`);
      console.log(`Cycle #${user.cycleNumber || 0}, Total Workouts: ${user.totalWorkoutsCompleted || 0}`);

      // Get sessions for this user
      const sessions = await db
        .select()
        .from(workoutSessions)
        .where(eq(workoutSessions.userId, user.id));
      
      // Sort by workoutIndex manually
      sessions.sort((a, b) => (a.workoutIndex || 0) - (b.workoutIndex || 0));

      if (sessions.length === 0) {
        console.log('\n  ⚠️  No workout sessions found for this user\n');
        continue;
      }

      console.log(`\n  📅 Program Overview (${sessions.length} sessions):`);
      console.log('  ' + '─'.repeat(76));

      // Track all patterns across the program
      const allPatterns = new Set<string>();

      for (const session of sessions) {
        const status = session.completedAt ? '✅' : '⏳';
        const dateStr = session.scheduledDate || 'No date';
        console.log(`\n  ${status} Day ${session.workoutIndex + 1}: ${session.workoutName} (${dateStr})`);

        // Get exercises for this session via programWorkoutId
        const sessionExercises = await db
          .select()
          .from(programExercises)
          .where(eq(programExercises.workoutId, session.programWorkoutId || ''));
        
        // Sort by orderIndex manually
        sessionExercises.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

        if (sessionExercises.length === 0) {
          console.log('     ⚠️  No exercises found');
          continue;
        }

        let totalEstimatedTime = 0;
        const patternCounts: Record<string, number> = {};
        const categoryCounts: Record<string, number> = {};

        console.log('     Exercises:');

        for (let idx = 0; idx < sessionExercises.length; idx++) {
          const ex = sessionExercises[idx];
          
          // Get exercise details
          const exerciseDetails = await db
            .select()
            .from(exercises)
            .where(eq(exercises.id, ex.exerciseId))
            .limit(1);

          const exercise = exerciseDetails[0];
          if (!exercise) {
            console.log(`     ${idx + 1}. Unknown exercise (ID: ${ex.exerciseId})`);
            continue;
          }

          const pattern = exercise.movement_pattern || 'unknown';
          const category = exercise.exercise_category || 'unknown';
          
          allPatterns.add(pattern);
          patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;

          const sets = ex.sets || 0;
          const reps = ex.repsMin && ex.repsMax ? `${ex.repsMin}-${ex.repsMax}` : 'N/A';
          const rest = ex.restSeconds || 0;

          if (category === 'cardio' && ex.durationSeconds) {
            const cardioTime = Math.ceil(ex.durationSeconds / 60);
            totalEstimatedTime += cardioTime;
            console.log(`     ${idx + 1}. [${category.toUpperCase()}] ${exercise.name} - ${Math.floor(ex.durationSeconds / 60)}min (~${cardioTime}min total)`);
          } else {
            const exerciseTime = sets * ((ex.repsMin || 0) * 3 + rest);
            totalEstimatedTime += Math.ceil(exerciseTime / 60);
            console.log(`     ${idx + 1}. [${category.toUpperCase()}] ${exercise.name} - ${sets}×${reps}, ${rest}s rest (~${Math.ceil(exerciseTime / 60)}min)`);
          }
        }

        console.log(`\n     📊 Pattern Coverage:`);
        const sortedPatterns = Object.entries(patternCounts).sort((a, b) => b[1] - a[1]);
        sortedPatterns.forEach(([pattern, count]) => {
          console.log(`        • ${pattern}: ${count}×`);
        });

        console.log(`\n     ⏱️  Estimated Duration: ~${totalEstimatedTime} minutes (Target: ${user.sessionDuration || 'N/A'}min)`);
        const diff = totalEstimatedTime - (user.sessionDuration || 0);
        if (Math.abs(diff) > 10) {
          console.log(`        ⚠️  ${diff > 0 ? 'OVER' : 'UNDER'} by ${Math.abs(diff)} minutes!`);
        }
      }

      console.log(`\n  🎯 Program Summary:`);
      console.log(`     Total unique movement patterns: ${allPatterns.size}/10`);
      console.log(`     Patterns covered: ${Array.from(allPatterns).join(', ')}`);

      const missing = [
        'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
        'squat', 'hinge', 'lunge', 'core', 'rotation', 'carry'
      ].filter(p => !allPatterns.has(p));

      if (missing.length > 0) {
        console.log(`     ❌ Missing patterns: ${missing.join(', ')}`);
      } else {
        console.log(`     ✅ All 10 movement patterns covered!`);
      }

      console.log('');
    }

    console.log('='.repeat(80));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error analyzing programs:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

analyzeUserPrograms();
