import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Play, Repeat, ChevronLeft, ChevronRight } from "lucide-react";
import ExerciseSwapDialog from "@/components/ExerciseSwapDialog";
import { formatExerciseName } from "@/lib/utils";
import type { WorkoutProgram, ProgramWorkout, ProgramExercise, Exercise } from "@shared/schema";

interface WorkoutWithExercises extends ProgramWorkout {
  exercises: (ProgramExercise & { exercise: Exercise })[];
}

interface ProgramWithWorkouts extends WorkoutProgram {
  workouts: WorkoutWithExercises[];
}

interface WorkoutProgramViewProps {
  onBack: () => void;
  onSave?: () => void;
}

export default function WorkoutProgramView({ onBack, onSave }: WorkoutProgramViewProps) {
  const [currentWorkoutIndex, setCurrentWorkoutIndex] = useState(0);
  const [swapExercise, setSwapExercise] = useState<ProgramExercise & { exercise: Exercise } | null>(null);
  const { toast } = useToast();

  // Fetch active program
  const { data: activeProgram, isLoading: isLoadingActive } = useQuery<WorkoutProgram>({
    queryKey: ['/api/programs/active'],
  });

  // Fetch full program details with workouts and exercises
  const { data: fullProgram, isLoading: isLoadingFull } = useQuery<ProgramWithWorkouts>({
    queryKey: ['/api/programs', activeProgram?.id],
    enabled: !!activeProgram?.id,
  });

  const swapExerciseMutation = useMutation({
    mutationFn: async ({ programExerciseId, newExerciseId, equipment }: { programExerciseId: string; newExerciseId: string; equipment?: string }) => {
      return await apiRequest("PATCH", `/api/programs/exercises/${programExerciseId}/swap`, {
        newExerciseId,
        equipment,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/programs', activeProgram?.id] });
      toast({
        title: "Exercise Swapped",
        description: "Your workout has been updated with the new exercise.",
      });
    },
    onError: () => {
      toast({
        title: "Swap Failed",
        description: "Failed to swap exercise. Please try again.",
        variant: "destructive",
      });
    },
  });

  const isLoading = isLoadingActive || isLoadingFull;
  const currentWorkout = fullProgram?.workouts[currentWorkoutIndex];

  // Separate warmup and main exercises
  const warmupExercises = currentWorkout?.exercises.filter(
    ex => ex.exercise?.exerciseType === 'warmup'
  ) || [];
  const mainExercises = currentWorkout?.exercises.filter(
    ex => ex.exercise && (ex.exercise.exerciseType === 'main' || !ex.exercise.exerciseType)
  ) || [];

  const handleSwap = (oldExercise: ProgramExercise & { exercise: Exercise }, newExercise: Exercise & { selectedEquipment?: string }) => {
    swapExerciseMutation.mutate({
      programExerciseId: oldExercise.id,
      newExerciseId: newExercise.id,
      equipment: newExercise.selectedEquipment,
    });
    setSwapExercise(null);
  };

  const formatReps = (ex: ProgramExercise) => {
    if (ex.durationSeconds) {
      return `${ex.durationSeconds}s`;
    }
    if (ex.repsMin && ex.repsMax) {
      return `${ex.repsMin}-${ex.repsMax}`;
    }
    if (ex.repsMin) {
      return `${ex.repsMin}`;
    }
    return '-';
  };

  const getDayName = (dayOfWeek: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek % 7];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b p-4">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Skeleton className="h-7 w-48" />
          </div>
        </header>
        <main className="max-w-4xl mx-auto p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
          ))}
        </main>
      </div>
    );
  }

  if (!fullProgram || !currentWorkout) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b p-4">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">No Program Found</h1>
          </div>
        </header>
        <main className="max-w-4xl mx-auto p-6">
          <p className="text-muted-foreground">No active workout program found. Please generate a program first.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{currentWorkout.workoutName}</h1>
            <p className="text-sm text-muted-foreground">
              {currentWorkout.movementFocus.join(', ')}
            </p>
          </div>
        </div>
      </header>

      {/* Workout Navigation */}
      {fullProgram.workouts.length > 1 && (
        <div className="border-b p-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWorkoutIndex(prev => Math.max(0, prev - 1))}
              disabled={currentWorkoutIndex === 0}
              data-testid="button-prev-workout"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm font-medium" data-testid="text-workout-navigation">
              {getDayName(currentWorkout.dayOfWeek)} • Workout {currentWorkoutIndex + 1} of {fullProgram.workouts.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWorkoutIndex(prev => Math.min(fullProgram.workouts.length - 1, prev + 1))}
              disabled={currentWorkoutIndex === fullProgram.workouts.length - 1}
              data-testid="button-next-workout"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Warmup Section */}
        {warmupExercises.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Warmup</h2>
            <div className="space-y-4">
              {warmupExercises.map((ex) => (
                <Card key={ex.id} className="p-6">
                  {ex.supersetGroup && (
                    <div className="mb-3 flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Superset {ex.supersetGroup}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Exercise {ex.supersetOrder} of 2
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{formatExerciseName(ex.exercise.name, ex.equipment)}</h3>
                      {ex.exercise.primaryMuscles && ex.exercise.primaryMuscles.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex gap-2 flex-wrap">
                            {ex.exercise.primaryMuscles.map((muscle, idx) => (
                              <Badge key={`primary-${muscle}-${idx}`} variant="outline" className="text-xs">
                                {muscle}
                              </Badge>
                            ))}
                          </div>
                          {ex.exercise.secondaryMuscles && ex.exercise.secondaryMuscles.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {ex.exercise.secondaryMuscles.join(', ')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSwapExercise(ex)}
                      data-testid={`button-swap-${ex.id}`}
                    >
                      <Repeat className="h-4 w-4 mr-2" />
                      Swap
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Sets</p>
                      <p className="text-lg font-semibold">{ex.sets}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Reps</p>
                      <p className="text-lg font-semibold">{formatReps(ex)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Rest</p>
                      <p className="text-lg font-semibold">{ex.restSeconds}s</p>
                    </div>
                    {ex.targetRPE && (
                      <div>
                        <p className="text-sm text-muted-foreground">Target RPE</p>
                        <p className="text-lg font-semibold">{ex.targetRPE}</p>
                      </div>
                    )}
                    {ex.targetRIR && (
                      <div>
                        <p className="text-sm text-muted-foreground">RIR</p>
                        <p className="text-lg font-semibold">{ex.targetRIR}</p>
                      </div>
                    )}
                  </div>

                  {ex.exercise.videoUrl && (
                    <Button variant="ghost" size="sm" data-testid={`button-form-${ex.id}`}>
                      <Play className="h-4 w-4 mr-2" />
                      Watch Form Video
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Training Section */}
        {mainExercises.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Training</h2>
            <div className="space-y-4">
              {mainExercises.map((ex) => (
                <Card key={ex.id} className="p-6">
                  {ex.supersetGroup && (
                    <div className="mb-3 flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Superset {ex.supersetGroup}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Exercise {ex.supersetOrder} of 2
                      </span>
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{formatExerciseName(ex.exercise.name, ex.equipment)}</h3>
                      {ex.exercise.primaryMuscles && ex.exercise.primaryMuscles.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex gap-2 flex-wrap">
                            {ex.exercise.primaryMuscles.map((muscle, idx) => (
                              <Badge key={`primary-${muscle}-${idx}`} variant="outline" className="text-xs">
                                {muscle}
                              </Badge>
                            ))}
                          </div>
                          {ex.exercise.secondaryMuscles && ex.exercise.secondaryMuscles.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {ex.exercise.secondaryMuscles.join(', ')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSwapExercise(ex)}
                      data-testid={`button-swap-${ex.id}`}
                    >
                      <Repeat className="h-4 w-4 mr-2" />
                      Swap
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Sets</p>
                      <p className="text-lg font-semibold">{ex.sets}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Reps</p>
                      <p className="text-lg font-semibold">{formatReps(ex)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Rest</p>
                      <p className="text-lg font-semibold">{ex.restSeconds}s</p>
                    </div>
                    {ex.targetRPE && (
                      <div>
                        <p className="text-sm text-muted-foreground">Target RPE</p>
                        <p className="text-lg font-semibold">{ex.targetRPE}</p>
                      </div>
                    )}
                    {ex.targetRIR && (
                      <div>
                        <p className="text-sm text-muted-foreground">RIR</p>
                        <p className="text-lg font-semibold">{ex.targetRIR}</p>
                      </div>
                    )}
                  </div>

                  {ex.notes && (
                    <p className="text-sm text-muted-foreground mb-2">{ex.notes}</p>
                  )}

                  {ex.exercise.videoUrl && (
                    <Button variant="ghost" size="sm" data-testid={`button-form-${ex.id}`}>
                      <Play className="h-4 w-4 mr-2" />
                      Watch Form Video
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
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
