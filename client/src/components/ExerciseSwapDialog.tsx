import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatExerciseName } from "@/lib/utils";
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
  const { data: suggestions = [], isLoading } = useQuery<Array<Exercise & { selectedEquipment?: string }>>({
    queryKey: ["/api/exercises/similar", exercise.exercise.id, exercise.equipment],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/exercises/similar", {
        exerciseId: exercise.exercise.id,
        movementPattern: exercise.exercise.movementPattern,
        primaryMuscles: exercise.exercise.primaryMuscles,
        currentEquipment: exercise.equipment,
      });
      return await response.json();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Swap Exercise: {formatExerciseName(exercise.exercise.name, exercise.equipment)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Similar exercises and equipment variants
          </p>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No alternative exercises or equipment variants found.</p>
            </div>
          ) : (
            suggestions.map((suggestion, idx) => (
              <div
                key={`${suggestion.id}-${suggestion.selectedEquipment || idx}`}
                className="border rounded-lg p-4 hover-elevate"
                data-testid={`swap-option-${suggestion.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold mb-1">{formatExerciseName(suggestion.name, suggestion.selectedEquipment)}</h3>
                    <div className="flex gap-2 flex-wrap mt-2">
                      {suggestion.primaryMuscles?.map((muscle: string, idx: number) => (
                        <Badge key={`${muscle}-${idx}`} variant="outline" className="text-xs">{muscle}</Badge>
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
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
