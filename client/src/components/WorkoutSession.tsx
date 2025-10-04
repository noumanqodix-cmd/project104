import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Heart, Play, Pause, PlayCircle, Repeat, TrendingUp } from "lucide-react";
import RestTimerOverlay from "@/components/RestTimerOverlay";
import ExerciseSwapDialog from "@/components/ExerciseSwapDialog";
import { useQuery } from "@tanstack/react-query";

interface Exercise {
  id: string;
  name: string;
  equipment: string;
  sets: number;
  reps: string;
  weight: string;
  tempo: string;
  rpe?: number;
  formVideoUrl: string;
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
}

export default function WorkoutSession({ onComplete }: WorkoutSessionProps) {
  const unitPreference = localStorage.getItem('unitPreference') || 'imperial';
  const weightUnit = unitPreference === 'imperial' ? 'lbs' : 'kg';
  
  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });
  
  const showAds = user?.subscriptionTier === "free" || !user?.subscriptionTier;
  
  //todo: remove mock functionality
  const [exercises, setExercises] = useState<Exercise[]>([
    { id: "1", name: "Barbell Bench Press", equipment: "barbell", sets: 4, reps: "8-10", weight: `135 ${weightUnit}`, tempo: "1-1-1-1", rpe: 8, formVideoUrl: "#" },
    { id: "2", name: "Dumbbell Shoulder Press", equipment: "dumbbells", sets: 3, reps: "10-12", weight: `30 ${weightUnit}`, tempo: "1-1-1-1", rpe: 7, formVideoUrl: "#" },
    { id: "3", name: "Cable Tricep Pushdown", equipment: "cable", sets: 3, reps: "12-15", weight: `60 ${weightUnit}`, tempo: "1-1-1-1", rpe: 8, formVideoUrl: "#" },
  ]);

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [actualReps, setActualReps] = useState("");
  const [actualWeight, setActualWeight] = useState("");
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [workoutTime, setWorkoutTime] = useState(0);
  const [heartRate] = useState(120); //todo: remove mock functionality
  const [isPaused, setIsPaused] = useState(false);
  const [swapExercise, setSwapExercise] = useState<Exercise | null>(null);
  const [recommendedWeightIncrease, setRecommendedWeightIncrease] = useState<number>(0);
  const isPausedRef = useRef(false);
  const isSwappingRef = useRef(false);

  const currentExercise = exercises[currentExerciseIndex];
  const isLastSet = currentSet === currentExercise.sets;
  const isLastExercise = currentExerciseIndex === exercises.length - 1;

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
    if (rir >= 5) return 10;
    if (rir >= 3) return 5;
    return 0;
  };

  const handleRestComplete = (rir?: number) => {
    setShowRestTimer(false);
    
    if (rir !== undefined && !isLastSet) {
      const increase = getWeightIncreaseRecommendation(rir);
      setRecommendedWeightIncrease(increase);
    } else {
      setRecommendedWeightIncrease(0);
    }
  };

  const handleSetComplete = () => {
    if (!actualReps || !actualWeight) return;

    setRecommendedWeightIncrease(0);

    if (isLastSet) {
      if (isLastExercise) {
        onComplete({
          duration: workoutTime,
          exercises: exercises.length,
          totalVolume: 5420, //todo: remove mock functionality
        });
      } else {
        setCurrentExerciseIndex(prev => prev + 1);
        setCurrentSet(1);
        setActualReps("");
        setActualWeight("");
        setShowRestTimer(true);
      }
    } else {
      setCurrentSet(prev => prev + 1);
      setActualReps("");
      setActualWeight("");
      setShowRestTimer(true);
    }
  };

  const handleSwap = (newExercise: Exercise) => {
    setExercises(prev =>
      prev.map(ex => ex.id === currentExercise.id ? { ...newExercise, id: currentExercise.id } : ex)
    );
    setSwapExercise(null);
  };

  const handleEndEarly = () => {
    onComplete({
      duration: workoutTime,
      exercises: exercises.length,
      totalVolume: 2100, //todo: remove mock functionality
      incomplete: true,
      completedExercises: currentExerciseIndex,
    });
  };

  const completedSets = exercises.slice(0, currentExerciseIndex).reduce((acc, ex) => acc + ex.sets, 0);
  const progressPercent = ((completedSets + (currentSet - 1)) / 
    (exercises.reduce((acc, ex) => acc + ex.sets, 0))) * 100;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
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
              onClick={() => setSwapExercise(currentExercise)}
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

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Set {currentSet} of {currentExercise.sets}</p>
              <div className="space-y-2">
                <p className="text-lg">
                  <span className="text-muted-foreground">Recommended: </span>
                  <span className="font-bold">{currentExercise.reps} reps × {currentExercise.weight}</span>
                </p>
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
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="actual-reps">Actual Reps</Label>
                <Input
                  id="actual-reps"
                  type="number"
                  value={actualReps}
                  onChange={(e) => setActualReps(e.target.value)}
                  placeholder="10"
                  className="text-2xl text-center h-16"
                  data-testid="input-actual-reps"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actual-weight">Actual Weight ({weightUnit})</Label>
                <Input
                  id="actual-weight"
                  type="number"
                  value={actualWeight}
                  onChange={(e) => setActualWeight(e.target.value)}
                  placeholder="135"
                  className="text-2xl text-center h-16"
                  data-testid="input-actual-weight"
                />
              </div>
            </div>

            <Button
              size="lg"
              className="w-full"
              onClick={handleSetComplete}
              disabled={!actualReps || !actualWeight}
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
