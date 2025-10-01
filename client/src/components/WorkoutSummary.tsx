import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Clock, Dumbbell, TrendingUp } from "lucide-react";
import { Smile, Meh, Frown } from "lucide-react";

interface WorkoutSummaryProps {
  duration: number;
  exercises: number;
  totalVolume: number;
  onFinish: (difficulty: number) => void;
}

export default function WorkoutSummary({
  duration,
  exercises,
  totalVolume,
  onFinish,
}: WorkoutSummaryProps) {
  const [difficulty, setDifficulty] = useState<number | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  const difficultyOptions = [
    { value: 1, label: "Very Easy", icon: Smile, color: "text-success" },
    { value: 2, label: "Easy", icon: Smile, color: "text-success" },
    { value: 3, label: "Moderate", icon: Meh, color: "text-warning" },
    { value: 4, label: "Hard", icon: Frown, color: "text-destructive" },
    { value: 5, label: "Very Hard", icon: Frown, color: "text-destructive" },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/20 p-6 rounded-full">
              <Trophy className="h-16 w-16 text-primary" />
            </div>
          </div>
          <h2 className="text-4xl font-bold mb-2">Workout Complete!</h2>
          <p className="text-lg text-muted-foreground">Great job crushing it today</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center p-4 border rounded-lg">
            <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{formatDuration(duration)}</p>
            <p className="text-sm text-muted-foreground">Duration</p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <Dumbbell className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{exercises}</p>
            <p className="text-sm text-muted-foreground">Exercises</p>
          </div>
          <div className="text-center p-4 border rounded-lg">
            <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{totalVolume.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Total Volume</p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-center font-semibold">How hard was this workout?</p>
          <div className="flex justify-center gap-4">
            {difficultyOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = difficulty === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => setDifficulty(option.value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover-elevate ${
                    isSelected ? "border-primary bg-primary/10" : "border-transparent"
                  }`}
                  data-testid={`button-difficulty-${option.value}`}
                >
                  <Icon className={`h-8 w-8 ${isSelected ? "text-primary" : option.color}`} />
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>

          <Button
            size="lg"
            className="w-full mt-6"
            onClick={() => difficulty && onFinish(difficulty)}
            disabled={!difficulty}
            data-testid="button-done"
          >
            Done
          </Button>
        </div>
      </Card>
    </div>
  );
}
