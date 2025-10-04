import OpenAI from "openai";
import type { Exercise } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface GeneratedExerciseData {
  name: string;
  description: string;
  movementPattern: string;
  equipment: string[];
  difficulty: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  exerciseType: "warmup" | "main" | "cooldown";
  isFunctional: number;
  isCorrective: number;
  formTips: string[];
}

export async function generateExercisesForEquipment(
  equipment: string
): Promise<Omit<Exercise, "id" | "videoUrl">[]> {
  const prompt = `You are an expert strength and conditioning coach specializing in functional fitness. Generate 10-15 diverse exercises specifically for ${equipment}.

**Requirements:**
1. Include exercises from ALL three types:
   - Warmup exercises (mobility, activation, dynamic stretching)
   - Main exercises (strength, power, skill work)
   - Cooldown exercises (static stretching, mobility)

2. Cover multiple movement patterns:
   - Push (horizontal/vertical)
   - Pull (horizontal/vertical)
   - Hinge (hip dominant)
   - Squat (knee dominant)
   - Carry (loaded carries)
   - Rotation (anti-rotation, rotational power)

3. Include all difficulty levels:
   - Beginner (foundational movements)
   - Intermediate (moderate complexity)
   - Advanced (high skill/strength requirements)

4. Focus on FUNCTIONAL movements that translate to real-life activities
5. Include corrective exercises where appropriate (exercises that address common movement dysfunctions)
6. Provide specific, actionable form tips for each exercise

**Response Format (JSON):**
{
  "exercises": [
    {
      "name": "Exercise Name",
      "description": "Clear description of the exercise and its benefits",
      "movementPattern": "push|pull|hinge|squat|carry|rotation",
      "equipment": ["${equipment}"],
      "difficulty": "beginner|intermediate|advanced",
      "primaryMuscles": ["muscle1", "muscle2"],
      "secondaryMuscles": ["muscle3", "muscle4"],
      "exerciseType": "warmup|main|cooldown",
      "isFunctional": 1,
      "isCorrective": 0,
      "formTips": [
        "Specific cue 1",
        "Specific cue 2",
        "Specific cue 3"
      ]
    }
  ]
}

**Important:**
- isFunctional: 1 for functional exercises, 0 for isolation
- isCorrective: 1 for corrective exercises, 0 for regular exercises
- Ensure variety in movement patterns and difficulty levels
- Make exercise names clear and specific
- Form tips should be practical coaching cues`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are an expert strength and conditioning coach. Respond only with valid JSON matching the specified format.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
  });

  const response = completion.choices[0].message.content;
  if (!response) {
    throw new Error("No response from OpenAI");
  }

  const result: { exercises: GeneratedExerciseData[] } = JSON.parse(response);
  
  return result.exercises.map((ex) => ({
    name: ex.name,
    description: ex.description,
    movementPattern: ex.movementPattern,
    equipment: ex.equipment,
    difficulty: ex.difficulty,
    primaryMuscles: ex.primaryMuscles,
    secondaryMuscles: ex.secondaryMuscles,
    isFunctional: ex.isFunctional,
    isCorrective: ex.isCorrective,
    exerciseType: ex.exerciseType,
    formTips: ex.formTips,
    videoUrl: null,
  }));
}

export async function generateComprehensiveExerciseLibrary(
  equipmentList: string[]
): Promise<Omit<Exercise, "id" | "videoUrl">[]> {
  const allExercises: Omit<Exercise, "id" | "videoUrl">[] = [];

  for (const equipment of equipmentList) {
    const exercises = await generateExercisesForEquipment(equipment);
    allExercises.push(...exercises);
  }

  const uniqueExercises = Array.from(
    new Map(allExercises.map((ex) => [ex.name, ex])).values()
  );

  return uniqueExercises;
}
