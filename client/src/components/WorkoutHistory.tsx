import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Clock, Dumbbell } from "lucide-react";

interface WorkoutHistoryProps {
  onBack: () => void;
}

export default function WorkoutHistory({ onBack }: WorkoutHistoryProps) {
  //todo: remove mock functionality
  const workouts = [
    {
      id: "1",
      name: "Upper Body Power",
      date: "2025-09-28",
      duration: 45,
      exercises: 6,
      volume: 5420,
      difficulty: 3,
    },
    {
      id: "2",
      name: "Lower Body Strength",
      date: "2025-09-26",
      duration: 52,
      exercises: 5,
      volume: 6200,
      difficulty: 4,
    },
    {
      id: "3",
      name: "Full Body Circuit",
      date: "2025-09-24",
      duration: 38,
      exercises: 8,
      volume: 4100,
      difficulty: 2,
    },
  ];

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return "success";
    if (difficulty === 3) return "secondary";
    return "destructive";
  };

  const getDifficultyLabel = (difficulty: number) => {
    const labels = ["", "Very Easy", "Easy", "Moderate", "Hard", "Very Hard"];
    return labels[difficulty] || "Moderate";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Workout History</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-4">
        {workouts.map((workout) => (
          <Card key={workout.id} className="p-6 hover-elevate" data-testid={`workout-${workout.id}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold mb-1">{workout.name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {new Date(workout.date).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </div>
              </div>
              <Badge variant={getDifficultyColor(workout.difficulty) as any}>
                {getDifficultyLabel(workout.difficulty)}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-semibold">{workout.duration} min</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Exercises</p>
                  <p className="font-semibold">{workout.exercises}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4" />
                <div>
                  <p className="text-sm text-muted-foreground">Volume</p>
                  <p className="font-semibold">{workout.volume.toLocaleString()} lbs</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </main>
    </div>
  );
}
