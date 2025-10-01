import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Repeat } from "lucide-react";
import ExerciseSwapDialog from "@/components/ExerciseSwapDialog";

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

interface WorkoutProgramViewProps {
  onBack: () => void;
  onSave: (exercises: Exercise[]) => void;
}

export default function WorkoutProgramView({ onBack, onSave }: WorkoutProgramViewProps) {
  //todo: remove mock functionality
  const [exercises, setExercises] = useState<Exercise[]>([
    {
      id: "1",
      name: "Barbell Bench Press",
      equipment: "barbell",
      sets: 4,
      reps: "8-10",
      weight: "135 lbs",
      tempo: "1-2-1-1",
      formVideoUrl: "#",
    },
    {
      id: "2",
      name: "Dumbbell Shoulder Press",
      equipment: "dumbbells",
      sets: 3,
      reps: "10-12",
      weight: "30 lbs",
      tempo: "1-1-1-1",
      formVideoUrl: "#",
    },
    {
      id: "3",
      name: "Cable Tricep Pushdown",
      equipment: "cable",
      sets: 3,
      reps: "12-15",
      weight: "60 lbs",
      tempo: "1-2-1-0",
      formVideoUrl: "#",
    },
  ]);

  const [swapExercise, setSwapExercise] = useState<Exercise | null>(null);

  const handleSwap = (oldExercise: Exercise, newExercise: Exercise) => {
    setExercises(prev =>
      prev.map(ex => ex.id === oldExercise.id ? { ...newExercise, id: oldExercise.id } : ex)
    );
    setSwapExercise(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Upper Body Power</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-4">
        {exercises.map((exercise) => (
          <Card key={exercise.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold mb-2">{exercise.name}</h3>
                <Badge variant="secondary">{exercise.equipment}</Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSwapExercise(exercise)}
                data-testid={`button-swap-${exercise.id}`}
              >
                <Repeat className="h-4 w-4 mr-2" />
                Swap
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Sets</p>
                <p className="text-lg font-semibold">{exercise.sets}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reps</p>
                <p className="text-lg font-semibold">{exercise.reps}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Weight</p>
                <p className="text-lg font-semibold">{exercise.weight}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo</p>
                <p className="text-lg font-mono">{exercise.tempo}</p>
              </div>
            </div>

            <Button variant="ghost" size="sm" data-testid={`button-form-${exercise.id}`}>
              <Play className="h-4 w-4 mr-2" />
              Watch Form Video
            </Button>
          </Card>
        ))}

        <Button
          size="lg"
          className="w-full"
          onClick={() => onSave(exercises)}
          data-testid="button-save-program"
        >
          Save Changes
        </Button>
      </main>

      {swapExercise && (
        <ExerciseSwapDialog
          exercise={swapExercise}
          onSwap={(newEx) => handleSwap(swapExercise, newEx)}
          onClose={() => setSwapExercise(null)}
        />
      )}
    </div>
  );
}
