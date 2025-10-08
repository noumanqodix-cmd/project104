import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Repeat, TrendingUp, Info, AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import ExerciseSwapDialog from "@/components/ExerciseSwapDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import type { WorkoutProgram, ProgramWorkout, ProgramExercise, Exercise, WorkoutSession, WorkoutSet } from "@shared/schema";

interface ExerciseWithProgression {
  id: string;
  name: string;
  equipment: string[];
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  sets: number;
  reps: string;
  weight: string;
  tempo: string;
  rpe?: number;
  formVideoUrl: string;
  lastRir?: number;
  weightIncrease?: number;
}

export default function WorkoutPreview() {
  const [, setLocation] = useLocation();
  
  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const unitPreference = user?.unitPreference || 'imperial';
  const weightUnit = unitPreference === 'imperial' ? 'lbs' : 'kg';
  
  const { data: activeProgram, isLoading: loadingProgram } = useQuery<WorkoutProgram>({
    queryKey: ["/api/programs/active"],
  });

  const { data: programDetails, isLoading: loadingDetails } = useQuery<{
    workouts: (ProgramWorkout & { exercises: (ProgramExercise & { exercise: Exercise })[] })[];
  }>({
    queryKey: ["/api/programs", activeProgram?.id],
    enabled: !!activeProgram?.id,
  });

  const { data: workoutSessions } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/workout-sessions"],
  });

  const [exercises, setExercises] = useState<ExerciseWithProgression[]>([]);
  const [workoutName, setWorkoutName] = useState<string>("");
  const [swapExercise, setSwapExercise] = useState<ExerciseWithProgression | null>(null);
  const [exerciseIdForQuery, setExerciseIdForQuery] = useState<string | null>(null);

  useEffect(() => {
    if (programDetails?.workouts && workoutSessions) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Find next scheduled session
      const nextSession = workoutSessions
        ?.filter((s: any) => s.completed === 0 && s.scheduledDate)
        .sort((a: any, b: any) => {
          const dateA = new Date(a.scheduledDate).getTime();
          const dateB = new Date(b.scheduledDate).getTime();
          
          const aDate = new Date(a.scheduledDate);
          aDate.setHours(0, 0, 0, 0);
          const bDate = new Date(b.scheduledDate);
          bDate.setHours(0, 0, 0, 0);
          
          const aIsToday = aDate.getTime() === today.getTime();
          const bIsToday = bDate.getTime() === today.getTime();
          const aIsFuture = aDate.getTime() > today.getTime();
          const bIsFuture = bDate.getTime() > today.getTime();
          
          if (aIsToday && !bIsToday) return -1;
          if (!aIsToday && bIsToday) return 1;
          if (aIsFuture && !bIsFuture) return -1;
          if (!aIsFuture && bIsFuture) return 1;
          
          return dateA - dateB;
        })[0];
      
      const nextWorkout = nextSession 
        ? programDetails.workouts.find(w => w.id === nextSession.programWorkoutId)
        : null;
      
      if (nextWorkout && nextWorkout.exercises) {
        setWorkoutName(nextWorkout.workoutName);
        
        const mappedExercises: ExerciseWithProgression[] = nextWorkout.exercises.map(pe => {
          return {
            id: pe.id,
            name: pe.exercise.name,
            equipment: pe.exercise.equipment || [],
            primaryMuscles: pe.exercise.primaryMuscles || [],
            secondaryMuscles: pe.exercise.secondaryMuscles || [],
            sets: pe.sets,
            reps: pe.repsMin && pe.repsMax ? `${pe.repsMin}-${pe.repsMax}` : pe.repsMin?.toString() || '10',
            weight: '0',
            tempo: '2-0-2-0',
            rpe: pe.targetRPE || undefined,
            formVideoUrl: pe.exercise.videoUrl || '#',
            lastRir: undefined,
          };
        });
        setExercises(mappedExercises);
      }
    }
  }, [programDetails, workoutSessions]);

  useEffect(() => {
    if (programDetails?.workouts && exercises.length > 0 && workoutSessions) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const nextSession = workoutSessions
        ?.filter((s: any) => s.completed === 0 && s.scheduledDate)
        .sort((a: any, b: any) => {
          const dateA = new Date(a.scheduledDate).getTime();
          const dateB = new Date(b.scheduledDate).getTime();
          
          const aDate = new Date(a.scheduledDate);
          aDate.setHours(0, 0, 0, 0);
          const bDate = new Date(b.scheduledDate);
          bDate.setHours(0, 0, 0, 0);
          
          const aIsToday = aDate.getTime() === today.getTime();
          const bIsToday = bDate.getTime() === today.getTime();
          const aIsFuture = aDate.getTime() > today.getTime();
          const bIsFuture = bDate.getTime() > today.getTime();
          
          if (aIsToday && !bIsToday) return -1;
          if (!aIsToday && bIsToday) return 1;
          if (aIsFuture && !bIsFuture) return -1;
          if (!aIsFuture && bIsFuture) return 1;
          
          return dateA - dateB;
        })[0];
      
      const nextWorkout = nextSession 
        ? programDetails.workouts.find(w => w.id === nextSession.programWorkoutId)
        : null;

      if (nextWorkout && nextWorkout.exercises) {
        nextWorkout.exercises.forEach(async (pe, index) => {
          try {
            const response = await fetch(`/api/workout-sets?exerciseId=${pe.exercise.id}`);
            if (response.ok) {
              const sets: WorkoutSet[] = await response.json();
              
              if (sets.length > 0) {
                const rirValues = sets
                  .filter(s => s.rir !== null && s.rir !== undefined)
                  .map(s => s.rir as number);
                
                if (rirValues.length > 0) {
                  const avgRir = rirValues.reduce((sum, val) => sum + val, 0) / rirValues.length;
                  
                  setExercises(prev => {
                    const newExercises = [...prev];
                    if (newExercises[index]) {
                      newExercises[index] = {
                        ...newExercises[index],
                        lastRir: avgRir
                      };
                    }
                    return newExercises;
                  });
                }
              }
            }
          } catch (error) {
            console.error(`Failed to fetch sets for exercise ${pe.exercise.id}`, error);
          }
        });
      }
    }
  }, [programDetails, workoutSessions]);

  const handleSwap = (newExercise: any) => {
    setExercises(prev =>
      prev.map(ex => ex.id === swapExercise?.id ? { 
        ...newExercise, 
        id: swapExercise.id,
        primaryMuscles: newExercise.primaryMuscles || [],
        secondaryMuscles: newExercise.secondaryMuscles || [],
      } : ex)
    );
    setSwapExercise(null);
  };

  const getWeightIncreaseRecommendation = (avgRir?: number) => {
    if (avgRir === undefined) return 0;
    if (avgRir > 3) return 5;
    if (avgRir < 2) return 0;
    return 5;
  };

  if (loadingProgram || loadingDetails) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="p-6 space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!activeProgram || !programDetails || exercises.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/home")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Workout Preview</h1>
            </div>
          </div>

          <Card className="p-12 text-center">
            <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Workout Available</h2>
            <p className="text-muted-foreground mb-6">
              There's no workout preview available. Create a workout program to get started.
            </p>
            <Button onClick={() => setLocation("/home")} data-testid="button-create-program">
              Back to Home
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const hasWeightIncreases = exercises.some(ex => {
    const increase = getWeightIncreaseRecommendation(ex.lastRir);
    return increase > 0;
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/home")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Next Workout</h1>
            <p className="text-muted-foreground">{workoutName} - Review and edit</p>
          </div>
        </div>

        {hasWeightIncreases && (
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertDescription>
              Based on your last workout, we recommend increasing weight on some exercises. See recommendations below.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {exercises.map((exercise, index) => {
            const recommendedIncrease = getWeightIncreaseRecommendation(exercise.lastRir);
            
            return (
              <Card key={exercise.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">{exercise.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {exercise.sets} sets × {exercise.reps} reps
                      </CardDescription>
                      {exercise.primaryMuscles && exercise.primaryMuscles.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="flex gap-2 flex-wrap">
                            {exercise.primaryMuscles.map((muscle, idx) => (
                              <Badge key={`primary-${muscle}-${idx}`} variant="outline" className="text-xs">
                                {muscle}
                              </Badge>
                            ))}
                          </div>
                          {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {exercise.secondaryMuscles.join(', ')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSwapExercise(exercise)}
                      data-testid={`button-swap-${index}`}
                    >
                      <Repeat className="h-4 w-4 mr-2" />
                      Swap
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Recommended Reps</p>
                      <p className="text-lg font-bold" data-testid={`weight-${index}`}>
                        {exercise.reps}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Equipment</p>
                      <p className="text-lg font-medium capitalize">
                        {exercise.equipment.length > 0 ? exercise.equipment[0] : 'bodyweight'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Tempo</p>
                      <p className="text-lg font-mono font-bold" data-testid={`tempo-${index}`}>{exercise.tempo}</p>
                    </div>
                    {exercise.rpe && (
                      <div>
                        <p className="text-sm text-muted-foreground">Target RPE</p>
                        <p className="text-lg font-mono font-bold" data-testid={`rpe-${index}`}>{exercise.rpe}/10</p>
                      </div>
                    )}
                  </div>

                  {exercise.lastRir !== undefined ? (
                    recommendedIncrease > 0 ? (
                      <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                        <div className="flex items-start gap-2">
                          <TrendingUp className="h-4 w-4 text-primary mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-primary">Weight Increase Recommended</p>
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`recommendation-${index}`}>
                              Average RIR: {exercise.lastRir.toFixed(1)}. Add {recommendedIncrease} {weightUnit} for progressive overload.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 p-3 bg-muted border rounded-lg">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold">Maintain Current Weight</p>
                            <p className="text-sm text-muted-foreground mt-1" data-testid={`recommendation-${index}`}>
                              Average RIR: {exercise.lastRir.toFixed(1)}. Keep the same weight and focus on form.
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="mt-3 p-3 bg-muted border rounded-lg">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground" data-testid={`recommendation-${index}`}>
                            No data available. Complete a workout to get personalized recommendations.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="space-y-3">
          <Link href="/workout">
            <Button className="w-full" size="lg" data-testid="button-start-workout">
              Start This Workout
            </Button>
          </Link>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => setLocation("/home")}
            data-testid="button-cancel"
          >
            Back to Home
          </Button>
        </div>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold mb-1">Progressive Overload Guide</p>
                <p className="text-xs text-muted-foreground">
                  • 3-5 reps in reserve (RIR): Add 5 {weightUnit}<br />
                  • 5+ reps in reserve: Add 10 {weightUnit}<br />
                  • 0-2 reps in reserve: Maintain current weight
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {swapExercise && (
        <ExerciseSwapDialog
          exercise={swapExercise as any}
          onSwap={handleSwap}
          onClose={() => setSwapExercise(null)}
        />
      )}
    </div>
  );
}
