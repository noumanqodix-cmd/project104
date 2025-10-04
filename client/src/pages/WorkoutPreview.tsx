import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Repeat, TrendingUp, Info } from "lucide-react";
import { Link, useLocation } from "wouter";
import ExerciseSwapDialog from "@/components/ExerciseSwapDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  lastRir?: number;
  weightIncrease?: number;
}

export default function WorkoutPreview() {
  const [, setLocation] = useLocation();
  const unitPreference = localStorage.getItem('unitPreference') || 'imperial';
  const weightUnit = unitPreference === 'imperial' ? 'lbs' : 'kg';
  
  const [exercises, setExercises] = useState<Exercise[]>([
    { 
      id: "1", 
      name: "Barbell Bench Press", 
      equipment: "barbell", 
      sets: 4, 
      reps: "8-10", 
      weight: `135 ${weightUnit}`, 
      tempo: "1-1-1-1", 
      rpe: 8, 
      formVideoUrl: "#",
      lastRir: 4,
      weightIncrease: 5
    },
    { 
      id: "2", 
      name: "Dumbbell Shoulder Press", 
      equipment: "dumbbells", 
      sets: 3, 
      reps: "10-12", 
      weight: `30 ${weightUnit}`, 
      tempo: "1-1-1-1", 
      rpe: 7, 
      formVideoUrl: "#",
      lastRir: 6,
      weightIncrease: 10
    },
    { 
      id: "3", 
      name: "Cable Tricep Pushdown", 
      equipment: "cable", 
      sets: 3, 
      reps: "12-15", 
      weight: `60 ${weightUnit}`, 
      tempo: "1-1-1-1", 
      rpe: 8, 
      formVideoUrl: "#",
      lastRir: 2,
      weightIncrease: 0
    },
  ]);

  const [swapExercise, setSwapExercise] = useState<Exercise | null>(null);

  const handleSwap = (newExercise: Exercise) => {
    setExercises(prev =>
      prev.map(ex => ex.id === swapExercise?.id ? { ...newExercise, id: swapExercise.id } : ex)
    );
    setSwapExercise(null);
  };

  const getWeightIncreaseRecommendation = (rir?: number) => {
    if (!rir) return 0;
    if (rir >= 5) return 10;
    if (rir >= 3) return 5;
    return 0;
  };

  const hasWeightIncreases = exercises.some(ex => ex.weightIncrease && ex.weightIncrease > 0);

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
            <p className="text-muted-foreground">Push Day A - Review and edit</p>
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
                      <p className="text-sm text-muted-foreground">Recommended Weight</p>
                      <p className="text-lg font-bold" data-testid={`weight-${index}`}>
                        {exercise.weight}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Equipment</p>
                      <p className="text-lg font-medium capitalize">{exercise.equipment}</p>
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

                  {recommendedIncrease > 0 && (
                    <div className="mt-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <TrendingUp className="h-4 w-4 text-primary mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-primary">Weight Increase Recommended</p>
                          <p className="text-sm text-muted-foreground mt-1" data-testid={`recommendation-${index}`}>
                            Last workout: {exercise.lastRir} reps in reserve. Add {recommendedIncrease} {weightUnit} for progressive overload.
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
          exercise={swapExercise}
          onSwap={handleSwap}
          onClose={() => setSwapExercise(null)}
        />
      )}
    </div>
  );
}
