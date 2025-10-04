import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import type { ProgramExercise, Exercise } from "@shared/schema";

interface ExerciseSwapDialogProps {
  exercise: ProgramExercise & { exercise: Exercise };
  onSwap: (newExercise: Exercise) => void;
  onClose: () => void;
}

export default function ExerciseSwapDialog({
  exercise,
  onSwap,
  onClose,
}: ExerciseSwapDialogProps) {
  const unitPreference = localStorage.getItem('unitPreference') || 'imperial';
  const weightUnit = unitPreference === 'imperial' ? 'lbs' : 'kg';
  
  //todo: remove mock functionality
  const suggestions: Exercise[] = [
    {
      id: "alt1",
      name: "Alternative Exercise 1",
      description: "Similar movement pattern",
      movementPattern: exercise.exercise.movementPattern,
      equipment: exercise.exercise.equipment || [],
      difficulty: exercise.exercise.difficulty,
      primaryMuscles: exercise.exercise.primaryMuscles,
      secondaryMuscles: exercise.exercise.secondaryMuscles || null,
      isFunctional: exercise.exercise.isFunctional,
      isCorrective: 0,
      exerciseType: exercise.exercise.exerciseType,
      videoUrl: null,
      formTips: null,
    },
    {
      id: "alt2",
      name: "Alternative Exercise 2",
      description: "Bodyweight alternative",
      movementPattern: exercise.exercise.movementPattern,
      equipment: ["bodyweight"],
      difficulty: exercise.exercise.difficulty,
      primaryMuscles: exercise.exercise.primaryMuscles,
      secondaryMuscles: exercise.exercise.secondaryMuscles || null,
      isFunctional: exercise.exercise.isFunctional,
      isCorrective: 0,
      exerciseType: exercise.exercise.exerciseType,
      videoUrl: null,
      formTips: null,
    },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Swap Exercise: {exercise.exercise.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            AI-powered recommendations for similar exercises
          </p>

          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="border rounded-lg p-4 hover-elevate"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold mb-1">{suggestion.name}</h3>
                  <div className="flex gap-2 flex-wrap">
                    {suggestion.equipment?.map((eq, idx) => (
                      <Badge key={idx} variant="secondary">{eq}</Badge>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={() => onSwap(suggestion)}
                  data-testid={`button-select-${suggestion.id}`}
                >
                  Select
                </Button>
              </div>
              {suggestion.description && (
                <p className="text-sm text-muted-foreground">{suggestion.description}</p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
