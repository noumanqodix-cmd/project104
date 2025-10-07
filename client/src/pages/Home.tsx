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

  const skipDayMutation = useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      return await apiRequest("PATCH", `/api/workout-sessions/${sessionId}`, {
        completed: 1,
        status: "skipped",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/program-workouts", activeProgram?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Skip",
        description: error.message || "Failed to skip day",
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
  const totalCompletedSessions = completedSessions.length;

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getDayName = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getStartOfWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0 days back, Sunday = 6 days back
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - diff);
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  };

  const sessionsThisWeek = sessions?.filter((s: any) => {
    if (!s.scheduledDate) return false;
    const scheduledDate = new Date(s.scheduledDate);
    return scheduledDate >= getStartOfWeek();
  }) || [];

  // Find the next actionable session (prioritize today, then upcoming, then past due)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Find calendar-based sessions (with scheduledDate)
  const nextSession = sessions
    ?.filter((s: any) => s.completed === 0 && s.scheduledDate)
    .sort((a: any, b: any) => {
      const dateA = new Date(a.scheduledDate).getTime();
      const dateB = new Date(b.scheduledDate).getTime();
      
      // Prioritize today's session, then upcoming, then past due
      const aDate = new Date(a.scheduledDate);
      aDate.setHours(0, 0, 0, 0);
      const bDate = new Date(b.scheduledDate);
      bDate.setHours(0, 0, 0, 0);
      
      const aIsToday = aDate.getTime() === today.getTime();
      const bIsToday = bDate.getTime() === today.getTime();
      const aIsFuture = aDate.getTime() > today.getTime();
      const bIsFuture = bDate.getTime() > today.getTime();
      
      // Today's workout comes first
      if (aIsToday && !bIsToday) return -1;
      if (!aIsToday && bIsToday) return 1;
      
      // Future workouts come before past due
      if (aIsFuture && !bIsFuture) return -1;
      if (!aIsFuture && bIsFuture) return 1;
      
      // Within same category, sort by date
      return dateA - dateB;
    })[0];

  const nextWorkout = nextSession ? programWorkouts?.find(w => w.id === nextSession.programWorkoutId) : null;
  const isRestDay = nextWorkout?.workoutType === "rest" || false;
  
  const isToday = nextSession && nextSession.scheduledDate ? 
    new Date(nextSession.scheduledDate).toDateString() === today.toDateString() : 
    false;
  
  const isPastDue = nextSession && nextSession.scheduledDate && !isToday ? 
    (() => {
      const sessionDate = new Date(nextSession.scheduledDate);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate < today;
    })() : 
    false;
  
  const isProgramComplete = () => {
    if (!sessions || sessions.length === 0) return false;
    // Program is complete if all sessions are completed
    return sessions.every((s: any) => s.completed === 1);
  };

  const programComplete = isProgramComplete();

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

  // Get last completed workout details
  const getLastCompletedWorkout = () => {
    if (completedSessions.length === 0) return null;
    const lastSession = completedSessions.reduce((latest: any, session: any) => {
      const sessionDate = new Date(session.sessionDate);
      const latestDate = new Date(latest.sessionDate);
      return sessionDate > latestDate ? session : latest;
    });
    const workout = programWorkouts?.find(w => w.id === lastSession.programWorkoutId);
    return { session: lastSession, workout };
  };

  const lastCompletedWorkout = getLastCompletedWorkout();

  const sessionsThisWeekCount = sessionsThisWeek.length;

  const avgDuration = completedSessions.length > 0
    ? Math.round(
        completedSessions.reduce((sum: number, s: any) => sum + (s.durationMinutes || 0), 0) / 
        completedSessions.length
      )
    : 0;
  
  const stats = [
    { label: "Sessions This Week", value: sessionsThisWeekCount.toString(), icon: Dumbbell },
    { label: "Total Sessions", value: totalCompletedSessions.toString(), icon: Target },
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
            <p className="text-muted-foreground" data-testid="text-current-date">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
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
                <CardTitle>
                  {isToday
                    ? "Today's Workout"
                    : isPastDue
                    ? "Missed Workout"
                    : "Upcoming Workout"}
                </CardTitle>
                <CardDescription>
                  {nextSession?.scheduledDate ? formatDate(nextSession.scheduledDate) : "No scheduled workout"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {nextSession && nextWorkout ? (
                  isRestDay ? (
                    <>
                      <div className="text-center py-2">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                          <Calendar className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold text-lg mb-1" data-testid="text-rest-day">Rest Day</h3>
                        <p className="text-sm text-muted-foreground">
                          Recovery is part of the program
                        </p>
                      </div>
                      <Button 
                        variant="outline"
                        size="lg"
                        className="w-full"
                        onClick={() => {
                          if (!nextSession?.id) {
                            toast({
                              title: "Error",
                              description: "Session data not loaded. Please refresh.",
                              variant: "destructive",
                            });
                            return;
                          }
                          skipDayMutation.mutate({ sessionId: nextSession.id });
                        }}
                        disabled={skipDayMutation.isPending}
                        data-testid="button-skip-rest"
                      >
                        <SkipForward className="h-5 w-5 mr-2" />
                        {skipDayMutation.isPending ? "Completing..." : "Complete Rest Day"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div>
                        <h3 className="font-semibold text-lg mb-1" data-testid="text-workout-name">{nextWorkout?.workoutName}</h3>
                        <p className="text-sm text-muted-foreground">
                          Focus: {nextWorkout?.movementFocus.join(", ")}
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
                          onClick={() => {
                            if (!nextSession?.id) {
                              toast({
                                title: "Error",
                                description: "Session data not loaded. Please refresh.",
                                variant: "destructive",
                              });
                              return;
                            }
                            skipDayMutation.mutate({ sessionId: nextSession.id });
                          }}
                          disabled={skipDayMutation.isPending || !nextSession?.id}
                          data-testid="button-skip-workout"
                        >
                          <SkipForward className="h-5 w-5" />
                        </Button>
                      </div>
                    </>
                  )
                ) : isProgramComplete() ? (
                  <div className="text-center py-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                      <Target className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-1" data-testid="text-program-complete">Program Complete!</h3>
                    <p className="text-sm text-muted-foreground">Congratulations on completing your {activeProgram?.durationWeeks}-week program</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Generate a new program to continue your fitness journey
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {lastCompletedWorkout && (
              <Card>
                <CardHeader>
                  <CardTitle>Last Completed</CardTitle>
                  <CardDescription>Your most recent session</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-semibold" data-testid="text-last-workout-name">
                      {lastCompletedWorkout.workout?.workoutType === "rest" 
                        ? "Rest Day" 
                        : lastCompletedWorkout.workout?.workoutName || "Session"}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-last-workout-date">
                      {formatDate(lastCompletedWorkout.session.sessionDate)}
                    </p>
                    {lastCompletedWorkout.session.durationMinutes && (
                      <p className="text-sm text-muted-foreground">
                        Duration: {lastCompletedWorkout.session.durationMinutes} minutes
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

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
