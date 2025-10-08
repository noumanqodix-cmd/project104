import OpenAI from "openai";
import type { User, FitnessAssessment, Exercise } from "@shared/schema";
import { selectProgramTemplate, getTemplateInstructions } from "./programTemplates";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ProgramGenerationInput {
  user: User;
  latestAssessment: FitnessAssessment;
  availableExercises: Exercise[];
}

export interface GeneratedProgram {
  programType: string;
  weeklyStructure: string;
  durationWeeks: number;
  workouts: GeneratedWorkout[];
}

export interface GeneratedWorkout {
  dayOfWeek: number;
  workoutName: string;
  movementFocus: string[];
  exercises: GeneratedExercise[];
}

export interface GeneratedExercise {
  exerciseName: string;
  sets: number;
  repsMin?: number;
  repsMax?: number;
  recommendedWeight?: number;  // Recommended starting weight in user's unit preference
  durationSeconds?: number;
  workSeconds?: number;  // For HIIT exercises: work interval duration
  restSeconds: number;
  targetRPE?: number;  // Rate of Perceived Exertion (1-10)
  targetRIR?: number;  // Reps in Reserve (0-5)
  notes?: string;
  isWarmup?: boolean;  // Flag to identify warmup exercises
  supersetGroup?: string;  // "A", "B", "C" for superset grouping
  supersetOrder?: number;  // 1 or 2 to indicate order in superset
}

export async function generateWorkoutProgram(
  input: ProgramGenerationInput
): Promise<GeneratedProgram> {
  const { user, latestAssessment, availableExercises } = input;

  const equipmentList = user.equipment?.join(", ") || "bodyweight only";
  const workoutDuration = user.workoutDuration || 60;
  const daysPerWeek = Math.min(7, Math.max(1, user.daysPerWeek || 3));
  const fitnessLevel = latestAssessment.experienceLevel || user.fitnessLevel || "beginner";

  // Category-specific difficulty filtering: Map test results to movement patterns
  // This allows independent progression in different categories
  
  // Helper function to determine difficulty level based on self-reported experience
  const getDefaultDifficulties = (level: string): string[] => {
    if (level === "beginner") return ["beginner"];
    if (level === "intermediate") return ["beginner", "intermediate"];
    return ["beginner", "intermediate", "advanced"];
  };

  // Initialize difficulty map with user's self-reported level as default
  const movementDifficulties: { [pattern: string]: string[] } = {
    push: getDefaultDifficulties(fitnessLevel),
    pull: getDefaultDifficulties(fitnessLevel),
    squat: getDefaultDifficulties(fitnessLevel),
    lunge: getDefaultDifficulties(fitnessLevel),
    hinge: getDefaultDifficulties(fitnessLevel),
    cardio: getDefaultDifficulties(fitnessLevel),
    core: getDefaultDifficulties(fitnessLevel),
    rotation: getDefaultDifficulties(fitnessLevel),
    carry: getDefaultDifficulties(fitnessLevel),
  };

  const overrideReasons: string[] = [];
  
  // Bodyweight test checks - map to specific movement patterns
  const pushups = latestAssessment.pushups || 0;
  const pullups = latestAssessment.pullups || 0;
  const squats = latestAssessment.squats || 0;
  
  if (pushups < 5) {
    movementDifficulties.push = ["beginner"];
    overrideReasons.push('Push exercises limited to beginner (pushups < 5)');
  }
  
  if (pullups < 2) {
    movementDifficulties.pull = ["beginner"];
    overrideReasons.push('Pull exercises limited to beginner (pullups < 2)');
  }
  
  if (squats < 15) {
    movementDifficulties.squat = ["beginner"];
    movementDifficulties.lunge = ["beginner"];
    movementDifficulties.hinge = ["beginner"];
    overrideReasons.push('Lower body exercises limited to beginner (squats < 15)');
  }
  
  // Mile time check for cardio
  const mileTime = latestAssessment.mileTime || 999;
  if (mileTime > 12) {
    movementDifficulties.cardio = ["beginner"];
    overrideReasons.push('Cardio limited to beginner (mile time > 12 min)');
  } else if (mileTime > 9) {
    movementDifficulties.cardio = ["beginner", "intermediate"];
    overrideReasons.push('Cardio limited to intermediate (mile time > 9 min)');
  }
  
  // Weighted test checks (using bodyweight ratios) - map to specific patterns
  if (user.weight && user.weight > 0) {
    const weightInKg = user.unitPreference === "imperial" ? user.weight * 0.453592 : user.weight;
    
    if (latestAssessment.squat1rm) {
      const squat1rmKg = user.unitPreference === "imperial" ? latestAssessment.squat1rm * 0.453592 : latestAssessment.squat1rm;
      if (squat1rmKg < weightInKg * 1.0) {
        movementDifficulties.squat = ["beginner"];
        movementDifficulties.lunge = ["beginner"];
        overrideReasons.push('Squat/Lunge exercises limited to beginner (Squat 1RM < 1.0x bodyweight)');
      }
    }
    
    if (latestAssessment.deadlift1rm) {
      const deadlift1rmKg = user.unitPreference === "imperial" ? latestAssessment.deadlift1rm * 0.453592 : latestAssessment.deadlift1rm;
      if (deadlift1rmKg < weightInKg * 1.25) {
        movementDifficulties.hinge = ["beginner"];
        overrideReasons.push('Hinge exercises limited to beginner (Deadlift 1RM < 1.25x bodyweight)');
      }
    }
    
    if (latestAssessment.benchPress1rm) {
      const bench1rmKg = user.unitPreference === "imperial" ? latestAssessment.benchPress1rm * 0.453592 : latestAssessment.benchPress1rm;
      if (bench1rmKg < weightInKg * 0.75) {
        movementDifficulties.push = ["beginner"];
        overrideReasons.push('Push exercises limited to beginner (Bench Press 1RM < 0.75x bodyweight)');
      }
    }
    
    if (latestAssessment.overheadPress1rm) {
      const ohp1rmKg = user.unitPreference === "imperial" ? latestAssessment.overheadPress1rm * 0.453592 : latestAssessment.overheadPress1rm;
      if (ohp1rmKg < weightInKg * 0.5) {
        movementDifficulties.push = ["beginner"];
        overrideReasons.push('Push exercises limited to beginner (OHP 1RM < 0.5x bodyweight)');
      }
    }
    
    if (latestAssessment.barbellRow1rm) {
      const row1rmKg = user.unitPreference === "imperial" ? latestAssessment.barbellRow1rm * 0.453592 : latestAssessment.barbellRow1rm;
      if (row1rmKg < weightInKg * 0.75) {
        movementDifficulties.pull = ["beginner"];
        overrideReasons.push('Pull exercises limited to beginner (Barbell Row 1RM < 0.75x bodyweight)');
      }
    }
  }
  
  if (overrideReasons.length > 0) {
    console.log(`[DIFFICULTY] Category-specific restrictions applied:`);
    overrideReasons.forEach(reason => console.log(`  - ${reason}`));
  } else {
    console.log(`[DIFFICULTY] No restrictions - using self-reported level (${fitnessLevel}) for all patterns`);
  }
  
  console.log(`[DIFFICULTY] Movement pattern difficulties:`, {
    push: movementDifficulties.push,
    pull: movementDifficulties.pull,
    squat: movementDifficulties.squat,
    lunge: movementDifficulties.lunge,
    hinge: movementDifficulties.hinge,
    cardio: movementDifficulties.cardio,
  });

  const assessmentSummary = `
Fitness Test Results:
- Pushups: ${latestAssessment.pushups || "N/A"}
- Pullups: ${latestAssessment.pullups || "N/A"}
- Air Squats: ${latestAssessment.squats || "N/A"}
- Mile Run Time: ${latestAssessment.mileTime ? `${latestAssessment.mileTime} min` : "N/A"}
${latestAssessment.squat1rm ? `- Squat 1RM: ${latestAssessment.squat1rm} ${user.unitPreference === "imperial" ? "lbs" : "kg"}` : ""}
${latestAssessment.deadlift1rm ? `- Deadlift 1RM: ${latestAssessment.deadlift1rm} ${user.unitPreference === "imperial" ? "lbs" : "kg"}` : ""}
${latestAssessment.benchPress1rm ? `- Bench Press 1RM: ${latestAssessment.benchPress1rm} ${user.unitPreference === "imperial" ? "lbs" : "kg"}` : ""}
${latestAssessment.overheadPress1rm ? `- Overhead Press 1RM: ${latestAssessment.overheadPress1rm} ${user.unitPreference === "imperial" ? "lbs" : "kg"}` : ""}
${latestAssessment.barbellRow1rm ? `- Barbell Row 1RM: ${latestAssessment.barbellRow1rm} ${user.unitPreference === "imperial" ? "lbs" : "kg"}` : ""}
  `.trim();

  // Helper function to check if exercise difficulty is allowed for its movement pattern
  const isExerciseAllowed = (exercise: any): boolean => {
    const pattern = exercise.movementPattern?.toLowerCase() || '';
    const difficulty = exercise.difficulty;
    
    // Get allowed difficulties for this movement pattern
    const allowedForPattern = movementDifficulties[pattern] || movementDifficulties.core || getDefaultDifficulties(fitnessLevel);
    
    return allowedForPattern.includes(difficulty);
  };

  // Include both functional main exercises AND warmup exercises, filtered by movement-specific difficulty
  const functionalExercises = availableExercises
    .filter((ex) => 
      (ex.isFunctional || ex.exerciseType === "warmup") && 
      ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight") &&
      isExerciseAllowed(ex)
    )
    .slice(0, 80); // Increase to 80 to include warmups

  // Separate warmup exercises for explicit reference, filtered by movement-specific difficulty
  const warmupExercises = availableExercises
    .filter((ex) => 
      ex.exerciseType === "warmup" &&
      ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight") &&
      isExerciseAllowed(ex)
    )
    .slice(0, 30);

  // Separate cardio/HIIT exercises for HIIT workouts, filtered by cardio-specific difficulty
  const cardioExercises = availableExercises
    .filter((ex) => 
      ex.movementPattern === "cardio" &&
      ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight") &&
      isExerciseAllowed(ex)
    )
    .slice(0, 30);

  const exerciseList = functionalExercises
    .map((ex) => `- ${ex.name} (${ex.movementPattern}, ${ex.equipment?.join("/")})`)
    .join("\n");

  const warmupList = warmupExercises
    .map((ex) => `- ${ex.name} (${ex.movementPattern}, ${ex.equipment?.join("/")})`)
    .join("\n");

  const cardioList = cardioExercises
    .map((ex) => `- ${ex.name} (${ex.equipment?.join("/")})`)
    .join("\n");

  const daySchedules: { [key: number]: number[] } = {
    1: [1],             // Monday only
    2: [1, 4],          // Monday, Thursday
    3: [1, 3, 5],       // Monday, Wednesday, Friday
    4: [1, 2, 4, 5],    // Monday, Tuesday, Thursday, Friday
    5: [1, 2, 3, 4, 5], // Monday-Friday
    6: [1, 2, 3, 4, 5, 6], // Monday-Saturday
    7: [1, 2, 3, 4, 5, 6, 7], // Every day
  };

  const scheduledDays = user.selectedDays && user.selectedDays.length === daysPerWeek 
    ? user.selectedDays 
    : daySchedules[daysPerWeek] || daySchedules[3];
  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayScheduleText = scheduledDays.map(d => `Day ${d} (${dayNames[d]})`).join(', ');

  // Select the appropriate program template based on user's nutrition goal
  const selectedTemplate = selectProgramTemplate(user.nutritionGoal, latestAssessment.experienceLevel);
  console.log(`[TEMPLATE] Selected template: ${selectedTemplate.name} for nutrition goal: ${user.nutritionGoal}`);
  
  const templateInstructions = getTemplateInstructions(selectedTemplate);

  // Build difficulty summary for prompt
  const hasRestrictions = overrideReasons.length > 0;
  const difficultyNote = hasRestrictions 
    ? `\nNOTE: Some movement patterns have difficulty restrictions based on test results:\n${overrideReasons.map(r => `  - ${r}`).join('\n')}`
    : '';

  const prompt = `You are an expert strength and conditioning coach specializing in functional fitness and corrective exercises. Create a personalized workout program based on the following user profile:

**User Profile:**
- Fitness Level: ${fitnessLevel}
- Available Equipment: ${equipmentList}
- Workout Frequency: ${daysPerWeek} days per week
- Workout Duration: ${workoutDuration} minutes per session
- Nutrition Goal: ${user.nutritionGoal || "maintain"}
- Unit Preference: ${user.unitPreference}
- Scheduled Training Days: ${dayScheduleText}

${assessmentSummary}${difficultyNote}

**IMPORTANT - Movement Pattern-Specific Exercise Filtering:**
Exercises have been PRE-FILTERED based on the user's performance in each specific movement category:
- Push exercises: ${movementDifficulties.push.join(', ')} difficulty
- Pull exercises: ${movementDifficulties.pull.join(', ')} difficulty
- Squat exercises: ${movementDifficulties.squat.join(', ')} difficulty
- Lunge exercises: ${movementDifficulties.lunge.join(', ')} difficulty
- Hinge exercises: ${movementDifficulties.hinge.join(', ')} difficulty
- Cardio exercises: ${movementDifficulties.cardio.join(', ')} difficulty
- Core/Rotation/Carry: ${movementDifficulties.core.join(', ')} difficulty

This allows users to progress independently in different areas. DO NOT assign exercises beyond the provided difficulty for each pattern. Use ONLY exercises from the lists below.

**Main Exercise Database (prioritize functional movements):**
${exerciseList}

**Warmup Exercise Database:**
${warmupList}

**Cardio/HIIT Exercise Database:**
${cardioList}

${templateInstructions}

**Program Requirements:**
1. Create exactly ${daysPerWeek} workouts per week - this is CRITICAL
2. IMPORTANT: Use ONLY these specific dayOfWeek values: ${JSON.stringify(scheduledDays)}
   - dayOfWeek uses ISO 8601 format: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday
   - For ${daysPerWeek} days per week, schedule workouts on: ${dayScheduleText}
   - These days have been carefully selected to provide optimal recovery between sessions
3. STRICTLY follow the template's workout structure and exercise distribution
4. Focus heavily on FUNCTIONAL STRENGTH - exercises that mimic real-life movements
5. Include CORRECTIVE EXERCISES to address movement imbalances and prevent injury
6. Emphasize movement patterns from the template's distribution lists
7. Progressive overload strategy built-in
8. Appropriate for ${workoutDuration}-minute sessions
9. Match exercises to movement-pattern-specific difficulty levels - already filtered for safety per category
10. Use available equipment: ${equipmentList}

**WARMUP REQUIREMENTS (CRITICAL):**
- Each workout MUST include 2-3 dynamic warmup exercises at the beginning that specifically prepare for that day's movement patterns
- Different workouts need different warmups (lower body vs upper body vs full body)
- Warmup exercises should prime the nervous system and mobilize the joints used in the main workout
- Set isWarmup: true for all warmup exercises
- Warmup exercises typically use 2 sets with higher reps (10-15) and shorter rest (30 seconds)

**INTENSITY CONTROL:**
- For each main exercise (not warmups), specify targetRPE (1-10, where 10 is maximal effort) and targetRIR (0-5, reps left in reserve)
- RPE/RIR targets help users understand intended intensity
- Use the template's intensity guidelines as your baseline and adjust based on fitness level
- Template intensity targets: RPE ${selectedTemplate.intensityGuidelines.strengthRPE[0]}-${selectedTemplate.intensityGuidelines.strengthRPE[1]}, RIR ${selectedTemplate.intensityGuidelines.strengthRIR[0]}-${selectedTemplate.intensityGuidelines.strengthRIR[1]}
- Fine-tune based on experience:
  - Beginners: Lower end of template range
  - Intermediate: Middle of template range
  - Advanced: Upper end of template range

**SUPERSET GUIDELINES (OPTIONAL BUT ENCOURAGED):**
Supersets are an excellent way to increase workout efficiency and intensity. When appropriate, pair exercises together as supersets:

WHEN TO USE SUPERSETS:
- Intermediate/Advanced users (beginners should focus on form with single exercises)
- When workout duration is 45+ minutes (enough time for quality volume)
- For time efficiency and increased calorie burn

SMART SUPERSET PAIRINGS:
1. ANTAGONIST SUPERSETS (most common - allows one muscle to recover while training the other):
   - Push + Pull: Bench Press + Bent-Over Row, Shoulder Press + Lat Pulldown
   - Upper + Lower: Bench Press + Squats, Pull-ups + Lunges
   - Quad + Hamstring: Leg Extension + Leg Curl, Squat + Romanian Deadlift

2. AGONIST SUPERSETS (same muscle group - for advanced muscle fatigue):
   - Chest: Bench Press + Dumbbell Flyes
   - Back: Pull-ups + Cable Rows
   - Legs: Squats + Lunges

3. UPPER/LOWER SUPERSETS:
   - Upper body exercise + Lower body exercise allows full recovery between sets

SUPERSET IMPLEMENTATION:
- Label paired exercises with same supersetGroup: "A", "B", "C", etc.
- Use supersetOrder: 1 for first exercise, 2 for second exercise in the pair
- Both exercises in a superset should have the SAME number of sets
- Both exercises should have the SAME restSeconds value (rest applies AFTER completing both exercises)
- Never superset warmup exercises
- Typical superset rest: 90-120 seconds (after completing both exercises)
- Consider 2-3 supersets per workout for intermediate/advanced users

**WEIGHT AND REP RECOMMENDATIONS BASED ON FITNESS TEST:**
Use the fitness test results to provide specific weight/rep recommendations in the notes field:

For WEIGHT-BASED exercises (when 1RM data is available):
- HIGH REP exercises (12-15+ reps): Use 60-70% of 1RM
  Example: If Squat 1RM is 200 lbs, recommend 120-140 lbs for 12-15 rep sets
- MODERATE REP exercises (8-12 reps): Use 70-80% of 1RM
  Example: If Bench Press 1RM is 150 lbs, recommend 105-120 lbs for 8-12 rep sets
- LOW REP exercises (3-6 reps): Use 85-90% of 1RM
  Example: If Deadlift 1RM is 300 lbs, recommend 255-270 lbs for 3-6 rep sets

For WEIGHT-BASED exercises (when 1RM data is NOT available - using bodyweight test as proxy):
Based on pushup/pullup performance, estimate appropriate starting weights:

UPPER BODY PRESSING (Bench Press, Dumbbell Press, Overhead Press):
- Pushups < 15: Start light - 15-20 lbs dumbbells per hand (or 50-60 lbs barbell)
- Pushups 15-30: Start moderate - 20-30 lbs dumbbells per hand (or 75-95 lbs barbell)
- Pushups 30+: Start heavier - 30-40 lbs dumbbells per hand (or 95-135 lbs barbell)

UPPER BODY PULLING (Rows, Lat Pulldowns):
- Pullups < 5: Start light - 15-20 lbs dumbbells per hand (or 40-60 lbs)
- Pullups 5-10: Start moderate - 20-30 lbs dumbbells per hand (or 60-80 lbs)
- Pullups 10+: Start heavier - 30-40 lbs dumbbells per hand (or 80-100 lbs)

LOWER BODY (Squats, Deadlifts, Lunges):
- Air Squats < 25: Start light - 15-20 lbs dumbbells per hand (or 65-95 lbs barbell)
- Air Squats 25-50: Start moderate - 25-35 lbs dumbbells per hand (or 95-135 lbs barbell)
- Air Squats 50+: Start heavier - 35-50 lbs dumbbells per hand (or 135-185 lbs barbell)

For BODYWEIGHT exercises (when max rep data is available):
- HIGH REP exercises (12-15+ reps target): Aim for 50-60% of max reps
  Example: If max pushups is 40, recommend working sets of 20-24 reps
- MODERATE REP exercises (8-12 reps target): Aim for 60-75% of max reps
  Example: If max pushups is 15, recommend working sets of 9-11 reps
- LOW REP exercises (3-6 reps target): Aim for 75-85% of max reps
  Example: If max pullups is 8, recommend working sets of 6 reps, or use harder variations

**DURATION-BASED EXERCISES (ISOMETRIC/STATIC HOLDS):**
For exercises that are held for time (not reps), you MUST use durationSeconds instead of reps:
- ISOMETRIC HOLDS that require duration: Planks (all variants), Side Planks, Dead Hangs, L-Sits, Wall Sits, Hollow Body Holds, Glute Bridge Holds, Handstand Holds
- For these exercises:
  * Set "durationSeconds" to the recommended hold time
  * DO NOT include "repsMin" or "repsMax" fields (omit them entirely or set to null)
  * recommendedWeight should be null for bodyweight holds
- Duration recommendations based on fitness level:
  * Beginners: 20-30 seconds per set
  * Intermediate: 30-45 seconds per set  
  * Advanced: 45-60+ seconds per set
- Example: Plank → "durationSeconds": 30, no repsMin/repsMax fields

**REP-BASED EXERCISES (ALL OTHERS):**
For all other exercises (push-ups, squats, presses, rows, etc.):
- Set "repsMin" and "repsMax" for the target rep range
- DO NOT include "durationSeconds" field (omit entirely or set to null)
- Include recommendedWeight for weighted exercises
- Example: Push-ups → "repsMin": 12, "repsMax": 15, no durationSeconds field

**HIIT/CARDIO INTERVAL EXERCISES:**
For High-Intensity Interval Training (HIIT) exercises from the Cardio/HIIT Exercise Database:
- Set "workSeconds" for the work interval duration (e.g., 20, 30, 40 seconds)
- Set "restSeconds" for the rest interval duration (e.g., 10, 30, 60 seconds)
- DO NOT include "repsMin", "repsMax", "durationSeconds", or "recommendedWeight" fields
- Each "set" represents one complete work/rest cycle
- HIIT exercises should NOT be in supersets (they have their own timing structure)
- Common HIIT protocols:
  * Tabata: workSeconds: 20, restSeconds: 10, sets: 8 (4 minutes total)
  * Standard HIIT: workSeconds: 30, restSeconds: 30, sets: 10-12 (10-12 minutes total)
  * Sprint Intervals: workSeconds: 40, restSeconds: 20, sets: 8-10 (8-10 minutes total)
  * Longer Work: workSeconds: 60, restSeconds: 30, sets: 6-8 (9-12 minutes total)
- Example: Assault Bike Sprints → "workSeconds": 30, "restSeconds": 30, "sets": 10, no reps/weight/duration fields
- HIIT exercises can be used as:
  * Workout finishers (1-2 HIIT exercises at the end of strength workouts)
  * Standalone cardio days (multiple HIIT exercises for conditioning)
  * Active recovery days (lower intensity, longer rest periods)

IMPORTANT: 
1. ALWAYS include the numeric weight recommendation in the "recommendedWeight" field for ALL exercises that use weight (dumbbells, barbell, kettlebell, etc.). This should be a NUMBER, not text.
2. Even without 1RM data, use the bodyweight test proxy guidelines above to estimate appropriate starting weights.
3. Set recommendedWeight to null or 0 ONLY for bodyweight-only exercises (push-ups, pull-ups, air squats, etc.).
4. Still include helpful form cues and intensity notes in the "notes" field.
5. Use the user's unit preference (${user.unitPreference}) for all weight recommendations.
6. For dumbbell exercises, the recommendedWeight should be PER HAND (so if recommending 25 lbs dumbbells, the field should be 25, not 50).

**Response Format (JSON):**
{
  "programType": "functional strength program name",
  "weeklyStructure": "brief description of weekly schedule",
  "durationWeeks": 8,
  "workouts": [
    {
      "dayOfWeek": ${scheduledDays[0]},
      "workoutName": "Full Body Functional Day",
      "movementFocus": ["push", "pull", "hinge"],
      "exercises": [
        {
          "exerciseName": "Cat-Cow Stretch",
          "sets": 2,
          "repsMin": 10,
          "repsMax": 15,
          "restSeconds": 30,
          "isWarmup": true,
          "notes": "Focus on spinal mobility"
        },
        {
          "exerciseName": "Arm Circles",
          "sets": 2,
          "repsMin": 10,
          "repsMax": 15,
          "restSeconds": 30,
          "isWarmup": true,
          "notes": "Prepare shoulders for pressing"
        },
        {
          "exerciseName": "Goblet Squat",
          "sets": 3,
          "repsMin": 8,
          "repsMax": 12,
          "recommendedWeight": 140,
          "restSeconds": 90,
          "targetRPE": 7,
          "targetRIR": 3,
          "isWarmup": false,
          "notes": "70% of 1RM. Control the descent"
        },
        {
          "exerciseName": "Dumbbell Bench Press",
          "sets": 3,
          "repsMin": 8,
          "repsMax": 12,
          "recommendedWeight": 25,
          "restSeconds": 120,
          "targetRPE": 8,
          "targetRIR": 2,
          "isWarmup": false,
          "supersetGroup": "A",
          "supersetOrder": 1,
          "notes": "Based on pushup performance. Full range of motion, control the descent"
        },
        {
          "exerciseName": "Bent-Over Barbell Row",
          "sets": 3,
          "repsMin": 8,
          "repsMax": 12,
          "recommendedWeight": 95,
          "restSeconds": 120,
          "targetRPE": 8,
          "targetRIR": 2,
          "isWarmup": false,
          "supersetGroup": "A",
          "supersetOrder": 2,
          "notes": "Keep core tight, pull to lower chest. Rest 120 seconds after completing both exercises in superset"
        },
        {
          "exerciseName": "Push-ups",
          "sets": 3,
          "repsMin": 12,
          "repsMax": 15,
          "restSeconds": 60,
          "targetRPE": 7,
          "targetRIR": 3,
          "isWarmup": false,
          "notes": "50% of max. Maintain plank position"
        },
        {
          "exerciseName": "Plank",
          "sets": 3,
          "durationSeconds": 30,
          "restSeconds": 60,
          "targetRPE": 7,
          "targetRIR": 3,
          "isWarmup": false,
          "notes": "Hold stable plank position, focus on core engagement"
        },
        {
          "exerciseName": "Assault Bike Sprints",
          "sets": 8,
          "workSeconds": 20,
          "restSeconds": 10,
          "targetRPE": 9,
          "isWarmup": false,
          "notes": "Tabata protocol finisher - max effort during work intervals"
        }
      ]
    }
  ]
}

Create a complete program with exactly ${daysPerWeek} workouts for the week. Each workout MUST start with 2-3 warmup exercises. Ensure variety, balance, and functional movement emphasis across all ${daysPerWeek} training days.

CRITICAL: Your response MUST include exactly ${daysPerWeek} workouts with dayOfWeek values matching this exact list: ${JSON.stringify(scheduledDays)}
Example workout array structure:
${scheduledDays.map((day, idx) => `  Workout ${idx + 1}: { "dayOfWeek": ${day}, "workoutName": "...", ... }`).join('\n')}

Remember: dayOfWeek values MUST be ${JSON.stringify(scheduledDays)} - no other values are allowed.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert strength coach. Respond only with valid JSON matching the specified format.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const response = completion.choices[0].message.content;
  if (!response) {
    throw new Error("No response from OpenAI");
  }

  const program: GeneratedProgram = JSON.parse(response);
  return program;
}

export async function suggestExerciseSwap(
  currentExerciseName: string,
  targetMovementPattern: string,
  availableEquipment: string[],
  reason?: string
): Promise<string[]> {
  const equipmentList = availableEquipment.join(", ");

  const prompt = `As a strength coach, suggest 3 alternative exercises to replace "${currentExerciseName}".

Requirements:
- Movement pattern: ${targetMovementPattern}
- Available equipment: ${equipmentList}
- ${reason || "General swap for variety"}
- Focus on functional movements
- List exercises from most to least similar

Respond with JSON object: { "suggestions": ["exercise1", "exercise2", "exercise3"] }`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a strength coach. Respond only with a JSON object containing a 'suggestions' array of exercise names.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.6,
  });

  const response = completion.choices[0].message.content;
  if (!response) {
    throw new Error("No response from OpenAI");
  }

  const result = JSON.parse(response);
  return result.suggestions || [];
}

export async function generateProgressionRecommendation(
  exerciseName: string,
  recentPerformance: {
    weight: number;
    reps: number;
    rir: number;
  }[]
): Promise<{
  recommendation: string;
  suggestedWeight?: number;
  suggestedReps?: number;
  reasoning: string;
}> {
  const performanceSummary = recentPerformance
    .map((p, i) => `Set ${i + 1}: ${p.weight} x ${p.reps} @ RIR ${p.rir}`)
    .join("\n");

  const prompt = `As a strength coach, analyze this performance data and recommend progression:

Exercise: ${exerciseName}
Recent Performance:
${performanceSummary}

Provide progression recommendation considering:
1. RIR values (RIR > 2 suggests readiness for increase)
2. Progressive overload principles
3. Safe, sustainable progression

Respond with JSON:
{
  "recommendation": "increase weight/reps/both/deload/maintain",
  "suggestedWeight": number or null,
  "suggestedReps": number or null,
  "reasoning": "brief explanation"
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a strength coach. Respond only with valid JSON.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.5,
  });

  const response = completion.choices[0].message.content;
  if (!response) {
    throw new Error("No response from OpenAI");
  }

  return JSON.parse(response);
}
