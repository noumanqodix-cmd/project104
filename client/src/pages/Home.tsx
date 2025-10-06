import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar, Dumbbell, Target, TrendingUp, Settings, Sparkles, PlayCircle, SkipForward } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WorkoutProgram, WorkoutSession, ProgramWorkout, User } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: activeProgram, isLoading: programLoading } = useQuery<WorkoutProgram>({
    queryKey: ["/api/programs/active"],
  });

  const { data: sessions } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/workout-sessions"],
  });

  const { data: programWorkouts } = useQuery<ProgramWorkout[]>({
    queryKey: ["/api/program-workouts", activeProgram?.id],
    enabled: !!activeProgram?.id,
  });

  const skipWorkoutMutation = useMutation({
    mutationFn: async (workoutId: string) => {
      return await apiRequest("POST", "/api/workout-sessions", {
        programWorkoutId: workoutId,
        completed: 1,
        status: "skipped",
        notes: "Skipped",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/program-workouts", activeProgram?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Skip",
        description: error.message || "Failed to skip workout",
        variant: "destructive",
      });
    },
  });

  const generateProgramMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/programs/generate", {});
    },
    onSuccess: () => {
      toast({
        title: "AI Program Generated!",
        description: "Your personalized workout program is ready.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/programs/active"] });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate workout program",
        variant: "destructive",
      });
    },
  });

  const completedSessions = sessions?.filter((s: any) => s.completed) || [];
  const completedWorkouts = completedSessions.length;

  const getDayName = (dayOfWeek: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek % 7];
  };

  const getTodayISODay = () => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 7 : jsDay;
  };

  const getStartOfWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diff);
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  };

  const sessionsThisWeek = sessions?.filter((s: any) => {
    const sessionDate = new Date(s.sessionDate);
    return sessionDate >= getStartOfWeek();
  }) || [];

  const completedWorkoutIdsThisWeek = new Set(
    sessionsThisWeek
      .filter((s: any) => s.completed === 1)
      .map((s: any) => s.programWorkoutId)
  );

  const todayISODay = getTodayISODay();
  
  const getActionableWorkout = () => {
    if (!programWorkouts || programWorkouts.length === 0) return null;
    
    const uncompletedWorkouts = programWorkouts.filter(w => !completedWorkoutIdsThisWeek.has(w.id));
    
    if (uncompletedWorkouts.length === 0) return null;
    
    const categorizeWorkout = (workout: any) => {
      if (workout.dayOfWeek === todayISODay) return 'current';
      if (workout.dayOfWeek < todayISODay) return 'backlog';
      if (workout.dayOfWeek > todayISODay) {
        const daysUntil = workout.dayOfWeek - todayISODay;
        const daysSince = (todayISODay + 7) - workout.dayOfWeek;
        return daysSince < daysUntil ? 'backlog' : 'future';
      }
      return 'future';
    };
    
    const backlog = uncompletedWorkouts.filter(w => categorizeWorkout(w) === 'backlog');
    const current = uncompletedWorkouts.filter(w => categorizeWorkout(w) === 'current');
    const future = uncompletedWorkouts.filter(w => categorizeWorkout(w) === 'future');
    
    const sortedBacklog = [...backlog].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    const sortedFuture = [...future].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    
    if (sortedBacklog.length > 0) {
      return { workout: sortedBacklog[0], isToday: false };
    }
    
    if (current.length > 0) {
      return { workout: current[0], isToday: true };
    }
    
    if (sortedFuture.length > 0) {
      return { workout: sortedFuture[0], isToday: false };
    }
    
    return null;
  };

  const actionableWorkoutInfo = getActionableWorkout();
  const todaysWorkout = actionableWorkoutInfo?.workout;
  const isActuallyToday = actionableWorkoutInfo?.isToday ?? false;
  
  const userScheduledDays = user?.selectedDays || [];
  const isTodayScheduledWorkoutDay = userScheduledDays.includes(todayISODay);
  const allWorkoutsCompletedThisWeek = programWorkouts && programWorkouts.length > 0 && 
    programWorkouts.every(w => completedWorkoutIdsThisWeek.has(w.id));
  
  const todaysWorkoutSession = todaysWorkout && sessions?.find(
    s => s.programWorkoutId === todaysWorkout.id && 
    new Date(s.sessionDate) >= getStartOfWeek()
  );
  const wasSkipped = todaysWorkoutSession?.status === "skipped";

  const nextWorkout = programWorkouts?.find(w => 
    w.dayOfWeek > todayISODay && !completedWorkoutIdsThisWeek.has(w.id)
  ) || programWorkouts?.find(w => 
    w.dayOfWeek < todayISODay && !completedWorkoutIdsThisWeek.has(w.id)
  );

  const nextScheduledWorkout = programWorkouts?.find(w => 
    w.dayOfWeek > todayISODay
  ) || programWorkouts?.find(w => 
    w.dayOfWeek < todayISODay
  );

  const getNextWorkoutDay = (fromDay: number) => {
    if (!programWorkouts || programWorkouts.length === 0) return null;
    
    for (let i = 1; i <= 7; i++) {
      const checkDay = ((fromDay + i - 1) % 7) + 1;
      const workout = programWorkouts?.find(w => w.dayOfWeek === checkDay);
      if (workout) {
        return { day: checkDay, workout };
      }
    }
    return null;
  };

  const getNextRestOrWorkoutDay = (fromDay: number) => {
    if (!programWorkouts || programWorkouts.length === 0) return null;
    
    for (let i = 1; i <= 7; i++) {
      const checkDay = ((fromDay + i - 1) % 7) + 1;
      const workout = programWorkouts?.find(w => w.dayOfWeek === checkDay);
      
      if (workout) {
        return { day: checkDay, isRest: false, workout };
      } else if (programWorkouts.length < 7) {
        return { day: checkDay, isRest: true, workout: undefined };
      }
    }
    return null;
  };

  const nextDayInfo = getNextRestOrWorkoutDay(todayISODay);
  const nextWorkoutAfterRestDay = nextDayInfo?.isRest 
    ? getNextWorkoutDay(todayISODay)
    : null;

  const getDaysSinceLastWorkout = () => {
    if (completedSessions.length === 0) return null;
    const lastSession = completedSessions.reduce((latest: any, session: any) => {
      const sessionDate = new Date(session.sessionDate);
      const latestDate = new Date(latest.sessionDate);
      return sessionDate > latestDate ? session : latest;
    });
    const daysSince = Math.floor(
      (Date.now() - new Date(lastSession.sessionDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSince;
  };

  const daysSinceLastWorkout = getDaysSinceLastWorkout();

  const workoutsThisWeek = sessionsThisWeek.length;

  const avgDuration = completedSessions.length > 0
    ? Math.round(
        completedSessions.reduce((sum: number, s: any) => sum + (s.durationMinutes || 0), 0) / 
        completedSessions.length
      )
    : 0;
  
  const stats = [
    { label: "Workouts This Week", value: workoutsThisWeek.toString(), icon: Dumbbell },
    { label: "Total Workouts", value: completedWorkouts.toString(), icon: Target },
    { label: "Avg Duration", value: avgDuration > 0 ? `${avgDuration}m` : "N/A", icon: Calendar },
    { label: "Days Since Last", value: daysSinceLastWorkout !== null ? `${daysSinceLastWorkout} ${daysSinceLastWorkout === 1 ? 'day' : 'days'}` : "N/A", icon: TrendingUp },
  ];

  if (programLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
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

        {!activeProgram ? (
          <Card>
            <CardHeader>
              <CardTitle>No Active Program</CardTitle>
              <CardDescription>Generate a personalized AI-powered workout program tailored to your fitness level, equipment, and goals</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => generateProgramMutation.mutate()}
                disabled={generateProgramMutation.isPending}
                data-testid="button-generate-program"
              >
                <Sparkles className="h-5 w-5 mr-2" />
                {generateProgramMutation.isPending ? "Generating..." : "Generate AI Workout Program"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Today's Workout</CardTitle>
                <CardDescription>
                  {todaysWorkout ? getDayName(todaysWorkout.dayOfWeek) : getDayName(todayISODay)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {todaysWorkout ? (
                  <>
                    <div>
                      <h3 className="font-semibold text-lg mb-1" data-testid="text-workout-name">{todaysWorkout.workoutName}</h3>
                      <p className="text-sm text-muted-foreground">
                        Focus: {todaysWorkout.movementFocus.join(", ")}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1" 
                        size="lg"
                        onClick={() => setLocation('/workout')}
                        data-testid="button-start-workout"
                      >
                        <PlayCircle className="h-5 w-5 mr-2" />
                        Start Workout
                      </Button>
                      <Button 
                        variant="outline"
                        size="lg"
                        onClick={() => skipWorkoutMutation.mutate(todaysWorkout.id)}
                        disabled={skipWorkoutMutation.isPending}
                        data-testid="button-skip-workout"
                      >
                        <SkipForward className="h-5 w-5" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                      {allWorkoutsCompletedThisWeek ? (
                        <Target className="h-6 w-6 text-muted-foreground" />
                      ) : (
                        <Calendar className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    {allWorkoutsCompletedThisWeek ? (
                      <>
                        <h3 className="font-semibold mb-1" data-testid="text-week-complete">Week Complete!</h3>
                        <p className="text-sm text-muted-foreground">All workouts done for this week</p>
                        {nextScheduledWorkout && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Next workout: {getDayName(nextScheduledWorkout.dayOfWeek)}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <h3 className="font-semibold mb-1" data-testid="text-rest-day">Rest Day</h3>
                        <p className="text-sm text-muted-foreground">{getDayName(todayISODay)}</p>
                        {nextWorkout && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Next workout: {getDayName(nextWorkout.dayOfWeek)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current Program</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-semibold" data-testid="text-program-type">{activeProgram.programType}</p>
                  <p className="text-sm text-muted-foreground">{activeProgram.weeklyStructure}</p>
                  <p className="text-sm text-muted-foreground mt-1">{activeProgram.durationWeeks} weeks</p>
                </div>
                <Link href="/program">
                  <Button variant="outline" className="w-full" data-testid="button-view-program-details">
                    View Program Details
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </>
        )}

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
