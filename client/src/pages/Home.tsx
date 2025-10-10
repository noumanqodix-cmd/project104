import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Calendar, Dumbbell, Target, TrendingUp, Settings, Sparkles, PlayCircle, SkipForward, Plus, Heart, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WorkoutProgram, WorkoutSession, ProgramWorkout, User, FitnessAssessment } from "@shared/schema";
import { useEffect, useState } from "react";
import { parseLocalDate, formatLocalDate, isSameCalendarDay, isAfterCalendarDay, getTodayEDT } from "@shared/dateUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MissedWorkoutDialog from "@/components/MissedWorkoutDialog";

export default function Home() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<'generating' | 'success' | 'error'>('generating');
  const [showAssessmentRequiredDialog, setShowAssessmentRequiredDialog] = useState(false);
  const [showMissedWorkoutDialog, setShowMissedWorkoutDialog] = useState(false);
  const [missedWorkoutData, setMissedWorkoutData] = useState<{ count: number; dateRange: string }>({ count: 0, dateRange: '' });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: activeProgram, isLoading: programLoading } = useQuery<WorkoutProgram>({
    queryKey: ["/api/programs/active"],
  });

  const { data: sessions } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/workout-sessions"],
  });

  const { data: fitnessAssessments, isLoading: assessmentsLoading } = useQuery<FitnessAssessment[]>({
    queryKey: ["/api/fitness-assessments"],
    enabled: !!user,
  });

  const { data: programWorkouts, isLoading: workoutsLoading } = useQuery<ProgramWorkout[]>({
    queryKey: ["/api/program-workouts", activeProgram?.id],
    enabled: !!activeProgram?.id,
  });

  const skipDayMutation = useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      return await apiRequest("PATCH", `/api/workout-sessions/${sessionId}`, {
        completed: 0,
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

  const completeRestDayMutation = useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      return await apiRequest("PATCH", `/api/workout-sessions/${sessionId}`, {
        completed: 1,
        sessionDate: new Date(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/program-workouts", activeProgram?.id] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Complete Rest Day",
        description: error.message || "Failed to complete rest day",
        variant: "destructive",
      });
    },
  });

  const addCardioMutation = useMutation({
    mutationFn: async (date: Date) => {
      const dateStr = formatLocalDate(date);
      return await apiRequest("POST", `/api/programs/sessions/cardio/${dateStr}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions"] });
      toast({
        title: "Cardio Session Added!",
        description: "Zone 2 cardio workout has been added to this rest day.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add cardio session. Please try again.",
        variant: "destructive",
      });
    },
  });

  const archiveOldSessionsMutation = useMutation({
    mutationFn: async () => {
      // Send current local date to ensure archive logic uses user's timezone
      return await apiRequest("POST", "/api/workout-sessions/archive-old", {
        currentDate: formatLocalDate(getTodayEDT()),
      });
    },
    onSuccess: () => {
      // Silently refresh sessions after archival
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions"] });
    },
  });

  // Check for missed workouts
  const { data: missedWorkoutsResponse } = useQuery({
    queryKey: ["/api/workout-sessions/missed", formatLocalDate(getTodayEDT())],
    queryFn: async () => {
      const response = await fetch(`/api/workout-sessions/missed?currentDate=${formatLocalDate(getTodayEDT())}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch missed workouts');
      return response.json();
    },
    enabled: !!user,
  });

  const resetProgramMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/workout-sessions/reset-from-today", {
        currentDate: formatLocalDate(getTodayEDT()),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions/missed"] });
      setShowMissedWorkoutDialog(false);
      toast({
        title: "Program Reset!",
        description: "Your workouts have been rescheduled starting from today.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Reset",
        description: error.message || "Failed to reset program",
        variant: "destructive",
      });
    },
  });

  const skipMissedWorkoutsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/workout-sessions/skip-missed", {
        currentDate: formatLocalDate(getTodayEDT()),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions/missed"] });
      setShowMissedWorkoutDialog(false);
      toast({
        title: "Missed Workouts Skipped",
        description: "All missed workouts have been marked as skipped.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Skip",
        description: error.message || "Failed to skip missed workouts",
        variant: "destructive",
      });
    },
  });

  const generateProgramMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/programs/generate", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/programs/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/program-workouts"] });
      setGenerationStatus('success');
    },
    onError: (error: any) => {
      setGenerationStatus('error');
    },
  });

  const handleCloseGenerationModal = () => {
    setShowGenerationModal(false);
  };

  const handleGenerateProgram = () => {
    // Don't proceed if assessments are still loading
    if (assessmentsLoading) {
      return;
    }

    // Check if user has completed fitness assessment
    if (!fitnessAssessments || fitnessAssessments.length === 0) {
      setShowAssessmentRequiredDialog(true);
      return;
    }

    // Proceed with program generation
    setShowGenerationModal(true);
    setGenerationStatus('generating');
    generateProgramMutation.mutate();
  };

  // Archive old completed/skipped sessions when page loads
  useEffect(() => {
    if (user) {
      archiveOldSessionsMutation.mutate();
    }
  }, [user?.id]); // Only run when user changes

  // Check for missed workouts and show dialog
  useEffect(() => {
    if (missedWorkoutsResponse && missedWorkoutsResponse.count > 0) {
      const missedWorkouts = missedWorkoutsResponse.missedWorkouts;
      if (missedWorkouts.length > 0) {
        // Calculate date range
        const sortedDates = missedWorkouts
          .map((w: any) => parseLocalDate(w.scheduledDate))
          .sort((a: Date, b: Date) => a.getTime() - b.getTime());
        
        const firstDate = sortedDates[0];
        const lastDate = sortedDates[sortedDates.length - 1];
        
        const dateRange = sortedDates.length === 1
          ? format(firstDate, 'MMM d')
          : `${format(firstDate, 'MMM d')} - ${format(lastDate, 'MMM d')}`;
        
        setMissedWorkoutData({
          count: missedWorkoutsResponse.count,
          dateRange,
        });
        setShowMissedWorkoutDialog(true);
      }
    }
  }, [missedWorkoutsResponse]);

  const completedSessions = sessions?.filter((s: any) => s.completed) || [];
  const totalCompletedSessions = completedSessions.length;

  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? parseLocalDate(dateString) : dateString;
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getDayName = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? parseLocalDate(dateString) : dateString;
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
    const scheduledDate = parseLocalDate(s.scheduledDate);
    return scheduledDate >= getStartOfWeek();
  }) || [];

  // TODAY'S SESSION: Find session scheduled for today's exact date (exclude archived)
  // Prioritize incomplete sessions over completed ones
  const today = new Date();
  
  const todaySessions = sessions
    ?.filter((s: any) => {
      if (s.status === 'archived' || !s.scheduledDate) return false;
      const sessionDate = parseLocalDate(s.scheduledDate);
      return isSameCalendarDay(sessionDate, today);
    }) || [];
  
  // First try to find an incomplete session
  const todaySession = todaySessions.find((s: any) => s.completed !== 1 && s.status !== 'skipped') 
    || todaySessions[0]; // Fall back to first session if all are complete

  const todayWorkout = todaySession ? programWorkouts?.find(w => w.id === todaySession.programWorkoutId) : null;
  const isTodayRestDay = todaySession?.sessionType === "rest" || false;
  const isTodayComplete = todaySession?.completed === 1;
  const isTodaySkipped = todaySession?.status === "skipped";
  
  // NEXT WORKOUT PREVIEW: Always show tomorrow's session (next calendar day), regardless of status
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  const nextUpcomingSession = sessions
    ?.filter((s: any) => s.status !== 'archived') // Only exclude archived
    ?.find((s: any) => {
      if (!s.scheduledDate) return false;
      const sessionDate = parseLocalDate(s.scheduledDate);
      return isSameCalendarDay(sessionDate, tomorrow);
    });

  const nextUpcomingWorkout = nextUpcomingSession ? programWorkouts?.find(w => w.id === nextUpcomingSession.programWorkoutId) : null;
  
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

  // Calculate current week's date range (Monday to Sunday)
  const getCurrentWeekRange = () => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`;
  };

  const currentWeekRange = getCurrentWeekRange();

  // Get last session details (including rest days and skipped sessions)
  const getLastSession = () => {
    if (completedSessions.length === 0) return null;
    const lastSession = completedSessions.reduce((latest: any, session: any) => {
      const sessionDate = new Date(session.sessionDate);
      const latestDate = new Date(latest.sessionDate);
      return sessionDate > latestDate ? session : latest;
    });
    const workout = programWorkouts?.find(w => w.id === lastSession.programWorkoutId);
    return { session: lastSession, workout };
  };

  const lastSession = getLastSession();

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

  if (programLoading || workoutsLoading) {
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
                onClick={handleGenerateProgram}
                disabled={generateProgramMutation.isPending || assessmentsLoading}
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
                  {todaySession?.scheduledDate ? formatDate(todaySession.scheduledDate) : formatDate(new Date())}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!todaySession ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">No workout scheduled for today</p>
                  </div>
                ) : isTodaySkipped ? (
                  <div className="text-center py-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/10 mb-3">
                      <SkipForward className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1" data-testid="text-workout-skipped">
                      Skipped
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {isTodayRestDay 
                        ? "Rest day skipped"
                        : todaySession.workoutType === "cardio"
                          ? "Cardio session skipped"
                          : todayWorkout?.workoutName || "Workout skipped"}
                    </p>
                  </div>
                ) : isTodayComplete ? (
                  <div className="text-center py-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 mb-3">
                      <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1" data-testid="text-workout-complete">
                      Complete
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {isTodayRestDay 
                        ? "Rest day completed"
                        : todaySession.workoutType === "cardio"
                          ? "Cardio session completed"
                          : todayWorkout?.workoutName || "Workout completed"}
                    </p>
                  </div>
                ) : isTodayRestDay ? (
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
                      variant="default"
                      size="lg"
                      className="w-full"
                      onClick={() => {
                        if (!todaySession?.scheduledDate) {
                          toast({
                            title: "Error",
                            description: "Session date not loaded. Please refresh.",
                            variant: "destructive",
                          });
                          return;
                        }
                        addCardioMutation.mutate(parseLocalDate(todaySession.scheduledDate));
                      }}
                      disabled={addCardioMutation.isPending}
                      data-testid="button-add-cardio-home"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      {addCardioMutation.isPending ? "Adding..." : "Add Cardio Session"}
                    </Button>

                    <Button 
                      variant="outline"
                      size="lg"
                      className="w-full"
                      onClick={() => {
                        if (!todaySession?.id) {
                          toast({
                            title: "Error",
                            description: "Session data not loaded. Please refresh.",
                            variant: "destructive",
                          });
                          return;
                        }
                        completeRestDayMutation.mutate({ sessionId: todaySession.id });
                      }}
                      disabled={completeRestDayMutation.isPending}
                      data-testid="button-complete-rest"
                    >
                      <Target className="h-5 w-5 mr-2" />
                      {completeRestDayMutation.isPending ? "Completing..." : "Complete Rest Day"}
                    </Button>
                  </>
                ) : (
                  <>
                    <div>
                      <h3 className="font-semibold text-lg mb-1" data-testid="text-workout-name">
                        {todaySession.workoutType === "cardio" ? "Zone 2 Cardio" : todayWorkout?.workoutName}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {todaySession.workoutType === "cardio" 
                          ? "Low-intensity steady-state cardio" 
                          : `Focus: ${todayWorkout?.movementFocus.join(", ")}`}
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
                          if (!todaySession?.id) {
                            toast({
                              title: "Error",
                              description: "Session data not loaded. Please refresh.",
                              variant: "destructive",
                            });
                            return;
                          }
                          skipDayMutation.mutate({ sessionId: todaySession.id });
                        }}
                        disabled={skipDayMutation.isPending || !todaySession?.id}
                        data-testid="button-skip-workout"
                      >
                        <SkipForward className="h-5 w-5" />
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Next Workout Preview */}
            {nextUpcomingSession && nextUpcomingWorkout && (
              <Card>
                <CardHeader>
                  <CardTitle>Next Workout</CardTitle>
                  <CardDescription>
                    {nextUpcomingSession.scheduledDate ? formatDate(nextUpcomingSession.scheduledDate) : "Upcoming"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {nextUpcomingSession.sessionType === "rest" ? (
                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">Rest Day</p>
                          <p className="text-sm text-muted-foreground">Recovery</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                          <Dumbbell className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{nextUpcomingWorkout.workoutName}</p>
                          <p className="text-sm text-muted-foreground">
                            Focus: {nextUpcomingWorkout.movementFocus.join(", ")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {isProgramComplete() && (
              <Card>
                <CardContent className="pt-6">
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
                </CardContent>
              </Card>
            )}

            {lastSession && (
              <Card>
                <CardHeader>
                  <CardTitle>Last Session</CardTitle>
                  <CardDescription>Your most recent activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-semibold" data-testid="text-last-workout-name">
                      {lastSession.session.status === "skipped" && lastSession.session.sessionType === "rest"
                        ? "Rest Day (Skipped)"
                        : lastSession.session.status === "skipped"
                          ? `${lastSession.workout?.workoutName || "Workout"} (Skipped)`
                          : lastSession.session.sessionType === "rest" 
                            ? "Rest Day" 
                            : lastSession.session.workoutType === "cardio"
                              ? "Zone 2 Cardio"
                              : lastSession.workout?.workoutName || "Session"}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-last-workout-date">
                      {formatDate(lastSession.session.sessionDate)}
                    </p>
                    {lastSession.session.durationMinutes && lastSession.session.status !== "skipped" && (
                      <p className="text-sm text-muted-foreground">
                        Duration: {lastSession.session.durationMinutes} minutes
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
                  <p className="text-sm text-muted-foreground mt-1" data-testid="text-program-week">
                    {currentWeekRange} • {activeProgram.durationWeeks} week program
                  </p>
                </div>
                {user?.equipment && user.equipment.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Equipment</p>
                    <div className="flex flex-wrap gap-2">
                      {user.equipment.map((item, index) => (
                        <span 
                          key={index}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                          data-testid={`equipment-${item.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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

      <Dialog open={showGenerationModal} onOpenChange={setShowGenerationModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {generationStatus === 'generating' && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating Your Program
                </>
              )}
              {generationStatus === 'success' && (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Program Generated!
                </>
              )}
              {generationStatus === 'error' && (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  Generation Failed
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {generationStatus === 'generating' && (
                <>
                  Our AI is creating your personalized workout program...
                  <br />
                  This may take a few moments. Please wait.
                </>
              )}
              {generationStatus === 'success' && (
                "Your personalized workout program has been created and is ready to use!"
              )}
              {generationStatus === 'error' && (
                "Failed to generate workout program. Please try again."
              )}
            </DialogDescription>
          </DialogHeader>
          {(generationStatus === 'success' || generationStatus === 'error') && (
            <div className="flex justify-end">
              <Button onClick={handleCloseGenerationModal}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAssessmentRequiredDialog} onOpenChange={setShowAssessmentRequiredDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Fitness Assessment Required
            </DialogTitle>
            <DialogDescription>
              Complete your fitness assessment first to generate a personalized workout program tailored to your abilities and goals.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button 
              variant="outline" 
              onClick={() => setShowAssessmentRequiredDialog(false)}
              data-testid="button-cancel-assessment"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                setShowAssessmentRequiredDialog(false);
                setLocation("/onboarding-assessment");
              }}
              data-testid="button-go-to-assessment"
            >
              Go to Assessment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <MissedWorkoutDialog
        open={showMissedWorkoutDialog}
        missedCount={missedWorkoutData.count}
        dateRange={missedWorkoutData.dateRange}
        onReset={() => resetProgramMutation.mutate()}
        onSkip={() => skipMissedWorkoutsMutation.mutate()}
        isProcessing={resetProgramMutation.isPending || skipMissedWorkoutsMutation.isPending}
      />
    </div>
  );
}
