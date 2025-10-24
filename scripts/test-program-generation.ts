import { generateWorkoutProgram } from '../server/ai-service';
import type { User, FitnessAssessment, Exercise } from '../shared/schema';
import { db } from '../server/db';
import { exercises as exercisesTable } from '../shared/schema';

// Base test user - will be modified for different test scenarios
const baseTestUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  profileImageUrl: null,
  subscriptionTier: 'free',
  fitnessLevel: 'beginner',
  equipment: ['dumbbells'], // Dumbbell-only to stress test limited equipment
  nutritionGoal: 'maintain',
  daysPerWeek: 3, // Will be modified per test
  workoutDuration: 60,
  selectedDays: [1, 3, 5], // Will be modified per test
  selectedDates: [],
  cycleNumber: 1,
  totalWorkoutsCompleted: 0,
  height: 70,
  weight: 180,
  dateOfBirth: new Date('1994-01-01'),
  bmr: null,
  targetCalories: null,
  unitPreference: 'imperial',
  createdAt: new Date(),
  updatedAt: new Date()
} as User;

// Test fitness assessment
const testAssessment = {
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
  plankHold: 45,
  mileTime: 10,
  squat1rm: null,
  deadlift1rm: null,
  benchPress1rm: null,
  overheadPress1rm: null,
  barbellRow1rm: null,
  dumbbellLunge1rm: null,
  farmersCarry1rm: null,
  horizontalPushOverride: null,
  verticalPushOverride: null,
  verticalPullOverride: null,
  horizontalPullOverride: null,
  lowerBodyOverride: null,
  hingeOverride: null,
  coreOverride: null,
  rotationOverride: null,
  carryOverride: null,
  cardioOverride: null
} as FitnessAssessment;

async function runSingleTest(daysPerWeek: 3 | 4 | 5, availableExercises: Exercise[]) {
  // Configure test user for this frequency
  const selectedDaysMap = {
    3: [1, 3, 5], // Mon, Wed, Fri
    4: [1, 2, 4, 5], // Mon, Tue, Thu, Fri
    5: [1, 2, 3, 4, 5] // Mon, Tue, Wed, Thu, Fri
  };
  
  const testUser = {
    ...baseTestUser,
    daysPerWeek,
    selectedDays: selectedDaysMap[daysPerWeek]
  } as User;

  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log(`  PROGRAM GENERATION TEST - ${daysPerWeek} DAYS PER WEEK`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n📋 TEST CONFIGURATION:');
  console.log(`  Experience Level: ${testAssessment.experienceLevel}`);
  console.log(`  Days per Week: ${testUser.daysPerWeek}`);
  console.log(`  Session Duration: ${testUser.workoutDuration} minutes`);
  console.log(`  Equipment: ${testUser.equipment?.join(', ')}`);
  console.log(`  Nutrition Goal: ${testUser.nutritionGoal}`);

  console.log('\n🔄 GENERATING PROGRAM...\n');

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
      const category = fullExercise?.exerciseCategory || 'unknown';
      
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
      } else if (ex.workSeconds !== undefined) {
        // HIIT cardio with work/rest intervals
        const totalWorkTime = (ex.workSeconds / 60) * ex.sets;
        const totalRestTime = (ex.restSeconds / 60) * (ex.sets - 1);
        const transition = 0.5;
        exDuration = totalWorkTime + totalRestTime + transition;
      } else if (ex.durationSeconds !== undefined) {
        // Duration-based exercises (planks, holds)
        exDuration = (ex.durationSeconds * ex.sets + ex.restSeconds * (ex.sets - 1)) / 60 + 0.5;
      }
      
      totalDuration += exDuration;

      // Display exercise info
      console.log(`\n   ${exNum}. ${ex.exerciseName} ${ex.supersetGroup ? `[${ex.supersetGroup}]` : ''}`);
      console.log(`      Pattern: ${pattern} | Difficulty: ${difficulty}`);
      console.log(`      Category: ${category} | Equipment: ${ex.equipment || 'bodyweight'}`);
      
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
    const isOver = totalDuration > (testUser.workoutDuration || 60);
    if (difference <= 5) {
      console.log(`   ✅ Within target range!`);
    } else {
      console.log(`   ⚠️  ${isOver ? 'Over' : 'Under'} by ${difference.toFixed(1)} minutes`);
    }
  });

  // Summary of movement patterns
  console.log(`\n\n${'═'.repeat(65)}`);
  console.log('📊 MOVEMENT PATTERN DISTRIBUTION ACROSS PROGRAM');
  console.log(`${'═'.repeat(65)}\n`);

  const requiredPatterns = [
    'horizontal_push',
    'vertical_push',
    'vertical_pull',
    'horizontal_pull',
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
    console.log('✅ SUCCESS: All 11 required movement patterns are present!');
  } else {
    console.log('⚠️  WARNING: Some movement patterns are missing!');
  }
  console.log(`${'═'.repeat(65)}\n`);
}

async function runAllTests() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     Morphit PROGRAM GENERATION TEST SUITE                    ║');
  console.log('║     Testing: 3, 4, 5 Days/Week | Dumbbells Only | 60 Min      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  console.log('\n🔄 FETCHING EXERCISES FROM DATABASE...');
  const availableExercises = await db.select().from(exercisesTable);
  console.log(`   Found ${availableExercises.length} exercises in database`);

  // Run tests for each frequency
  for (const days of [3, 4, 5] as const) {
    await runSingleTest(days, availableExercises);
  }

  console.log('\n\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     ALL TESTS COMPLETE                                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
}

runAllTests().catch(console.error);
