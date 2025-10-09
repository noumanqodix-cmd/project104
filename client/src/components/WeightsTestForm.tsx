import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

interface WeightsTestFormProps {
  onComplete: (results: WeightsTestResults) => void;
  onBack?: () => void;
}

export interface WeightsTestResults {
  squat: number;
  deadlift: number;
  benchPress: number;
  overheadPress: number;
  row: number;
  dumbbellLunge: number;
  plankHold: number;
  farmersCarry: number;
  mileTime: number;
}

const exercises = [
  { id: "squat", label: "Squat", description: "1 rep max" },
  { id: "deadlift", label: "Deadlift", description: "1 rep max" },
  { id: "benchPress", label: "Bench Press", description: "1 rep max" },
  { id: "overheadPress", label: "Overhead Press", description: "1 rep max" },
  { id: "row", label: "Barbell Row", description: "1 rep max" },
  { id: "dumbbellLunge", label: "Dumbbell Lunge", description: "1 rep max per hand" },
  { id: "plankHold", label: "Plank Hold", description: "max time" },
  { id: "farmersCarry", label: "Farmer's Carry", description: "1 rep max per hand" },
  { id: "mileTime", label: "Mile Run", description: "time" },
];

export default function WeightsTestForm({ onComplete, onBack }: WeightsTestFormProps) {
  const [currentExercise, setCurrentExercise] = useState(0);
  const [results, setResults] = useState<Partial<WeightsTestResults>>({});
  const [value, setValue] = useState("");
  
  const unitPreference = localStorage.getItem('unitPreference') || 'imperial';
  const weightUnit = unitPreference === 'imperial' ? 'lbs' : 'kg';

  const exercise = exercises[currentExercise];

  const handleNext = () => {
    const numValue = parseFloat(value);
    if (!numValue || numValue <= 0) return;

    const newResults = { ...results, [exercise.id]: numValue };
    setResults(newResults);
    setValue("");

    if (currentExercise < exercises.length - 1) {
      setCurrentExercise(currentExercise + 1);
    } else {
      onComplete(newResults as WeightsTestResults);
    }
  };

  const handleDontKnow = () => {
    // Set beginner-level default values for "Don't Know"
    const beginnerDefaults: Record<string, number> = {
      squat: unitPreference === 'imperial' ? 95 : 43,
      deadlift: unitPreference === 'imperial' ? 135 : 61,
      benchPress: unitPreference === 'imperial' ? 65 : 29,
      overheadPress: unitPreference === 'imperial' ? 45 : 20,
      row: unitPreference === 'imperial' ? 65 : 29,
      dumbbellLunge: unitPreference === 'imperial' ? 25 : 11,
      plankHold: 20,
      farmersCarry: unitPreference === 'imperial' ? 35 : 16,
      mileTime: 15,
    };

    const newResults = { ...results, [exercise.id]: beginnerDefaults[exercise.id] || 45 };
    setResults(newResults);
    setValue("");

    if (currentExercise < exercises.length - 1) {
      setCurrentExercise(currentExercise + 1);
    } else {
      onComplete(newResults as WeightsTestResults);
    }
  };

  const handleBack = () => {
    if (currentExercise > 0) {
      setCurrentExercise(currentExercise - 1);
      setValue("");
    } else if (onBack) {
      onBack();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-8 max-w-lg w-full">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">{exercise.label}</h2>
          <p className="text-muted-foreground">
            {currentExercise + 1} of {exercises.length}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{exercise.description}</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="value" className="text-base">
              {exercise.id === 'plankHold' ? "How long can you hold?" :
               exercise.id === 'mileTime' ? "What's your time?" : 
               "What's your max weight?"}
            </Label>
            <Input
              id="value"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              placeholder={exercise.id === 'plankHold' ? "Enter seconds" :
                          exercise.id === 'mileTime' ? "Enter minutes" :
                          "Enter weight"}
              className="text-4xl text-center h-20 font-mono"
              autoFocus
              data-testid="input-test-value"
            />
            <p className="text-sm text-muted-foreground text-center">
              {exercise.id === 'plankHold' ? 'seconds' :
               exercise.id === 'mileTime' ? 'minutes' :
               unitPreference === 'imperial' ? 'pounds (lbs)' : 'kilograms (kg)'}
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={handleDontKnow}
              data-testid="button-dont-know"
            >
              Don't Know
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={handleNext}
              disabled={!value || parseFloat(value) <= 0}
              data-testid="button-next-exercise"
            >
              {currentExercise < exercises.length - 1 ? "Next" : "Complete"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
