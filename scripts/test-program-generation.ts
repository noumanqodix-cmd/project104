import { generateWorkoutProgram } from '../server/ai-service';
import type { User, FitnessAssessment, Exercise } from '../shared/schema';
import { db } from '../server/db';
import { exercises as exercisesTable } from '../shared/schema';

// Test user data - 4-day beginner program to test isolation reuse logic
const testUser: Partial<User> = {
  id: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com',
  fitnessLevel: 'beginner',
  equipment: ['barbell', 'dumbbells', 'pull-up bar', 'bench'],
  goal: 'maintain',
  nutritionGoal: 'maintain',
  daysPerWeek: 4,
  workoutDuration: 60,
  selectedDays: [1, 3, 5, 6] as any, // Monday, Wednesday, Friday, Saturday
  height: 70,
  weight: 180,
  age: 30,
  unitPreference: 'imperial',
  hasCompletedOnboarding: 1,
  hasCompletedAssessment: 1
} as User;

// Test fitness assessment
const testAssessment: Partial<FitnessAssessment> = {
  id: 'test-assessment-123',
  userId: 'test-user-123',
  testDate: new Date(),
  experienceLevel: 'beginner',
  pushups: 10,
  pikePushups: 5,
  pullups: 3,
  squats: 20,
  walkingLunges: 10,
  singleLegRdl: 8,
  plankHoldSeconds: 45,
  mileTimeMinutes: 10,
  pushupOverride: null,
  pullupsOverride: null,
  squatsOverride: null,
  hingeOverride: null,
  coreOverride: null,
  cardioOverride: null,
  horizontal_push_override: null,
  vertical_push_override: null
} as FitnessAssessment;

async function runTest() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FITFORGE PROGRAM GENERATION TEST');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n📋 TEST CONFIGURATION:');
  console.log(`  Experience Level: ${testAssessment.experienceLevel}`);
  console.log(`  Days per Week: ${testUser.daysPerWeek}`);
  console.log(`  Session Duration: ${testUser.sessionDuration} minutes`);
  console.log(`  Equipment: ${testUser.equipment.join(', ')}`);
  console.log(`  Goal: ${testUser.goal}`);
  console.log(`\n💪 FITNESS ASSESSMENT:`);
  console.log(`  Push-Ups: ${testAssessment.pushups}`);
  console.log(`  Pike Push-Ups: ${testAssessment.pikePushups}`);
  console.log(`  Pull-Ups: ${testAssessment.pullups}`);
  console.log(`  Squats: ${testAssessment.squats}`);
  console.log(`  Walking Lunges: ${testAssessment.walkingLunges}`);
  console.log(`  Single-Leg RDL: ${testAssessment.singleLegRdl}`);
  console.log(`  Plank Hold: ${testAssessment.plankHoldSeconds}s`);
  console.log(`  Mile Time: ${testAssessment.mileTimeMinutes} min`);

  console.log('\n🔄 FETCHING EXERCISES FROM DATABASE...');
  
  // Fetch all exercises from database
  const availableExercises = await db.select().from(exercisesTable);
  console.log(`   Found ${availableExercises.length} exercises in database\n`);

  console.log('🔄 GENERATING PROGRAM...\n');

  const program = await generateWorkoutProgram({
    user: testUser,
    latestAssessment: testAssessment,
    availableExercises
  });

  console.log('✅ PROGRAM GENERATED SUCCESSFULLY!\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  PROGRAM: ${program.programType}`);
  console.log(`  Weekly Structure: ${program.weeklyStructure}`);
  console.log(`  Duration: ${program.durationWeeks} weeks`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Track movement patterns across all workouts
  const patternCounts = new Map<string, number>();
  
  // Analyze each workout
  program.workouts.forEach((workout, index) => {
    const workoutNum = index + 1;
    console.log(`\n${'─'.repeat(65)}`);
    console.log(`📅 WORKOUT ${workoutNum}: ${workout.workoutName}`);
    console.log(`   Day: ${workout.dayOfWeek}`);
    console.log(`   Type: ${workout.workoutType}`);
    console.log(`   Focus: ${workout.movementFocus.join(', ')}`);
    console.log(`${'─'.repeat(65)}`);

    if (!workout.exercises || workout.exercises.length === 0) {
      console.log('   🛌 No exercises (likely rest day)\n');
      return;
    }

    let totalDuration = 0;

    workout.exercises.forEach((ex, exIndex) => {
      const exNum = exIndex + 1;
      
      // Look up full exercise details from database
      const fullExercise = availableExercises.find(e => e.name === ex.exerciseName);
      const pattern = fullExercise?.movementPattern || 'unknown';
      const difficulty = fullExercise?.difficulty || 'unknown';
      const exerciseType = fullExercise?.exerciseType || 'unknown';
      
      // Track pattern
      if (pattern !== 'unknown') {
        patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
      }

      // Calculate exercise duration
      let exDuration = 0;
      if (ex.repsMin !== undefined && ex.repsMax !== undefined) {
        const avgReps = (ex.repsMin + ex.repsMax) / 2;
        const workTime = avgReps * 2.5 * ex.sets / 60; // convert to minutes
        const restTime = ex.restSeconds * (ex.sets - 1) / 60; // convert to minutes
        const transition = 0.5; // 30 seconds
        exDuration = workTime + restTime + transition;
      } else if (ex.durationSeconds !== undefined) {
        exDuration = (ex.durationSeconds * ex.sets + ex.restSeconds * (ex.sets - 1)) / 60 + 0.5;
      }
      
      totalDuration += exDuration;

      // Display exercise info
      console.log(`\n   ${exNum}. ${ex.exerciseName} ${ex.supersetGroup ? `[${ex.supersetGroup}]` : ''}`);
      console.log(`      Pattern: ${pattern} | Difficulty: ${difficulty}`);
      console.log(`      Type: ${exerciseType} | Equipment: ${ex.equipment || 'bodyweight'}`);
      
      if (ex.repsMin !== undefined && ex.repsMax !== undefined) {
        console.log(`      Sets: ${ex.sets} x ${ex.repsMin}-${ex.repsMax} reps | Rest: ${ex.restSeconds}s`);
        if (ex.recommendedWeight) {
          console.log(`      Weight: ${ex.recommendedWeight} ${testUser.unitPreference === 'imperial' ? 'lbs' : 'kg'}`);
        }
      } else if (ex.durationSeconds !== undefined) {
        console.log(`      Sets: ${ex.sets} x ${ex.durationSeconds}s | Rest: ${ex.restSeconds}s`);
      }
      
      console.log(`      Duration: ~${exDuration.toFixed(1)} min`);
    });

    console.log(`\n   ⏱️  TOTAL WORKOUT TIME: ~${totalDuration.toFixed(1)} minutes`);
    console.log(`   🎯 TARGET: ${testUser.workoutDuration} minutes`);
    const difference = Math.abs(totalDuration - (testUser.workoutDuration || 60));
    if (difference <= 5) {
      console.log(`   ✅ Within target range!`);
    } else {
      console.log(`   ⚠️  ${difference > 0 ? 'Over' : 'Under'} by ${difference.toFixed(1)} minutes`);
    }
  });

  // Summary of movement patterns
  console.log(`\n\n${'═'.repeat(65)}`);
  console.log('📊 MOVEMENT PATTERN DISTRIBUTION ACROSS PROGRAM');
  console.log(`${'═'.repeat(65)}\n`);

  const requiredPatterns = [
    'horizontal_push',
    'vertical_push', 
    'pull',
    'squat',
    'lunge',
    'hinge',
    'core',
    'rotation',
    'carry',
    'cardio'
  ];

  let allPatternsPresent = true;

  requiredPatterns.forEach(pattern => {
    const count = patternCounts.get(pattern) || 0;
    const status = count > 0 ? '✅' : '❌';
    console.log(`   ${status} ${pattern.padEnd(20)} : ${count} exercise(s)`);
    if (count === 0) {
      allPatternsPresent = false;
    }
  });

  console.log(`\n${'═'.repeat(65)}`);
  if (allPatternsPresent) {
    console.log('✅ SUCCESS: All 10 required movement patterns are present!');
  } else {
    console.log('⚠️  WARNING: Some movement patterns are missing!');
  }
  console.log(`${'═'.repeat(65)}\n`);
}

runTest().catch(console.error);
