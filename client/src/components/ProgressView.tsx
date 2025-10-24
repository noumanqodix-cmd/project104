import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, TrendingUp, Award, Target, AlertCircle, Dumbbell, Flame } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import type { WorkoutSession, User, FitnessAssessment } from "@shared/schema";
import { formatLocalDate } from "@shared/dateUtils";

interface ProgressViewProps {
  onBack: () => void;
}

export default function ProgressView({ onBack }: ProgressViewProps) {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/workout-sessions"],
  });

  const { data: assessments, isLoading: assessmentsLoading } = useQuery<FitnessAssessment[]>({
    queryKey: ["/api/fitness-assessments"],
  });

  const isLoading = sessionsLoading || assessmentsLoading;

  const sortedSessions = useMemo(() => sessions?.sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime()) || [], [sessions]);

  const stats = useMemo(() => {
    if (!sortedSessions || sortedSessions.length === 0) return null;

    const completedSessions = sortedSessions.filter(s => s.status === 'complete');
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

    const completedSessions = sortedSessions.filter(s => s.status === 'complete');

    if (completedSessions.length === 0) return [];

    const weeklyData: { [key: string]: { count: number; weekStart: Date; weekEnd: Date } } = {};
    
    completedSessions.forEach((session) => {
      const date = new Date(session.sessionDate);
      // Calculate week start (Monday) and end (Sunday)
      const currentDay = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
      
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - daysFromMonday);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekKey = formatLocalDate(weekStart);
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { 
          count: 0, 
          weekStart,
          weekEnd
        };
      }
      weeklyData[weekKey].count++;
    });

    return Object.entries(weeklyData)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([_, data], index) => {
        // Check if the week spans two different months
        const startMonth = data.weekStart.getMonth();
        const endMonth = data.weekEnd.getMonth();
        const weekLabel = startMonth === endMonth
          ? `${format(data.weekStart, 'MMM d')} - ${format(data.weekEnd, 'd')}`
          : `${format(data.weekStart, 'MMM d')} - ${format(data.weekEnd, 'MMM d')}`;
        
        return {
          week: weekLabel,
          workouts: data.count,
          volume: (data.count * 100) + (index * 50),
        };
      });
  }, [sortedSessions]);

  const caloriesData = useMemo(() => {
    if (!sortedSessions || sortedSessions.length === 0) return [];

    const completedSessions = sortedSessions.filter(s => s.status === 'complete' && s.caloriesBurned);

    if (completedSessions.length === 0) return [];

    const weeklyData: { [key: string]: { calories: number; weekStart: Date; weekEnd: Date } } = {};
    
    completedSessions.forEach((session) => {
      const date = new Date(session.sessionDate);
      const currentDay = date.getDay();
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
      
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - daysFromMonday);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekKey = formatLocalDate(weekStart);
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { 
          calories: 0, 
          weekStart,
          weekEnd
        };
      }
      weeklyData[weekKey].calories += session.caloriesBurned || 0;
    });

    return Object.entries(weeklyData)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([_, data]) => {
        const startMonth = data.weekStart.getMonth();
        const endMonth = data.weekEnd.getMonth();
        const weekLabel = startMonth === endMonth
          ? `${format(data.weekStart, 'MMM d')} - ${format(data.weekEnd, 'd')}`
          : `${format(data.weekStart, 'MMM d')} - ${format(data.weekEnd, 'MMM d')}`;
        
        return {
          week: weekLabel,
          calories: Math.round(data.calories),
        };
      });
  }, [sortedSessions]);

  const fitnessTestProgress = useMemo(() => {
    if (!assessments || assessments.length < 2) return null;

    const latest = assessments[0];
    const previous = assessments[1];

    const getImprovement = (current: number, previous: number, lowerIsBetter = false) => {
      const diff = current - previous;
      const percentChange = ((diff / previous) * 100).toFixed(1);
      const isImprovement = lowerIsBetter ? diff < 0 : diff > 0;
      return {
        diff,
        percent: percentChange,
        isImprovement,
      };
    };

    const metrics = [];

    if (latest.pushups !== null && previous.pushups !== null) {
      const improvement = getImprovement(latest.pushups, previous.pushups);
      metrics.push({
        name: "Push-ups",
        current: latest.pushups,
        improvement,
      });
    }

    if (latest.pullups !== null && previous.pullups !== null) {
      const improvement = getImprovement(latest.pullups, previous.pullups);
      metrics.push({
        name: "Pull-ups",
        current: latest.pullups,
        improvement,
      });
    }

    if (latest.squats !== null && previous.squats !== null) {
      const improvement = getImprovement(latest.squats, previous.squats);
      metrics.push({
        name: "Air Squats",
        current: latest.squats,
        improvement,
      });
    }

    if (latest.mileTime !== null && previous.mileTime !== null) {
      const improvement = getImprovement(latest.mileTime, previous.mileTime, true);
      metrics.push({
        name: "Mile Time",
        current: `${latest.mileTime} min`,
        improvement,
      });
    }

    const unitPreference = user?.unitPreference || 'imperial';
    const weightUnit = unitPreference === 'imperial' ? 'lbs' : 'kg';

    if (latest.squat1rm !== null && previous.squat1rm !== null) {
      const improvement = getImprovement(latest.squat1rm, previous.squat1rm);
      metrics.push({
        name: "Squat",
        current: `${latest.squat1rm} ${weightUnit}`,
        improvement,
      });
    }

    if (latest.deadlift1rm !== null && previous.deadlift1rm !== null) {
      const improvement = getImprovement(latest.deadlift1rm, previous.deadlift1rm);
      metrics.push({
        name: "Deadlift",
        current: `${latest.deadlift1rm} ${weightUnit}`,
        improvement,
      });
    }

    if (latest.benchPress1rm !== null && previous.benchPress1rm !== null) {
      const improvement = getImprovement(latest.benchPress1rm, previous.benchPress1rm);
      metrics.push({
        name: "Bench Press",
        current: `${latest.benchPress1rm} ${weightUnit}`,
        improvement,
      });
    }

    return metrics.length > 0 ? metrics : null;
  }, [assessments, user]);

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

        {caloriesData.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Flame className="h-5 w-5 text-orange-500" />
              <h3 className="text-xl font-semibold">Calories Burned</h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={caloriesData}>
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
                  dataKey="calories"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2}
                  name="Calories Burned"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {fitnessTestProgress && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Award className="h-5 w-5 text-primary" />
              <h3 className="text-xl font-semibold">Fitness Test Progress</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {fitnessTestProgress.map((metric) => (
                <div key={metric.name}>
                  <p className="text-sm text-muted-foreground mb-1">{metric.name}</p>
                  <p className="text-2xl font-bold mb-1" data-testid={`progress-${metric.name.toLowerCase().replace(/\s+/g, '-')}`}>
                    {metric.current}
                  </p>
                  <p className={`text-sm ${metric.improvement.isImprovement ? "text-green-500" : "text-red-500"}`}>
                    {metric.improvement.diff > 0 ? "+" : ""}
                    {metric.improvement.diff} ({metric.improvement.percent}%)
                  </p>
                </div>
              ))}
            </div>
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
