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
    mutationFn: async ({ workoutId, isRestDay }: { workoutId: string; isRestDay: boolean }) => {
      return await apiRequest("POST", "/api/workout-sessions", {
        programWorkoutId: workoutId,
        completed: 1,
        status: "skipped",
        notes: isRestDay ? "Rest Day" : "Skipped",
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
  const userScheduledDays = user?.selectedDays || [];
  
  const completedDaysThisWeek = new Set(
    sessionsThisWeek
      .filter((s: any) => s.completed === 1)
      .map((s: any) => {
        if (s.programWorkoutId) {
          const workout = programWorkouts?.find(w => w.id === s.programWorkoutId);
          return workout ? workout.dayOfWeek : null;
        } else {
          const sessionDate = new Date(s.sessionDate);
          const jsDay = sessionDate.getDay();
          return jsDay === 0 ? 7 : jsDay;
        }
      })
      .filter((day): day is number => day !== null)
  );
  
  const restDaysThisWeek = new Set(
    sessionsThisWeek
      .filter((s: any) => {
        if (s.completed !== 1) return false;
        if (!s.programWorkoutId) return true;
        const workout = programWorkouts?.find(w => w.id === s.programWorkoutId);
        return workout?.workoutType === "rest";
      })
      .map((s: any) => {
        if (s.programWorkoutId) {
          const workout = programWorkouts?.find(w => w.id === s.programWorkoutId);
          return workout ? workout.dayOfWeek : null;
        } else {
          const sessionDate = new Date(s.sessionDate);
          const jsDay = sessionDate.getDay();
          return jsDay === 0 ? 7 : jsDay;
        }
      })
      .filter((day): day is number => day !== null)
  );
  
  const isProgramComplete = () => {
    if (!activeProgram) return false;
    
    const programStart = new Date(activeProgram.createdDate);
    const programDurationMs = activeProgram.durationWeeks * 7 * 24 * 60 * 60 * 1000;
    const programEnd = new Date(programStart.getTime() + programDurationMs);
    
    return new Date() >= programEnd;
  };

  const getActionableDay = () => {
    if (!programWorkouts || programWorkouts.length === 0) return null;
    
    const allCompletedDays = new Set([
      ...Array.from(completedDaysThisWeek), 
      ...Array.from(restDaysThisWeek)
    ]);
    
    const scheduledDays = new Set(programWorkouts.map(w => w.dayOfWeek));
    
    for (let offset = 0; offset < 7; offset++) {
      const checkDay = ((todayISODay + offset - 1) % 7) + 1;
      
      if (!allCompletedDays.has(checkDay)) {
        const workout = programWorkouts.find(w => w.dayOfWeek === checkDay);
        const isScheduledRestDay = workout?.workoutType === "rest";
        const isAutoRestDay = !scheduledDays.has(checkDay);
        const isRestDay = isScheduledRestDay || isAutoRestDay;
        
        return { 
          dayOfWeek: checkDay, 
          workout: workout || null,
          isRestDay,
          isAutoRestDay,
          isToday: offset === 0
        };
      }
    }
    
    const mondayWorkout = programWorkouts.find(w => w.dayOfWeek === 1);
    const isMondayScheduled = scheduledDays.has(1);
    
    return {
      dayOfWeek: 1,
      workout: mondayWorkout || null,
      isRestDay: mondayWorkout?.workoutType === "rest" || !isMondayScheduled,
      isAutoRestDay: !isMondayScheduled,
      isToday: todayISODay === 1
    };
  };

  const programComplete = isProgramComplete();
  const actionableInfo = programComplete ? null : getActionableDay();
  const todaysWorkout = actionableInfo?.workout;
  const isRestDay = actionableInfo?.isRestDay ?? false;
  const actionableDayOfWeek = actionableInfo?.dayOfWeek ?? todayISODay;
  
  const allCompletedDays = new Set([
    ...Array.from(completedDaysThisWeek), 
    ...Array.from(restDaysThisWeek)
  ]);
  const isShowingNextWeek = allCompletedDays.size === 7 && actionableInfo && !actionableInfo.isToday && actionableDayOfWeek === 1;

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
                <CardTitle>
                  {isShowingNextWeek
                    ? "Next Week's Workout"
                    : actionableInfo?.isToday
                    ? "Today's Workout"
                    : "Upcoming Workout"}
                </CardTitle>
                <CardDescription>
                  {getDayName(actionableDayOfWeek)}
                  {isShowingNextWeek ? " (Next Week)" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {actionableInfo ? (
                  isRestDay ? (
                    <>
                      <div className="text-center py-2">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                          <Calendar className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold text-lg mb-1" data-testid="text-rest-day">Rest Day</h3>
                        <p className="text-sm text-muted-foreground">
                          {actionableInfo.isAutoRestDay ? "Off-day for recovery" : "Recovery is part of the program"}
                        </p>
                      </div>
                      <Button 
                        variant="outline"
                        size="lg"
                        className="w-full"
                        onClick={async () => {
                          if (actionableInfo.isAutoRestDay) {
                            await apiRequest("POST", "/api/workout-sessions", {
                              programWorkoutId: null,
                              completed: 1,
                              status: "skipped",
                              notes: "Auto Rest Day",
                            });
                            queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions"] });
                            queryClient.invalidateQueries({ queryKey: ["/api/program-workouts", activeProgram?.id] });
                          } else {
                            if (!todaysWorkout?.id) {
                              toast({
                                title: "Error",
                                description: "Workout data not loaded. Please refresh.",
                                variant: "destructive",
                              });
                              return;
                            }
                            skipDayMutation.mutate({ workoutId: todaysWorkout.id, isRestDay: true });
                          }
                        }}
                        disabled={skipDayMutation.isPending}
                        data-testid="button-skip-rest"
                      >
                        <SkipForward className="h-5 w-5 mr-2" />
                        Complete Rest Day
                      </Button>
                    </>
                  ) : (
                    <>
                      <div>
                        <h3 className="font-semibold text-lg mb-1" data-testid="text-workout-name">{todaysWorkout?.workoutName}</h3>
                        <p className="text-sm text-muted-foreground">
                          Focus: {todaysWorkout?.movementFocus.join(", ")}
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
                            if (!todaysWorkout?.id) {
                              toast({
                                title: "Error",
                                description: "Workout data not loaded. Please refresh.",
                                variant: "destructive",
                              });
                              return;
                            }
                            skipDayMutation.mutate({ workoutId: todaysWorkout.id, isRestDay: false });
                          }}
                          disabled={skipDayMutation.isPending || !todaysWorkout?.id}
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
