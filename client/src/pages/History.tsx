import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Dumbbell, TrendingUp } from "lucide-react";
import { format } from "date-fns";

interface WorkoutLog {
  id: number;
  name: string;
  date: Date;
  duration: number;
  exercises: number;
  sets: number;
  difficulty: "easy" | "moderate" | "hard";
  notes?: string;
}

export default function History() {
  const workoutHistory: WorkoutLog[] = [
    {
      id: 1,
      name: "Push Day A",
      date: new Date(2025, 9, 1),
      duration: 48,
      exercises: 6,
      sets: 18,
      difficulty: "moderate",
      notes: "Felt strong on bench press"
    },
    {
      id: 2,
      name: "Pull Day A",
      date: new Date(2025, 8, 30),
      duration: 52,
      exercises: 6,
      sets: 18,
      difficulty: "hard",
    },
    {
      id: 3,
      name: "Leg Day",
      date: new Date(2025, 8, 28),
      duration: 55,
      exercises: 5,
      sets: 15,
      difficulty: "hard",
      notes: "New PR on squats!"
    },
    {
      id: 4,
      name: "Push Day B",
      date: new Date(2025, 8, 26),
      duration: 45,
      exercises: 6,
      sets: 18,
      difficulty: "moderate",
    },
    {
      id: 5,
      name: "Pull Day B",
      date: new Date(2025, 8, 24),
      duration: 50,
      exercises: 6,
      sets: 18,
      difficulty: "moderate",
    },
  ];

  const totalStats = {
    totalWorkouts: workoutHistory.length,
    totalTime: workoutHistory.reduce((sum, w) => sum + w.duration, 0),
    totalSets: workoutHistory.reduce((sum, w) => sum + w.sets, 0),
    avgDuration: Math.round(workoutHistory.reduce((sum, w) => sum + w.duration, 0) / workoutHistory.length),
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "moderate":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "hard":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Workout History</h1>
          <p className="text-muted-foreground">Track your fitness journey</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Dumbbell className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-total-workouts">
                    {totalStats.totalWorkouts}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Workouts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-avg-duration">
                    {totalStats.avgDuration}m
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-total-sets">
                    {totalStats.totalSets}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Sets</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-total-time">
                    {Math.round(totalStats.totalTime / 60)}h
                  </p>
                  <p className="text-xs text-muted-foreground">Total Time</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Recent Workouts</h2>
          {workoutHistory.map((workout) => (
            <Card key={workout.id} className="hover-elevate cursor-pointer" data-testid={`workout-${workout.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{workout.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3" />
                      {format(workout.date, "MMM d, yyyy")}
                    </CardDescription>
                  </div>
                  <Badge className={getDifficultyColor(workout.difficulty)} variant="outline">
                    {workout.difficulty}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {workout.duration} min
                  </div>
                  <div className="flex items-center gap-1">
                    <Dumbbell className="h-3 w-3" />
                    {workout.exercises} exercises
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {workout.sets} sets
                  </div>
                </div>
                {workout.notes && (
                  <p className="text-sm text-muted-foreground italic">{workout.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
