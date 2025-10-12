import { db } from '../server/db';
import { users, workoutSessions, programExercises, exercises } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

async function analyzeUserPrograms() {
  try {
    console.log('='.repeat(80));
    console.log('ANALYZING ACTUAL USER PROGRAMS FROM DATABASE');
    console.log('='.repeat(80));

    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      fitnessLevel: users.fitnessLevel,
      daysPerWeek: users.daysPerWeek,
      sessionDuration: users.sessionDuration,
      nutritionGoal: users.nutritionGoal,
      equipment: users.equipment,
      cycleNumber: users.cycleNumber,
      totalWorkoutsCompleted: users.totalWorkoutsCompleted,
    }).from(users);

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

      const sessions = await db.select({
        id: workoutSessions.id,
        workoutName: workoutSessions.workoutName,
        scheduledDate: workoutSessions.scheduledDate,
        completedAt: workoutSessions.completedAt,
        workoutIndex: workoutSessions.workoutIndex,
      })
      .from(workoutSessions)
      .where(eq(workoutSessions.userId, user.id))
      .orderBy(workoutSessions.workoutIndex);

      if (sessions.length === 0) {
        console.log('\n  ⚠️  No workout sessions found for this user\n');
        continue;
      }

      console.log(`\n  📅 Program Overview (${sessions.length} sessions):`);
      console.log('  ' + '─'.repeat(76));

      for (const session of sessions) {
        const exerciseData = await db.select({
          exerciseId: programExercises.exerciseId,
          name: exercises.name,
          sets: programExercises.sets,
          repsMin: programExercises.repsMin,
          repsMax: programExercises.repsMax,
          duration: programExercises.durationSeconds,
          restSeconds: programExercises.restSeconds,
          exerciseCategory: exercises.exercise_category,
          movementPattern: exercises.movement_pattern,
        })
        .from(programExercises)
        .leftJoin(exercises, eq(programExercises.exerciseId, exercises.id))
        .where(eq(programExercises.workoutId, session.id))
        .orderBy(programExercises.orderIndex);

        const status = session.completedAt ? '✅' : '⏳';
        const dateStr = session.scheduledDate || 'No date';
        console.log(`\n  ${status} Day ${session.workoutIndex + 1}: ${session.workoutName} (${dateStr})`);

        if (exerciseData.length === 0) {
          console.log('     ⚠️  No exercises found');
          continue;
        }

        let totalEstimatedTime = 0;
        const patternCounts: Record<string, number> = {};
        const categoryCounts: Record<string, number> = {};

        console.log('     Exercises:');
        exerciseData.forEach((ex, idx) => {
          const pattern = ex.movementPattern || 'unknown';
          const category = ex.exerciseCategory || 'unknown';
          
          patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;

          const sets = ex.sets || 0;
          const reps = ex.repsMin && ex.repsMax ? `${ex.repsMin}-${ex.repsMax}` : 'N/A';
          const rest = ex.restSeconds || 0;

          if (category === 'cardio' && ex.duration) {
            const cardioTime = Math.ceil(ex.duration / 60);
            totalEstimatedTime += cardioTime;
            console.log(`     ${idx + 1}. [${category.toUpperCase()}] ${ex.name} - ${Math.floor(ex.duration / 60)}min (~${cardioTime}min total)`);
          } else {
            const exerciseTime = sets * ((ex.repsMin || 0) * 3 + rest);
            totalEstimatedTime += Math.ceil(exerciseTime / 60);
            console.log(`     ${idx + 1}. [${category.toUpperCase()}] ${ex.name} - ${sets}×${reps}, ${rest}s rest (~${Math.ceil(exerciseTime / 60)}min)`);
          }
        });

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

      const allPatterns = await db.select({
        pattern: exercises.movement_pattern,
      })
      .from(programExercises)
      .leftJoin(exercises, eq(programExercises.exerciseId, exercises.id))
      .leftJoin(workoutSessions, eq(programExercises.workoutId, workoutSessions.id))
      .where(eq(workoutSessions.userId, user.id))
      .groupBy(exercises.movement_pattern);

      const uniquePatterns = new Set(allPatterns.map(p => p.pattern).filter(Boolean));
      
      console.log(`\n  🎯 Program Summary:`);
      console.log(`     Total unique movement patterns: ${uniquePatterns.size}/10`);
      console.log(`     Patterns covered: ${Array.from(uniquePatterns).join(', ')}`);

      const missing = [
        'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
        'squat', 'hinge', 'lunge', 'core', 'rotation', 'carry'
      ].filter(p => !uniquePatterns.has(p));

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
