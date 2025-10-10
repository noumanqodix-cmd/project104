export type ProgramTemplate = {
  id: string;
  name: string;
  description: string;
  selectionCriteria: {
    nutritionGoals: string[];
    experienceLevels?: string[];
  };
  structure: {
    strengthFocus: number; // Percentage 0-100
    cardioFocus: number; // Percentage 0-100
    movementPatternDistribution: {
      strength: string[]; // Movement patterns for strength work
      cardio: string[]; // Movement patterns for cardio work
    };
    cardioPlacement: 'finisher' | 'dedicated_days' | 'mixed';
    workoutStructure: {
      warmupExercises: number;
      mainStrengthExercises: number;
      cardioExercises: number;
      cooldownExercises?: number;
    };
  };
  intensityGuidelines: {
    strengthRPE: [number, number]; // Min, Max RPE
    strengthRIR: [number, number]; // Min, Max RIR
    cardioIntensity: 'low' | 'moderate' | 'high' | 'varied';
  };
};

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: 'strength-primary',
    name: 'Strength Primary',
    description: 'Heavy compound lifts with progressive overload. Cardio included as finisher or optional.',
    selectionCriteria: {
      nutritionGoals: ['bulk', 'gain', 'muscle', 'strength', 'mass', 'build', 'grow', 'hypertrophy'],
      experienceLevels: ['beginner', 'intermediate', 'advanced'],
    },
    structure: {
      strengthFocus: 80,
      cardioFocus: 20,
      movementPatternDistribution: {
        strength: ['push', 'pull', 'hinge', 'squat', 'lunge', 'carry', 'core'],
        cardio: ['cardio', 'plyometric'],
      },
      cardioPlacement: 'finisher',
      workoutStructure: {
        warmupExercises: 2,
        mainStrengthExercises: 5, // More strength exercises
        cardioExercises: 1, // Minimal cardio as finisher
      },
    },
    intensityGuidelines: {
      strengthRPE: [7, 9],
      strengthRIR: [1, 3],
      cardioIntensity: 'moderate',
    },
  },
  {
    id: 'cardio-primary',
    name: 'Cardio Primary',
    description: 'Conditioning and cardiovascular fitness focus. Strength work for maintenance and injury prevention.',
    selectionCriteria: {
      nutritionGoals: ['lose', 'loss', 'weight', 'fat', 'cut', 'shred', 'lean', 'endurance', 'cardio', 'conditioning'],
    },
    structure: {
      strengthFocus: 30,
      cardioFocus: 70,
      movementPatternDistribution: {
        strength: ['push', 'pull', 'squat', 'core'], // Essential movements only
        cardio: ['cardio', 'plyometric'],
      },
      cardioPlacement: 'dedicated_days',
      workoutStructure: {
        warmupExercises: 2,
        mainStrengthExercises: 3, // Reduced strength work
        cardioExercises: 3, // More cardio exercises
      },
    },
    intensityGuidelines: {
      strengthRPE: [6, 8],
      strengthRIR: [2, 4],
      cardioIntensity: 'high',
    },
  },
  {
    id: 'hybrid-balance',
    name: 'Hybrid Balance',
    description: 'Strength-focused training with cardio finishers. Ideal for maintaining fitness and general health.',
    selectionCriteria: {
      nutritionGoals: ['maintain', 'fitness', 'athletic', 'performance', 'recomp', 'toned', 'general', 'balanced', 'healthy'],
    },
    structure: {
      strengthFocus: 70,
      cardioFocus: 30,
      movementPatternDistribution: {
        strength: ['push', 'pull', 'hinge', 'squat', 'lunge', 'carry', 'core', 'rotation'],
        cardio: ['cardio', 'plyometric'],
      },
      cardioPlacement: 'finisher',
      workoutStructure: {
        warmupExercises: 2,
        mainStrengthExercises: 5,
        cardioExercises: 1, // Cardio as finisher
      },
    },
    intensityGuidelines: {
      strengthRPE: [7, 8],
      strengthRIR: [2, 3],
      cardioIntensity: 'moderate',
    },
  },
];

/**
 * Select the best program template based on user's nutrition goal and fitness level
 * 
 * Priority-based selection:
 * 1. Check for primary action keywords (gain/build vs lose/cut)
 * 2. Fall back to hybrid for maintain/general fitness goals
 */
export function selectProgramTemplate(
  nutritionGoal: string | null | undefined,
  experienceLevel: string | null | undefined
): ProgramTemplate {
  const normalizedGoal = (nutritionGoal?.toLowerCase() || 'maintain').trim();

  // Priority 1: Strength-building goals (highest priority action words)
  const strengthKeywords = ['gain', 'build', 'bulk', 'grow', 'hypertrophy', 'muscle', 'strength', 'mass'];
  if (strengthKeywords.some(kw => normalizedGoal.includes(kw))) {
    return PROGRAM_TEMPLATES.find(t => t.id === 'strength-primary')!;
  }

  // Priority 2: Weight loss / cutting goals (second highest priority)
  // Use specific loss-oriented terms only
  const cardioKeywords = ['lose', 'loss', 'cut', 'shred', 'fat loss', 'weight loss', 'drop'];
  if (cardioKeywords.some(kw => normalizedGoal.includes(kw))) {
    return PROGRAM_TEMPLATES.find(t => t.id === 'cardio-primary')!;
  }

  // Priority 3: Endurance-focused (cardio template)
  const enduranceKeywords = ['endurance', 'cardio', 'conditioning', 'run', 'marathon', 'stamina'];
  if (enduranceKeywords.some(kw => normalizedGoal.includes(kw))) {
    return PROGRAM_TEMPLATES.find(t => t.id === 'cardio-primary')!;
  }

  // Default: Hybrid balance for maintain, recomp, general fitness, or unclear goals
  return PROGRAM_TEMPLATES.find(t => t.id === 'hybrid-balance')!;
}

/**
 * Get template-specific instructions for AI prompt
 */
export function getTemplateInstructions(template: ProgramTemplate): string {
  const cardioPlacementText = {
    'finisher': 'Include 1 cardio exercise at the END of each workout as a finisher (5-10 minutes)',
    'dedicated_days': 'Create dedicated cardio-focused days with 2-3 HIIT or conditioning exercises. Strength days have minimal or no cardio.',
    'mixed': 'Mix cardio throughout the week - some days focus more on strength, others on cardio, some are balanced',
  };

  return `
**TEMPLATE: ${template.name}**
Focus: ${template.description}

**Exercise Distribution:**
- Strength Focus: ${template.structure.strengthFocus}%
- Cardio Focus: ${template.structure.cardioFocus}%

**Workout Structure (per session):**
- ${template.structure.workoutStructure.warmupExercises} warmup exercises (dynamic, movement-specific)
- ${template.structure.workoutStructure.mainStrengthExercises} main strength exercises (from: ${template.structure.movementPatternDistribution.strength.join(', ')})
- ${template.structure.workoutStructure.cardioExercises} cardio exercises (from: ${template.structure.movementPatternDistribution.cardio.join(', ')})

**Cardio Placement Strategy:**
${cardioPlacementText[template.structure.cardioPlacement]}

**Intensity Targets:**
- Strength Work: RPE ${template.intensityGuidelines.strengthRPE[0]}-${template.intensityGuidelines.strengthRPE[1]}, RIR ${template.intensityGuidelines.strengthRIR[0]}-${template.intensityGuidelines.strengthRIR[1]}
- Cardio Work: ${template.intensityGuidelines.cardioIntensity} intensity

**Critical Requirements:**
1. STRICTLY follow the exercise counts specified above for each workout
2. Prioritize movement patterns from the template's distribution lists
3. Ensure cardio placement matches the strategy (finisher/dedicated/mixed)
4. Maintain the ${template.structure.strengthFocus}/${template.structure.cardioFocus} strength/cardio ratio across the week
`;
}
