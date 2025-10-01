import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dumbbell, Calendar, TrendingUp, History, Play } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

interface DashboardProps {
  onStartWorkout: () => void;
  onViewProgram: () => void;
  onViewHistory: () => void;
  onViewProgress: () => void;
}

export default function Dashboard({
  onStartWorkout,
  onViewProgram,
  onViewHistory,
  onViewProgress,
}: DashboardProps) {
  //todo: remove mock functionality
  const currentProgram = {
    name: "Intermediate Strength Program",
    currentWeek: 3,
    totalWeeks: 12,
    nextWorkout: "Upper Body Power",
    workoutsCompleted: 24,
    totalWorkouts: 48,
  };

  const weekProgress = (currentProgram.currentWeek / currentProgram.totalWeeks) * 100;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Dumbbell className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">FitForge</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-3xl font-bold mb-2">Welcome back!</h2>
          <p className="text-muted-foreground">Ready to crush your next workout?</p>
        </div>

        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold mb-1">{currentProgram.name}</h3>
              <p className="text-muted-foreground">Week {currentProgram.currentWeek} of {currentProgram.totalWeeks}</p>
            </div>
            <Button
              variant="outline"
              onClick={onViewProgram}
              data-testid="button-view-program"
            >
              View Program
            </Button>
          </div>
          
          <Progress value={weekProgress} className="h-2 mb-2" />
          <p className="text-sm text-muted-foreground">
            {currentProgram.workoutsCompleted} of {currentProgram.totalWorkouts} workouts completed
          </p>
        </Card>

        <div className="grid md:grid-cols-3 gap-4">
          <Card className="p-6">
            <Calendar className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Next Workout</h3>
            <p className="text-2xl font-bold mb-3">{currentProgram.nextWorkout}</p>
            <Button
              className="w-full"
              size="lg"
              onClick={onStartWorkout}
              data-testid="button-start-workout"
            >
              <Play className="h-4 w-4 mr-2" />
              Start Workout
            </Button>
          </Card>

          <Card className="p-6 hover-elevate cursor-pointer" onClick={onViewHistory} data-testid="card-history">
            <History className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Workout History</h3>
            <p className="text-2xl font-bold mb-3">24</p>
            <p className="text-sm text-muted-foreground">Total workouts completed</p>
          </Card>

          <Card className="p-6 hover-elevate cursor-pointer" onClick={onViewProgress} data-testid="card-progress">
            <TrendingUp className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Progress</h3>
            <p className="text-2xl font-bold mb-3">+12%</p>
            <p className="text-sm text-muted-foreground">Overall strength gain</p>
          </Card>
        </div>
      </main>
    </div>
  );
}
