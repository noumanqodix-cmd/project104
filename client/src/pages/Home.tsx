import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Dumbbell, Target, Settings, Sparkles, PlayCircle, SkipForward, Eye, CheckCircle } from "lucide-react";
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
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/program-workouts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate workout program",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatDateTime = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Get today's date normalized
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find today's session (exact date match)
  const todaySession = sessions
    ?.filter((s: any) => {
      if (!s.scheduledDate) return false;
      const sessionDate = new Date(s.scheduledDate);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate.getTime() === today.getTime();
    })[0];

  const todayWorkout = todaySession ? programWorkouts?.find(w => w.id === todaySession.programWorkoutId) : null;
  const isTodayComplete = todaySession?.completed === 1;

  // Find tomorrow's/next session (first session after today)
  const tomorrowSession = sessions
    ?.filter((s: any) => {
      if (!s.scheduledDate || s.completed === 1) return false;
      const sessionDate = new Date(s.scheduledDate);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate.getTime() > today.getTime();
    })
    .sort((a: any, b: any) => {
      const dateA = new Date(a.scheduledDate).getTime();
      const dateB = new Date(b.scheduledDate).getTime();
      return dateA - dateB;
    })[0];

  const tomorrowWorkout = tomorrowSession ? programWorkouts?.find(w => w.id === tomorrowSession.programWorkoutId) : null;

  // Find last completed session
  const completedSessions = sessions?.filter((s: any) => s.completed === 1) || [];
  const lastCompletedSession = completedSessions.length > 0
    ? completedSessions.reduce((latest: any, session: any) => {
        const sessionDate = new Date(session.sessionDate);
        const latestDate = new Date(latest.sessionDate);
        return sessionDate > latestDate ? session : latest;
      })
    : null;

  const lastCompletedWorkout = lastCompletedSession 
    ? programWorkouts?.find(w => w.id === lastCompletedSession.programWorkoutId) 
    : null;

  const isProgramComplete = () => {
    if (!sessions || sessions.length === 0) return false;
    return sessions.every((s: any) => s.completed === 1);
  };

  const programComplete = isProgramComplete();

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
            {/* Today's Workout Card */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Workout</CardTitle>
                <CardDescription>{formatDate(today)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {todaySession && todayWorkout ? (
                  <>
                    {todayWorkout.workoutType === "rest" ? (
                      <>
                        <div className="text-center py-2">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                            <Calendar className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <h3 className="font-semibold text-lg mb-1" data-testid="text-today-rest-day">Rest Day</h3>
                          <p className="text-sm text-muted-foreground">
                            Recovery is part of the program
                          </p>
                        </div>
                        {isTodayComplete ? (
                          <div className="flex items-center justify-center gap-2 py-2">
                            <Badge variant="default" className="text-sm" data-testid="badge-today-complete">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Complete
                            </Badge>
                          </div>
                        ) : (
                          <Button 
                            variant="outline"
                            size="lg"
                            className="w-full"
                            onClick={() => skipDayMutation.mutate({ sessionId: todaySession.id })}
                            disabled={skipDayMutation.isPending}
                            data-testid="button-complete-rest-today"
                          >
                            <SkipForward className="h-5 w-5 mr-2" />
                            {skipDayMutation.isPending ? "Completing..." : "Complete Rest Day"}
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <div>
                          <h3 className="font-semibold text-lg mb-1" data-testid="text-today-workout-name">
                            {todayWorkout.workoutName}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Focus: {todayWorkout.movementFocus.join(", ")}
                          </p>
                        </div>

                        {isTodayComplete ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center gap-2 py-2">
                              <Badge variant="default" className="text-sm" data-testid="badge-today-complete">
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Complete
                              </Badge>
                            </div>
                            <Link href="/history">
                              <Button 
                                variant="outline"
                                size="lg"
                                className="w-full"
                                data-testid="button-view-today-workout"
                              >
                                <Eye className="h-5 w-5 mr-2" />
                                View Workout
                              </Button>
                            </Link>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button 
                              className="flex-1" 
                              size="lg"
                              onClick={() => setLocation('/workout')}
                              data-testid="button-start-today-workout"
                            >
                              <PlayCircle className="h-5 w-5 mr-2" />
                              Start Workout
                            </Button>
                            <Button 
                              variant="outline"
                              size="lg"
                              onClick={() => skipDayMutation.mutate({ sessionId: todaySession.id })}
                              disabled={skipDayMutation.isPending}
                              data-testid="button-skip-today-workout"
                            >
                              <SkipForward className="h-5 w-5" />
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : programComplete ? (
                  <div className="text-center py-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                      <Target className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-1" data-testid="text-program-complete">Program Complete!</h3>
                    <p className="text-sm text-muted-foreground">
                      Congratulations on completing your {activeProgram?.durationWeeks}-week program
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground" data-testid="text-no-workout-today">No workout scheduled for today</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tomorrow's/Next Workout Card */}
            {tomorrowSession && tomorrowWorkout && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {tomorrowSession.scheduledDate && 
                     new Date(tomorrowSession.scheduledDate).getTime() === new Date(today.getTime() + 24*60*60*1000).getTime()
                      ? "Tomorrow's Workout"
                      : "Next Workout"}
                  </CardTitle>
                  <CardDescription>
                    {tomorrowSession.scheduledDate ? formatDate(tomorrowSession.scheduledDate) : "Upcoming"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tomorrowWorkout.workoutType === "rest" ? (
                    <>
                      <div className="text-center py-2">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                          <Calendar className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold text-lg mb-1" data-testid="text-tomorrow-rest-day">Rest Day</h3>
                        <p className="text-sm text-muted-foreground">
                          Recovery is part of the program
                        </p>
                      </div>
                      <Button 
                        variant="outline"
                        size="lg"
                        className="w-full"
                        onClick={() => skipDayMutation.mutate({ sessionId: tomorrowSession.id })}
                        disabled={skipDayMutation.isPending}
                        data-testid="button-complete-rest-tomorrow"
                      >
                        <SkipForward className="h-5 w-5 mr-2" />
                        {skipDayMutation.isPending ? "Completing..." : "Complete Rest Day"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div>
                        <h3 className="font-semibold text-lg mb-1" data-testid="text-tomorrow-workout-name">
                          {tomorrowWorkout.workoutName}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Focus: {tomorrowWorkout.movementFocus.join(", ")}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          className="flex-1" 
                          size="lg"
                          onClick={() => setLocation('/workout')}
                          data-testid="button-start-tomorrow-workout"
                        >
                          <PlayCircle className="h-5 w-5 mr-2" />
                          Start Workout
                        </Button>
                        <Button 
                          variant="outline"
                          size="lg"
                          onClick={() => skipDayMutation.mutate({ sessionId: tomorrowSession.id })}
                          disabled={skipDayMutation.isPending}
                          data-testid="button-skip-tomorrow-workout"
                        >
                          <SkipForward className="h-5 w-5" />
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Last Completed Workout Card */}
            {lastCompletedSession && (
              <Link href="/history">
                <Card className="hover-elevate active-elevate-2 cursor-pointer" data-testid="card-last-completed">
                  <CardHeader>
                    <CardTitle>Last Completed Workout</CardTitle>
                    <CardDescription>Your most recent session</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="font-semibold" data-testid="text-last-completed-name">
                        {lastCompletedWorkout?.workoutType === "rest" 
                          ? "Rest Day" 
                          : lastCompletedWorkout?.workoutName || "Session"}
                      </p>
                      <p className="text-sm text-muted-foreground" data-testid="text-last-completed-date">
                        {formatDateTime(lastCompletedSession.sessionDate)}
                      </p>
                      {lastCompletedSession.durationMinutes && (
                        <p className="text-sm text-muted-foreground">
                          Duration: {lastCompletedSession.durationMinutes} minutes
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Current Program Card */}
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
                  <Button variant="outline" className="w-full" data-testid="button-view-program">
                    <Dumbbell className="h-4 w-4 mr-2" />
                    View Program
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
