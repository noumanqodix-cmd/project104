import OpenAI from "openai";
import type { InsertExercise } from "@shared/schema";

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
  liftType: "compound" | "isolation";
  isCorrective: number;
  formTips: string[];
  trackingType?: "reps" | "duration" | "both";
}

export async function generateExercisesForEquipment(
  equipment: string
): Promise<InsertExercise[]> {
  const prompt = `You are an expert strength and conditioning coach. Generate 10-15 diverse exercises specifically for ${equipment}.

**Requirements:**
1. Include exercises from ALL three types:
   - Warmup exercises (mobility, activation, dynamic stretching)
   - Main exercises (strength, power, skill work, isolation)
   - Cooldown exercises (static stretching, mobility)

2. Cover multiple movement patterns:
   - Push (horizontal/vertical pressing)
   - Pull (horizontal/vertical pulling)
   - Hinge (hip dominant movements)
   - Squat (knee dominant movements)
   - Carry (loaded carries)
   - Rotation (anti-rotation, rotational power)
   - Core (planks, anti-extension, stability)
   - Hang (dead hangs, hanging variations)
   - Lunge (split stance movements)
   - Cardio (conditioning, endurance)
   - Plyometric (jumping, explosive movements)
   - Crawl (ground-based locomotion)

3. Include all difficulty levels:
   - Beginner (foundational movements)
   - Intermediate (moderate complexity)
   - Advanced (high skill/strength requirements)

4. Include BOTH functional compound movements AND isolation exercises:
   - Compound/Functional: Multi-joint exercises (Squats, Deadlifts, Rows, Presses)
   - Isolation: Single-joint exercises (Bicep Curls, Tricep Extensions, Lateral Raises, Leg Curls, Calf Raises, Chest Flyes)
5. Include corrective exercises where appropriate (exercises that address common movement dysfunctions)
6. Provide specific, actionable form tips for each exercise

**Response Format (JSON):**
{
  "exercises": [
    {
      "name": "Exercise Name",
      "description": "Clear description of the exercise and its benefits",
      "movementPattern": "push|pull|hinge|squat|carry|rotation|core|hang|lunge|cardio|plyometric|crawl",
      "equipment": ["${equipment}"],
      "difficulty": "beginner|intermediate|advanced",
      "primaryMuscles": ["broad muscle group(s)"],
      "secondaryMuscles": ["specific anatomical muscles"],
      "exerciseType": "warmup|main|cooldown",
      "liftType": "compound",
      "isCorrective": 0,
      "trackingType": "reps|duration|both",
      "formTips": [
        "Specific cue 1",
        "Specific cue 2",
        "Specific cue 3"
      ]
    }
  ]
}

**Muscle Group Guidelines:**
- primaryMuscles: Use ONLY broad groups: "chest", "shoulders", "back", "core", "legs", "arms", "grip", "cardio", "full body"
- secondaryMuscles: Use specific anatomical names like "pectorals", "anterior deltoid", "latissimus dorsi", "rectus abdominis", "quadriceps", etc.

**Tracking Type Guidelines:**
- "reps": Strength exercises tracked by repetitions (push-ups, squats, rows)
- "duration": Time-based exercises (planks, dead hangs, stretches, cardio)
- "both": Can be tracked either way (carries, some cardio)

**Important:**
- liftType: "compound" for multi-joint exercises, "isolation" for single-joint exercises
- isCorrective: 1 for corrective exercises, 0 for regular exercises
- MUST include BOTH compound (liftType: "compound") AND isolation exercises (liftType: "isolation")
- **ISOLATION EXERCISES (liftType: "isolation") must ONLY be generated as "intermediate" or "advanced" difficulty, NEVER "beginner"**
- Compound exercises can be any difficulty level (beginner, intermediate, advanced)
- Essential compound exercises to include when applicable: Barbell Back Squat, Barbell Bench Press, Barbell Deadlift, Lat Pulldown, Bent-Over Row
- Essential isolation exercises to include when applicable: Bicep Curls, Tricep Extensions, Lateral Raises, Chest Flyes, Leg Curls, Calf Raises
- Ensure variety in movement patterns and difficulty levels
- Make exercise names clear and specific
- Form tips should be practical coaching cues`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
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
    liftType: ex.liftType,
    isCorrective: ex.isCorrective,
    exerciseType: ex.exerciseType,
    formTips: ex.formTips,
    videoUrl: null,
    trackingType: ex.trackingType || "reps",
  }));
}

export async function generateComprehensiveExerciseLibrary(
  equipmentList: string[]
): Promise<InsertExercise[]> {
  const allExercises: InsertExercise[] = [];

  for (const equipment of equipmentList) {
    const exercises = await generateExercisesForEquipment(equipment);
    allExercises.push(...exercises);
  }

  const uniqueExercises = Array.from(
    new Map(allExercises.map((ex) => [ex.name, ex])).values()
  );

  return uniqueExercises;
}

export async function generateMasterExerciseDatabase(): Promise<InsertExercise[]> {
  console.log("🚀 Starting master exercise database generation...");
  
  const equipmentTypes = [
    "bodyweight",
    "dumbbells",
    "barbell",
    "kettlebell",
    "resistance bands",
    "cable machine",
    "pull-up bar",
    "trx",
    "medicine ball",
    "box",
    "jump rope"
  ];

  const allExercises: InsertExercise[] = [];
  let totalGenerated = 0;

  for (const equipment of equipmentTypes) {
    try {
      console.log(`  Generating exercises for: ${equipment}...`);
      const exercises = await generateExercisesForEquipment(equipment);
      allExercises.push(...exercises);
      totalGenerated += exercises.length;
      console.log(`    ✓ Generated ${exercises.length} exercises for ${equipment}`);
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`    ✗ Failed to generate exercises for ${equipment}:`, error);
    }
  }

  // Deduplicate by name
  const uniqueExercises = Array.from(
    new Map(allExercises.map((ex) => [ex.name.toLowerCase(), ex])).values()
  );

  console.log(`\n✅ Master database generation complete:`);
  console.log(`   Total generated: ${totalGenerated} exercises`);
  console.log(`   Unique exercises: ${uniqueExercises.length}`);
  
  return uniqueExercises;
}
