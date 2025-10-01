import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Heart, Play } from "lucide-react";
import RestTimerOverlay from "@/components/RestTimerOverlay";

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight: string;
  formVideoUrl: string;
}

interface WorkoutSessionProps {
  onComplete: (summary: WorkoutSummary) => void;
}

export interface WorkoutSummary {
  duration: number;
  exercises: number;
  totalVolume: number;
}

export default function WorkoutSession({ onComplete }: WorkoutSessionProps) {
  //todo: remove mock functionality
  const exercises: Exercise[] = [
    { id: "1", name: "Barbell Bench Press", sets: 4, reps: "8-10", weight: "135 lbs", formVideoUrl: "#" },
    { id: "2", name: "Dumbbell Shoulder Press", sets: 3, reps: "10-12", weight: "30 lbs", formVideoUrl: "#" },
    { id: "3", name: "Cable Tricep Pushdown", sets: 3, reps: "12-15", weight: "60 lbs", formVideoUrl: "#" },
  ];

  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [actualReps, setActualReps] = useState("");
  const [actualWeight, setActualWeight] = useState("");
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [workoutTime, setWorkoutTime] = useState(0);
  const [heartRate] = useState(120); //todo: remove mock functionality

  const currentExercise = exercises[currentExerciseIndex];
  const isLastSet = currentSet === currentExercise.sets;
  const isLastExercise = currentExerciseIndex === exercises.length - 1;

  useEffect(() => {
    const timer = setInterval(() => setWorkoutTime(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSetComplete = () => {
    if (!actualReps || !actualWeight) return;

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

  const progressPercent = ((currentExerciseIndex * currentExercise.sets + currentSet) / 
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
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">{currentExercise.name}</h2>
          
          <div className="aspect-video bg-muted rounded-lg mb-6 flex items-center justify-center">
            <Button variant="outline" size="lg" data-testid="button-play-video">
              <Play className="h-6 w-6 mr-2" />
              Watch Form Video
            </Button>
          </div>

          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Set {currentSet} of {currentExercise.sets}</p>
              <div className="space-y-2">
                <p className="text-lg">
                  <span className="text-muted-foreground">Recommended: </span>
                  <span className="font-bold">{currentExercise.reps} reps × {currentExercise.weight}</span>
                </p>
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
                <Label htmlFor="actual-weight">Actual Weight (lbs)</Label>
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
              {isLastSet && isLastExercise ? "Finish Workout" : isLastSet ? "Next Exercise" : "Next Set"}
            </Button>
          </div>
        </Card>
      </div>

      {showRestTimer && (
        <RestTimerOverlay
          duration={90}
          onComplete={() => setShowRestTimer(false)}
          onSkip={() => setShowRestTimer(false)}
        />
      )}
    </div>
  );
}
