import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Play, Pause, PlayCircle, Repeat, TrendingUp, AlertCircle } from "lucide-react";
import RestTimerOverlay from "@/components/RestTimerOverlay";
import ExerciseSwapDialog from "@/components/ExerciseSwapDialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WorkoutProgram, ProgramWorkout, ProgramExercise, Exercise, WorkoutSession as WorkoutSessionType } from "@shared/schema";

interface ExerciseData {
  id: string;
  name: string;
  equipment: string[];
  movementPattern: string;
  sets: number;
  reps: string;
  weight: string;
  recommendedWeight?: number;
  tempo: string;
  rpe?: number;
  rir?: number;
  formVideoUrl: string;
  durationSeconds?: number;
}

interface WorkoutSessionProps {
  onComplete: (summary: WorkoutSummary) => void;
}

export interface WorkoutSummary {
  duration: number;
  exercises: number;
  totalVolume: number;
  incomplete?: boolean;
  completedExercises?: number;
  programWorkoutId: string;
  sessionId: string;
}

export default function WorkoutSession({ onComplete }: WorkoutSessionProps) {
  const { toast } = useToast();
  
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

  const { data: sessions } = useQuery<WorkoutSessionType[]>({
    queryKey: ["/api/workout-sessions"],
  });

  const showAds = user?.subscriptionTier === "free" || !user?.subscriptionTier;
  
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [programExercises, setProgramExercises] = useState<(ProgramExercise & { exercise: Exercise })[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [actualReps, setActualReps] = useState("");
  const [actualWeight, setActualWeight] = useState("");
  const [actualDuration, setActualDuration] = useState("");
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [workoutTime, setWorkoutTime] = useState(0);
  const [heartRate] = useState(120);
  const [isPaused, setIsPaused] = useState(false);
  const [swapExercise, setSwapExercise] = useState<(ProgramExercise & { exercise: Exercise }) | null>(null);
  const [recommendedWeightIncrease, setRecommendedWeightIncrease] = useState<number>(0);
  const [recommendedRepIncrease, setRecommendedRepIncrease] = useState<number>(0);
  const [lastRir, setLastRir] = useState<number | undefined>(undefined);
  const [currentWorkoutId, setCurrentWorkoutId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionError, setSessionError] = useState<string>("");
  const isPausedRef = useRef(false);
  const isSwappingRef = useRef(false);

  const startSessionMutation = useMutation({
    mutationFn: async (programWorkoutId: string) => {
      return await apiRequest("POST", "/api/workout-sessions", {
        programWorkoutId,
        completed: 0,
        status: "in_progress",
      });
    },
    onSuccess: (data: any) => {
      setSessionId(data.id);
      setSessionError("");
    },
    onError: (error: any) => {
      const errorMsg = error.message || "Could not create workout session. Please try again.";
      setSessionError(errorMsg);
      toast({
        title: "Failed to Start Workout",
        description: errorMsg,
        variant: "destructive",
      });
    },
  });

  const retrySessionCreation = () => {
    if (currentWorkoutId) {
      startSessionMutation.mutate(currentWorkoutId);
    }
  };

  useEffect(() => {
    if (programDetails?.workouts) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Try to find today's session using calendar-based scheduling (prioritize today, then upcoming, then past due)
      let todaySession = sessions
        ?.filter((s: any) => s.completed === 0 && s.scheduledDate)
        .sort((a: any, b: any) => {
          const dateA = new Date(a.scheduledDate).getTime();
          const dateB = new Date(b.scheduledDate).getTime();
          
          // Prioritize today's session, then upcoming, then past due
          const aDate = new Date(a.scheduledDate);
          aDate.setHours(0, 0, 0, 0);
          const bDate = new Date(b.scheduledDate);
          bDate.setHours(0, 0, 0, 0);
          
          const aIsToday = aDate.getTime() === today.getTime();
          const bIsToday = bDate.getTime() === today.getTime();
          const aIsFuture = aDate.getTime() > today.getTime();
          const bIsFuture = bDate.getTime() > today.getTime();
          
          // Today's workout comes first
          if (aIsToday && !bIsToday) return -1;
          if (!aIsToday && bIsToday) return 1;
          
          // Future workouts come before past due
          if (aIsFuture && !bIsFuture) return -1;
          if (!aIsFuture && bIsFuture) return 1;
          
          // Within same category, sort by date
          return dateA - dateB;
        })[0];
      
      let workout;
      
      if (todaySession) {
        workout = programDetails.workouts.find(w => w.id === todaySession.programWorkoutId);
      } else {
        // Fallback for legacy data: use day-of-week logic
        const jsDay = new Date().getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        workout = programDetails.workouts.find(w => w.dayOfWeek >= isoDay) || programDetails.workouts[0];
      }
      
      if (workout && workout.exercises) {
        setCurrentWorkoutId(workout.id);
        setProgramExercises(workout.exercises);
        const mappedExercises: ExerciseData[] = workout.exercises.map(pe => {
          return {
            id: pe.id,
            name: pe.exercise.name,
            equipment: pe.exercise.equipment || [],
            movementPattern: pe.exercise.movementPattern,
            sets: pe.sets,
            reps: pe.repsMin && pe.repsMax ? `${pe.repsMin}-${pe.repsMax}` : pe.repsMin?.toString() || '10',
            weight: '0',
            recommendedWeight: pe.recommendedWeight || undefined,
            tempo: '2-0-2-0',
            rpe: pe.targetRPE || undefined,
            rir: pe.targetRIR || undefined,
            formVideoUrl: pe.exercise.videoUrl || '#',
            durationSeconds: pe.durationSeconds || undefined,
          };
        });
        setExercises(mappedExercises);
      }
    }
  }, [programDetails, sessions, unitPreference]);

  // Start the workout session when workout is loaded
  useEffect(() => {
    if (currentWorkoutId && !sessionId && !startSessionMutation.isPending) {
      startSessionMutation.mutate(currentWorkoutId);
    }
  }, [currentWorkoutId, sessionId]);

  const currentExercise = exercises[currentExerciseIndex];
  const isLastSet = currentExercise && currentSet === currentExercise.sets;
  const isLastExercise = currentExerciseIndex === exercises.length - 1;

  const requiresWeight = (equipment: string[]) => {
    const weightEquipment = ['dumbbells', 'barbell', 'kettlebell', 'medicine ball', 'resistance bands'];
    return equipment.some(eq => weightEquipment.includes(eq.toLowerCase()));
  };

  const isCardio = currentExercise?.movementPattern === 'cardio';
  const needsWeight = currentExercise ? requiresWeight(currentExercise.equipment) : true;

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isSwappingRef.current = !!swapExercise;
  }, [swapExercise]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isPausedRef.current && !isSwappingRef.current) {
        setWorkoutTime(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getWeightIncreaseRecommendation = (rir: number) => {
    if (rir > 2) {
      if (rir >= 5) return 10;
      return 5;
    }
    return 0;
  };

  const getRepIncreaseRecommendation = (rir: number) => {
    if (rir > 2) {
      return 1;
    }
    return 0;
  };

  const handleRestComplete = (rir?: number) => {
    setShowRestTimer(false);
    setLastRir(rir);
    
    if (rir !== undefined && !isLastSet && !isCardio) {
      if (needsWeight) {
        const increase = getWeightIncreaseRecommendation(rir);
        setRecommendedWeightIncrease(increase);
        setRecommendedRepIncrease(0);
      } else {
        const repIncrease = getRepIncreaseRecommendation(rir);
        setRecommendedRepIncrease(repIncrease);
        setRecommendedWeightIncrease(0);
      }
    } else {
      setRecommendedWeightIncrease(0);
      setRecommendedRepIncrease(0);
    }
  };

  const handleSetComplete = async () => {
    if (isCardio) {
      if (!actualDuration) return;
    } else {
      if (!actualReps) return;
      if (needsWeight && !actualWeight) return;
    }

    const weightToUse = isCardio ? "0" : (needsWeight ? actualWeight : "0");
    
    const updatedExercises = exercises.map((ex, idx) => 
      idx === currentExerciseIndex 
        ? { ...ex, weight: weightToUse }
        : ex
    );
    
    setExercises(updatedExercises);
    setRecommendedWeightIncrease(0);
    setRecommendedRepIncrease(0);

    if (!isCardio) {
      const repsMin = parseInt(currentExercise.reps.includes('-') ? currentExercise.reps.split('-')[0] : currentExercise.reps);
      const repsMax = parseInt(currentExercise.reps.includes('-') ? currentExercise.reps.split('-')[1] : currentExercise.reps);
      const actualRepsInt = parseInt(actualReps);
      
      try {
        const updates: any = {};
        let shouldUpdate = false;

        if (needsWeight && currentExercise.recommendedWeight) {
          const currentWeightInLbs = unitPreference === 'imperial' 
            ? parseFloat(actualWeight) 
            : parseFloat(actualWeight) / 0.453592;

          if (actualRepsInt < repsMin) {
            const repDeficit = repsMin - actualRepsInt;
            const reductionPercent = repDeficit <= 2 ? 0.05 : 0.10;
            updates.recommendedWeight = Math.round(currentWeightInLbs * (1 - reductionPercent));
            shouldUpdate = true;
          } else if (actualRepsInt > repsMax || (lastRir !== undefined && lastRir > 2)) {
            const increaseAmount = lastRir !== undefined && lastRir >= 5 ? 10 : 5;
            updates.recommendedWeight = Math.round(currentWeightInLbs + increaseAmount);
            shouldUpdate = true;
          }
        } else if (!needsWeight) {
          if (actualRepsInt < repsMin) {
            updates.repsMin = Math.max(1, repsMin - 1);
            updates.repsMax = Math.max(updates.repsMin, repsMax - 1);
            shouldUpdate = true;
          } else if (actualRepsInt > repsMax || (lastRir !== undefined && lastRir > 2)) {
            updates.repsMin = repsMin + 1;
            updates.repsMax = repsMax + 1;
            shouldUpdate = true;
          }
        }

        if (shouldUpdate) {
          const response = await fetch(`/api/programs/exercises/${currentExercise.id}/update-weight`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(updates),
          });
          
          if (response.ok) {
            const updatedWithProgression = exercises.map((ex, idx) => 
              idx === currentExerciseIndex 
                ? { 
                    ...ex, 
                    recommendedWeight: updates.recommendedWeight || ex.recommendedWeight,
                    reps: updates.repsMin && updates.repsMax 
                      ? `${updates.repsMin}-${updates.repsMax}` 
                      : ex.reps
                  }
                : ex
            );
            setExercises(updatedWithProgression);
          }
        }
      } catch (error) {
        console.error('Failed to apply progressive overload:', error);
      }
    }

    setLastRir(undefined);

    if (isLastSet) {
      if (isLastExercise) {
        const totalVolume = updatedExercises.reduce((total, ex) => {
          return total + (ex.sets * parseFloat(ex.weight || '0'));
        }, 0);
        
        if (!sessionId) {
          toast({
            title: "Cannot Complete Workout",
            description: "Workout session not properly initialized. Please restart the workout.",
            variant: "destructive",
          });
          return;
        }
        
        onComplete({
          duration: workoutTime,
          exercises: exercises.length,
          totalVolume: Math.round(totalVolume),
          programWorkoutId: currentWorkoutId,
          sessionId: sessionId,
        });
      } else {
        setCurrentExerciseIndex(prev => prev + 1);
        setCurrentSet(1);
        setActualReps("");
        setActualWeight("");
        setActualDuration("");
        setShowRestTimer(true);
      }
    } else {
      setCurrentSet(prev => prev + 1);
      setActualReps("");
      setActualWeight("");
      setActualDuration("");
      setShowRestTimer(true);
    }
  };

  const handleSwap = (newExercise: Exercise) => {
    setExercises(prev =>
      prev.map(ex => ex.id === currentExercise.id ? {
        ...ex,
        name: newExercise.name,
        equipment: newExercise.equipment || [],
        movementPattern: newExercise.movementPattern,
        formVideoUrl: newExercise.videoUrl || '#',
      } : ex)
    );
    setProgramExercises(prev =>
      prev.map(pe => pe.id === currentExercise.id ? {
        ...pe,
        exercise: newExercise,
      } : pe)
    );
    setSwapExercise(null);
  };

  const handleEndEarly = () => {
    if (!sessionId) {
      toast({
        title: "Cannot End Workout",
        description: "Workout session not properly initialized. Please restart the workout.",
        variant: "destructive",
      });
      return;
    }
    
    const completedVolume = exercises.slice(0, currentExerciseIndex).reduce((total, ex) => {
      return total + (ex.sets * parseFloat(ex.weight || '0'));
    }, 0);

    onComplete({
      duration: workoutTime,
      exercises: exercises.length,
      totalVolume: Math.round(completedVolume),
      incomplete: true,
      completedExercises: currentExerciseIndex,
      programWorkoutId: currentWorkoutId,
      sessionId: sessionId,
    });
  };

  if (loadingProgram || loadingDetails) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="p-6">
            <Skeleton className="h-24 w-full" />
          </Card>
          <Card className="p-6">
            <Skeleton className="h-96 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  if (!activeProgram || !programDetails || exercises.length === 0) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="p-12 text-center">
            <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Workout Scheduled</h2>
            <p className="text-muted-foreground mb-6">
              There's no workout scheduled for today. Check your program or create a new one.
            </p>
            <Button onClick={() => window.location.href = '/home'} data-testid="button-back-home">
              Back to Home
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  // Show error state if session creation failed
  if (sessionError && !sessionId) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="p-12 text-center">
            <AlertCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
            <h2 className="text-2xl font-bold mb-2">Failed to Start Workout</h2>
            <p className="text-muted-foreground mb-6">
              {sessionError}
            </p>
            <div className="flex gap-3 justify-center">
              <Button 
                onClick={retrySessionCreation}
                disabled={startSessionMutation.isPending}
                data-testid="button-retry-session"
              >
                {startSessionMutation.isPending ? "Retrying..." : "Retry"}
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/home'}
                data-testid="button-back-home"
              >
                Back to Home
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const completedSets = exercises.slice(0, currentExerciseIndex).reduce((acc, ex) => acc + ex.sets, 0);
  const progressPercent = ((completedSets + (currentSet - 1)) / 
    (exercises.reduce((acc, ex) => acc + ex.sets, 0))) * 100;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {!sessionId && (
          <Card className="p-6 border-warning bg-warning/10">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-warning" />
              <div className="flex-1">
                <p className="font-semibold">Initializing workout session...</p>
                <p className="text-sm text-muted-foreground">Please wait while we set up your workout</p>
              </div>
            </div>
          </Card>
        )}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Time</p>
                <p className="text-3xl font-mono font-bold">{formatTime(workoutTime)}</p>
              </div>
              <div className="h-12 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm text-muted-foreground">HR</p>
                  <p className="text-2xl font-mono font-bold">{heartRate}</p>
                </div>
              </div>
              <div className="h-12 w-px bg-border" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Complete</p>
                <p className="text-2xl font-mono font-bold" data-testid="text-workout-progress">
                  {Math.round(progressPercent)}%
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsPaused(!isPaused)}
              data-testid="button-pause-resume"
            >
              {isPaused ? <PlayCircle className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </Button>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-2xl font-bold">{currentExercise.name}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const programExercise = programExercises.find(pe => pe.id === currentExercise.id);
                if (programExercise) {
                  setSwapExercise(programExercise);
                }
              }}
              data-testid="button-swap-exercise"
            >
              <Repeat className="h-4 w-4 mr-2" />
              Swap
            </Button>
          </div>
          
          <div className="aspect-video bg-muted rounded-lg mb-6 flex items-center justify-center">
            <Button variant="outline" size="lg" data-testid="button-play-video">
              <Play className="h-6 w-6 mr-2" />
              Watch Form Video
            </Button>
          </div>

          <div className="space-y-6">
            {recommendedWeightIncrease > 0 && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg" data-testid="weight-increase-banner">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Weight Increase Recommended</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Based on your last set, consider adding <span className="font-bold text-primary">{recommendedWeightIncrease} {weightUnit}</span> for this set.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {recommendedRepIncrease > 0 && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg" data-testid="rep-increase-banner">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Rep Increase Recommended</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Based on your last set, consider adding <span className="font-bold text-primary">{recommendedRepIncrease} more rep</span> for this set.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Set {currentSet} of {currentExercise.sets}</p>
              <div className="space-y-2">
                {isCardio ? (
                  <p className="text-lg">
                    <span className="text-muted-foreground">Duration: </span>
                    <span className="font-bold">
                      {currentExercise.durationSeconds 
                        ? `${Math.floor(currentExercise.durationSeconds / 60)}:${(currentExercise.durationSeconds % 60).toString().padStart(2, '0')}` 
                        : 'Track your time'}
                    </span>
                  </p>
                ) : (
                  <p className="text-lg">
                    <span className="text-muted-foreground">Recommended: </span>
                    <span className="font-bold">{currentExercise.reps} reps</span>
                  </p>
                )}
                {!isCardio && (
                  <div className="flex items-center justify-center gap-6 mt-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Tempo</p>
                      <p className="text-lg font-mono font-bold" data-testid="text-tempo">{currentExercise.tempo}</p>
                    </div>
                    {currentExercise.rpe && (
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Suggested RPE</p>
                        <p className="text-lg font-mono font-bold" data-testid="text-rpe">{currentExercise.rpe}/10</p>
                      </div>
                    )}
                    {currentExercise.rir && (
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Target RIR</p>
                        <p className="text-lg font-mono font-bold" data-testid="text-rir">{currentExercise.rir}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {isCardio ? (
              <div className="space-y-2">
                <Label htmlFor="actual-duration">Duration (seconds)</Label>
                <Input
                  id="actual-duration"
                  type="number"
                  value={actualDuration}
                  onChange={(e) => setActualDuration(e.target.value)}
                  placeholder={currentExercise.durationSeconds?.toString() || "300"}
                  className="text-2xl text-center h-16"
                  data-testid="input-actual-duration"
                />
                <p className="text-xs text-muted-foreground text-center">
                  {actualDuration ? `${Math.floor(parseInt(actualDuration) / 60)}:${(parseInt(actualDuration) % 60).toString().padStart(2, '0')}` : ''}
                </p>
              </div>
            ) : (
              <div className={needsWeight ? "grid grid-cols-2 gap-4" : ""}>
                <div className="space-y-2">
                  <Label htmlFor="actual-reps">Actual Reps</Label>
                  <Input
                    id="actual-reps"
                    type="number"
                    value={actualReps}
                    onChange={(e) => setActualReps(e.target.value)}
                    placeholder={
                      (() => {
                        const baseReps = currentExercise.reps.includes('-') 
                          ? parseInt(currentExercise.reps.split('-')[0]) 
                          : parseInt(currentExercise.reps);
                        return (baseReps + recommendedRepIncrease).toString();
                      })()
                    }
                    className="text-2xl text-center h-16 placeholder:text-muted-foreground/40"
                    data-testid="input-actual-reps"
                  />
                </div>
                {needsWeight && (
                  <div className="space-y-2">
                    <Label htmlFor="actual-weight">Actual Weight ({weightUnit})</Label>
                    <Input
                      id="actual-weight"
                      type="number"
                      value={actualWeight}
                      onChange={(e) => setActualWeight(e.target.value)}
                      placeholder={
                        currentExercise.recommendedWeight 
                          ? unitPreference === 'imperial' 
                            ? (currentExercise.recommendedWeight + recommendedWeightIncrease).toString()
                            : ((currentExercise.recommendedWeight + recommendedWeightIncrease) * 0.453592).toFixed(1)
                          : undefined
                      }
                      className="text-2xl text-center h-16 placeholder:text-muted-foreground/40"
                      data-testid="input-actual-weight"
                    />
                  </div>
                )}
              </div>
            )}

            <Button
              size="lg"
              className="w-full"
              onClick={handleSetComplete}
              disabled={isCardio ? !actualDuration : (!actualReps || (needsWeight && !actualWeight))}
              data-testid="button-next-set"
            >
              {isLastSet && isLastExercise ? "Finish Workout" : isLastSet ? "Next Exercise" : "Finish Set and Recover"}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={handleEndEarly}
              data-testid="button-end-early"
            >
              End Workout Early
            </Button>
          </div>
        </Card>
      </div>

      {showRestTimer && (
        <RestTimerOverlay
          duration={90}
          onComplete={handleRestComplete}
          onSkip={() => setShowRestTimer(false)}
          showAds={showAds}
        />
      )}

      {swapExercise && (
        <ExerciseSwapDialog
          exercise={swapExercise}
          onSwap={handleSwap}
          onClose={() => setSwapExercise(null)}
        />
      )}
    </div>
  );
}
