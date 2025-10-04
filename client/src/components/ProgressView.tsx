import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, TrendingUp, Award, Target, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import type { WorkoutSession, User } from "@shared/schema";

interface ProgressViewProps {
  onBack: () => void;
}

export default function ProgressView({ onBack }: ProgressViewProps) {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: sessions, isLoading } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/workout-sessions"],
  });

  const sortedSessions = useMemo(() => sessions?.sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime()) || [], [sessions]);

  const stats = useMemo(() => {
    if (!sortedSessions || sortedSessions.length === 0) return null;

    const completedSessions = sortedSessions.filter(s => s.completed === 1);
    const totalWorkouts = completedSessions.length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let streak = 0;
    let currentDate = new Date(today);
    
    for (let i = 0; i < 365; i++) {
      const hasWorkout = completedSessions.some(s => {
        const sessionDate = new Date(s.sessionDate);
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() === currentDate.getTime();
      });
      
      if (hasWorkout) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    const earliestSession = completedSessions.length > 0 
      ? completedSessions[completedSessions.length - 1] 
      : null;
    const latestSession = completedSessions.length > 0 
      ? completedSessions[0] 
      : null;

    let strengthGain = 0;
    if (earliestSession && latestSession && completedSessions.length >= 2) {
      strengthGain = Math.round(((completedSessions.length - 1) / completedSessions.length) * 100);
    }

    return [
      { label: "Total Workouts", value: totalWorkouts.toString(), icon: Award },
      { label: "Current Streak", value: `${streak} day${streak !== 1 ? 's' : ''}`, icon: TrendingUp },
      { label: "Progress", value: `+${strengthGain}%`, icon: Target },
    ];
  }, [sortedSessions]);

  const strengthData = useMemo(() => {
    if (!sortedSessions || sortedSessions.length === 0) return [];

    const completedSessions = sortedSessions.filter(s => s.completed === 1);

    if (completedSessions.length === 0) return [];

    const weeklyData: { [key: string]: { count: number; week: string } } = {};
    
    completedSessions.forEach((session) => {
      const date = new Date(session.sessionDate);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyData[weekKey]) {
        const weekNum = Object.keys(weeklyData).length + 1;
        weeklyData[weekKey] = { 
          count: 0, 
          week: `Week ${weekNum}` 
        };
      }
      weeklyData[weekKey].count++;
    });

    return Object.values(weeklyData).map((data, index) => ({
      week: data.week,
      workouts: data.count,
      volume: (data.count * 100) + (index * 50),
    }));
  }, [sortedSessions]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b p-4">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Progress Overview</h1>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-24 w-full" />
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b p-4">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Progress Overview</h1>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-6">
          <Card className="p-12 text-center">
            <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Progress Data Yet</h2>
            <p className="text-muted-foreground mb-6">
              Complete your first workout to start tracking your progress. Your workout history, strength gains, and achievements will appear here.
            </p>
            <Button onClick={onBack} data-testid="button-start-workout">
              Start Your First Workout
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Progress Overview</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          {stats && stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-6">
                <Icon className="h-8 w-8 text-primary mb-3" />
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-3xl font-bold" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
                  {stat.value}
                </p>
              </Card>
            );
          })}
        </div>

        {strengthData.length > 0 && (
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-6">Workout Activity</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={strengthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="workouts"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  name="Workouts Completed"
                />
                <Line
                  type="monotone"
                  dataKey="volume"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  name="Estimated Volume"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {user && (user.bmr || user.targetCalories || user.nutritionGoal) && (
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">Nutrition Summary</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {user.bmr && (
                <div>
                  <p className="text-sm text-muted-foreground">BMR</p>
                  <p className="text-2xl font-bold">{user.bmr.toLocaleString()} cal</p>
                </div>
              )}
              {user.targetCalories && (
                <div>
                  <p className="text-sm text-muted-foreground">Daily Target</p>
                  <p className="text-2xl font-bold">{user.targetCalories.toLocaleString()} cal</p>
                </div>
              )}
              {user.nutritionGoal && (
                <div>
                  <p className="text-sm text-muted-foreground">Goal</p>
                  <p className="text-2xl font-bold capitalize">{user.nutritionGoal}</p>
                </div>
              )}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
