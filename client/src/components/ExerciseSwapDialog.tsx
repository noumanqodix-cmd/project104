import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface Exercise {
  id: string;
  name: string;
  equipment: string;
  sets: number;
  reps: string;
  weight: string;
  tempo: string;
  formVideoUrl: string;
}

interface ExerciseSwapDialogProps {
  exercise: Exercise;
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
  const suggestions = [
    {
      id: "alt1",
      name: "Dumbbell Bench Press",
      equipment: "dumbbells",
      sets: exercise.sets,
      reps: exercise.reps,
      weight: `50 ${weightUnit}`,
      tempo: exercise.tempo,
      formVideoUrl: "#",
      reason: "Same muscle groups, uses dumbbells",
    },
    {
      id: "alt2",
      name: "Push-ups",
      equipment: "bodyweight",
      sets: exercise.sets,
      reps: "12-15",
      weight: "bodyweight",
      tempo: exercise.tempo,
      formVideoUrl: "#",
      reason: "No equipment needed",
    },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Swap Exercise: {exercise.name}
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
                  <Badge variant="secondary">{suggestion.equipment}</Badge>
                </div>
                <Button
                  onClick={() => onSwap(suggestion)}
                  data-testid={`button-select-${suggestion.id}`}
                >
                  Select
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
