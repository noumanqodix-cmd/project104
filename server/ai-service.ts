import OpenAI from "openai";
import type { User, FitnessAssessment, Exercise } from "@shared/schema";

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
  durationSeconds?: number;
  restSeconds: number;
  targetRPE?: number;  // Rate of Perceived Exertion (1-10)
  targetRIR?: number;  // Reps in Reserve (0-5)
  notes?: string;
  isWarmup?: boolean;  // Flag to identify warmup exercises
}

export async function generateWorkoutProgram(
  input: ProgramGenerationInput
): Promise<GeneratedProgram> {
  const { user, latestAssessment, availableExercises } = input;

  const equipmentList = user.equipment?.join(", ") || "bodyweight only";
  const workoutDuration = user.workoutDuration || 60;
  const fitnessLevel = latestAssessment.experienceLevel || user.fitnessLevel || "beginner";

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

  // Include both functional main exercises AND warmup exercises
  const functionalExercises = availableExercises
    .filter((ex) => 
      (ex.isFunctional || ex.exerciseType === "warmup") && 
      ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight")
    )
    .slice(0, 80); // Increase to 80 to include warmups

  // Separate warmup exercises for explicit reference
  const warmupExercises = availableExercises
    .filter((ex) => 
      ex.exerciseType === "warmup" &&
      ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight")
    )
    .slice(0, 30);

  const exerciseList = functionalExercises
    .map((ex) => `- ${ex.name} (${ex.movementPattern}, ${ex.equipment?.join("/")})`)
    .join("\n");

  const warmupList = warmupExercises
    .map((ex) => `- ${ex.name} (${ex.movementPattern}, ${ex.equipment?.join("/")})`)
    .join("\n");

  const prompt = `You are an expert strength and conditioning coach specializing in functional fitness and corrective exercises. Create a personalized workout program based on the following user profile:

**User Profile:**
- Fitness Level: ${fitnessLevel}
- Available Equipment: ${equipmentList}
- Workout Duration: ${workoutDuration} minutes per session
- Nutrition Goal: ${user.nutritionGoal || "maintain"}
- Unit Preference: ${user.unitPreference}

${assessmentSummary}

**Main Exercise Database (prioritize functional movements):**
${exerciseList}

**Warmup Exercise Database:**
${warmupList}

**Program Requirements:**
1. Focus heavily on FUNCTIONAL STRENGTH - exercises that mimic real-life movements
2. Include CORRECTIVE EXERCISES to address movement imbalances and prevent injury
3. Emphasize movement patterns: PUSH, PULL, HINGE, SQUAT, CARRY, ROTATION
4. Progressive overload strategy built-in
5. Appropriate for ${workoutDuration}-minute sessions
6. Match the user's current fitness level based on assessment results
7. Use available equipment: ${equipmentList}

**WARMUP REQUIREMENTS (CRITICAL):**
- Each workout MUST include 2-3 dynamic warmup exercises at the beginning that specifically prepare for that day's movement patterns
- Different workouts need different warmups (lower body vs upper body vs full body)
- Warmup exercises should prime the nervous system and mobilize the joints used in the main workout
- Set isWarmup: true for all warmup exercises
- Warmup exercises typically use 2 sets with higher reps (10-15) and shorter rest (30 seconds)

**INTENSITY CONTROL:**
- For each main exercise (not warmups), specify targetRPE (1-10, where 10 is maximal effort) and targetRIR (0-5, reps left in reserve)
- RPE/RIR targets help users understand intended intensity
- You have full control over sets, reps, rest periods, and intensity targets
- Beginners: RPE 6-7, RIR 3-4
- Intermediate: RPE 7-8, RIR 2-3
- Advanced: RPE 8-9, RIR 1-2

**Response Format (JSON):**
{
  "programType": "functional strength program name",
  "weeklyStructure": "brief description of weekly schedule",
  "durationWeeks": 8,
  "workouts": [
    {
      "dayOfWeek": 1,
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
          "restSeconds": 90,
          "targetRPE": 7,
          "targetRIR": 3,
          "isWarmup": false,
          "notes": "Control the descent"
        },
        {
          "exerciseName": "Dumbbell Bench Press",
          "sets": 3,
          "repsMin": 8,
          "repsMax": 12,
          "restSeconds": 120,
          "targetRPE": 8,
          "targetRIR": 2,
          "isWarmup": false,
          "notes": "Full range of motion"
        }
      ]
    }
  ]
}

Create a complete program with 3-5 workout days per week. Each workout MUST start with 2-3 warmup exercises. Ensure variety, balance, and functional movement emphasis.`;

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
