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
  notes?: string;
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

  const functionalExercises = availableExercises
    .filter((ex) => 
      ex.isFunctional && 
      ex.equipment?.some((eq) => user.equipment?.includes(eq) || eq === "bodyweight")
    )
    .slice(0, 50);

  const exerciseList = functionalExercises
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

**Exercise Database (prioritize functional movements):**
${exerciseList}

**Program Requirements:**
1. Focus heavily on FUNCTIONAL STRENGTH - exercises that mimic real-life movements
2. Include CORRECTIVE EXERCISES to address movement imbalances and prevent injury
3. Emphasize movement patterns: PUSH, PULL, HINGE, SQUAT, CARRY, ROTATION
4. Progressive overload strategy built-in
5. Appropriate for ${workoutDuration}-minute sessions
6. Match the user's current fitness level based on assessment results
7. Use available equipment: ${equipmentList}

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
          "exerciseName": "exact name from exercise list",
          "sets": 3,
          "repsMin": 8,
          "repsMax": 12,
          "restSeconds": 90,
          "notes": "Focus on controlled movement"
        }
      ]
    }
  ]
}

Create a complete program with 3-5 workout days per week. Ensure variety, balance, and functional movement emphasis.`;

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
