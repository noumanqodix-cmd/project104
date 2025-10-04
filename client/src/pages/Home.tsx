import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar, Dumbbell, Target, TrendingUp, Settings } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const currentProgram = {
    name: "Upper Body Strength",
    week: 3,
    totalWeeks: 8,
    nextWorkout: "Push Day A",
    nextWorkoutDate: "Today",
    completedWorkouts: 16,
    totalWorkouts: 48,
  };

  const weekProgress = (currentProgram.week / currentProgram.totalWeeks) * 100;
  const workoutProgress = (currentProgram.completedWorkouts / currentProgram.totalWorkouts) * 100;

  const stats = [
    { label: "Workouts This Week", value: "3", icon: Dumbbell },
    { label: "Total Workouts", value: currentProgram.completedWorkouts.toString(), icon: Target },
    { label: "Avg Duration", value: "45 min", icon: Calendar },
    { label: "Streak", value: "7 days", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome Back!</h1>
            <p className="text-muted-foreground">Ready to crush your next workout?</p>
          </div>
          <Link href="/settings">
            <Button variant="ghost" size="icon" data-testid="button-settings">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{currentProgram.name}</CardTitle>
            <CardDescription>Week {currentProgram.week} of {currentProgram.totalWeeks}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Program Progress</span>
                <span className="font-medium">{currentProgram.week}/{currentProgram.totalWeeks} weeks</span>
              </div>
              <Progress value={weekProgress} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Workouts Complete</span>
                <span className="font-medium">{currentProgram.completedWorkouts}/{currentProgram.totalWorkouts}</span>
              </div>
              <Progress value={workoutProgress} className="h-2" />
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm text-muted-foreground">Next Workout</p>
                  <p className="font-semibold text-lg">{currentProgram.nextWorkout}</p>
                  <p className="text-sm text-muted-foreground">{currentProgram.nextWorkoutDate}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Link href="/workout-preview">
                  <Button variant="outline" className="w-full" data-testid="button-view-edit-workout">
                    View and Edit Workout
                  </Button>
                </Link>
                <Link href="/workout">
                  <Button className="w-full" size="lg" data-testid="button-start-workout">
                    Start Workout
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
                        {stat.value}
                      </p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/program">
              <Button variant="outline" className="w-full justify-start" data-testid="button-view-program">
                <Calendar className="h-4 w-4 mr-2" />
                View Full Program
              </Button>
            </Link>
            <Link href="/history">
              <Button variant="outline" className="w-full justify-start" data-testid="button-view-history">
                <TrendingUp className="h-4 w-4 mr-2" />
                View Progress
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
