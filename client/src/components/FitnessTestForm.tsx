import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

interface FitnessTestFormProps {
  onComplete: (results: FitnessTestResults) => void;
  onBack?: () => void;
}

export interface FitnessTestResults {
  pushups: number;
  pullups: number;
  squats: number;
  mileTime: number;
}

const exercises = [
  { id: "pushups", label: "Push-ups", unit: "reps" },
  { id: "pullups", label: "Pull-ups", unit: "reps" },
  { id: "squats", label: "Air Squats", unit: "reps" },
  { id: "mileTime", label: "Mile Run Time", unit: "minutes" },
];

export default function FitnessTestForm({ onComplete, onBack }: FitnessTestFormProps) {
  const [currentExercise, setCurrentExercise] = useState(0);
  const [results, setResults] = useState<Partial<FitnessTestResults>>({});
  const [value, setValue] = useState("");

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
      onComplete(newResults as FitnessTestResults);
    }
  };

  const handleDontKnow = () => {
    // Set beginner-level default values for "Don't Know"
    const beginnerDefaults: Record<string, number> = {
      pushups: 5,
      pullups: 0,
      squats: 10,
      mileTime: 15,
    };

    const newResults = { ...results, [exercise.id]: beginnerDefaults[exercise.id] || 1 };
    setResults(newResults);
    setValue("");

    if (currentExercise < exercises.length - 1) {
      setCurrentExercise(currentExercise + 1);
    } else {
      onComplete(newResults as FitnessTestResults);
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
        {onBack && (
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
        )}

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">{exercise.label}</h2>
          <p className="text-muted-foreground">
            {currentExercise + 1} of {exercises.length}
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="value" className="text-base">
              How many {exercise.unit} can you do?
            </Label>
            <Input
              id="value"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              placeholder="Enter number"
              className="text-4xl text-center h-20 font-mono"
              autoFocus
              data-testid="input-test-value"
            />
            <p className="text-sm text-muted-foreground text-center">
              {exercise.unit}
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
