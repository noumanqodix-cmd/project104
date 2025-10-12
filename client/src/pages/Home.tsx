// ==========================================
// HOME PAGE - Daily Workout Dashboard
// ==========================================
// This is the main dashboard that shows:
// 1. Today's workout (if any)
// 2. Tomorrow's workout preview
// 3. Weekly progress statistics
// 4. Cycle progress tracking
//
// KEY FEATURES:
// - Automatic Missed Workout Rescheduling: Detects missed workouts and automatically reschedules all remaining workouts forward
// - 7-Day Cycle Completion: Prompts user to repeat same days or generate new program after completing cycle
// - Rest Day Management: Users can complete rest days or add cardio (HIIT/Steady State/Zone 2)
// - Session Archival: Auto-archives old completed/skipped sessions on page load
// - Cycle Progress Badge: Displays current cycle number and total workouts completed
// ==========================================

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Dumbbell, Target, TrendingUp, Settings, Sparkles, PlayCircle, Plus, Heart, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WorkoutProgram, WorkoutSession, ProgramWorkout, User, FitnessAssessment } from "@shared/schema";
import { useEffect, useState } from "react";
import { parseLocalDate, formatLocalDate, isSameCalendarDay, isAfterCalendarDay, getTodayLocal } from "@shared/dateUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CycleComplete } from "@/components/CycleComplete";

export default function Home() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<'generating' | 'success' | 'error'>('generating');
  const [showAssessmentRequiredDialog, setShowAssessmentRequiredDialog] = useState(false);
  const [showCycleCompleteDialog, setShowCycleCompleteDialog] = useState(false);
  const [showCardioTypeDialog, setShowCardioTypeDialog] = useState(false);
  const [selectedCardioType, setSelectedCardioType] = useState<'hiit' | 'steady-state' | 'zone-2'>('hiit');
  const [pendingCardioDate, setPendingCardioDate] = useState<Date | null>(null);

  // STEP 1: Fetch all home page data in single request for performance
  // Gets: user profile, active program, workout sessions, fitness assessments
  const { data: homeData, isLoading: homeDataLoading } = useQuery<{
    user: User | null;
    activeProgram: WorkoutProgram | null;
    sessions: WorkoutSession[];
    fitnessAssessments: FitnessAssessment[];
  }>({
    queryKey: ["/api/home-data"],
  });

  const user = homeData?.user;
  const activeProgram = homeData?.activeProgram;
  const sessions = homeData?.sessions;
  const fitnessAssessments = homeData?.fitnessAssessments;

  const { data: programWorkouts, isLoading: workoutsLoading } = useQuery<ProgramWorkout[]>({
    queryKey: ["/api/program-workouts", activeProgram?.id],
    enabled: !!activeProgram?.id,
  });

  // Check for 7-day cycle completion
  const { data: cycleCompletionCheck } = useQuery<{
    shouldPrompt: boolean;
    cycleNumber: number;
    totalWorkoutsCompleted: number;
    currentCycleDates: string[];
  }>({
    queryKey: ["/api/cycles/completion-check"],
    enabled: !!activeProgram?.id && !!user,
  });


  const completeRestDayMutation = useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      return await apiRequest("PATCH", `/api/workout-sessions/${sessionId}`, {
        completed: 1,
        sessionDate: new Date(),
      });
    },
    onSuccess: async () => {
      console.log('[HOME] Rest day completed, refreshing all data...');
      
      // Force immediate refetch of all critical data
      await queryClient.refetchQueries({ queryKey: ["/api/home-data"] });
      await queryClient.refetchQueries({ queryKey: ["/api/program-workouts", activeProgram?.id] });
      await queryClient.refetchQueries({ queryKey: ["/api/cycles/completion-check"] });
      
      console.log('[HOME] All data refreshed successfully');
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
    mutationFn: async ({ date, type }: { date: Date; type: string }) => {
      const dateStr = formatLocalDate(date);
      return await apiRequest("POST", `/api/programs/sessions/cardio/${dateStr}`, { cardioType: type });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/home-data"] });
      const typeDisplay = variables.type === 'hiit' ? 'HIIT' : 
                          variables.type === 'steady-state' ? 'Steady State' : 'Zone 2';
      toast({
        title: "Cardio Session Added!",
        description: `${typeDisplay} cardio workout has been added to this rest day.`,
      });
      setShowCardioTypeDialog(false);
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
        currentDate: formatLocalDate(getTodayLocal()),
      });
    },
    onSuccess: () => {
      // Silently refresh sessions after archival
      queryClient.invalidateQueries({ queryKey: ["/api/home-data"] });
    },
  });

  // STEP 2: Detect missed workouts (uncompleted sessions before today)
  // Example: If user has uncompleted workouts from Mon-Wed and today is Fri, count = 3
  const { data: missedWorkoutsResponse } = useQuery({
    queryKey: ["/api/workout-sessions/missed", formatLocalDate(getTodayLocal())],
    queryFn: async () => {
      const response = await fetch(`/api/workout-sessions/missed?currentDate=${formatLocalDate(getTodayLocal())}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch missed workouts');
      return response.json();
    },
    enabled: !!user,
  });

  // MUTATION: Reset Program - Reschedules all future workouts starting from today
  // Used for automatic missed workout rescheduling
  const resetProgramMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/workout-sessions/reset-from-today", {
        currentDate: formatLocalDate(getTodayLocal()),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/home-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions/missed"] });
      
      // Show success toast after confirmed reschedule
      toast({
        title: "Life Happens!",
        description: "We've moved your missed workout to today so your entire movement pattern gets worked.",
        duration: 5000,
      });
      
      // Reset mutation state after success to allow future missed workouts to trigger auto-reschedule
      setTimeout(() => resetProgramMutation.reset(), 100);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Reschedule",
        description: error.message || "Failed to reschedule missed workouts. Please reload the page to try again.",
        variant: "destructive",
        duration: 8000,
      });
      // Don't reset on error - prevents infinite retry loop
      // User must reload page to retry after error
    },
  });

  // MUTATION: Skip Missed Workouts - Marks missed workouts as skipped, continues with scheduled workouts
  const skipMissedWorkoutsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/workout-sessions/skip-missed", {
        currentDate: formatLocalDate(getTodayLocal()),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/home-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions/missed"] });
      toast({
        title: "Workouts Skipped",
        description: "Missed workouts have been marked as skipped.",
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
      queryClient.invalidateQueries({ queryKey: ["/api/home-data"] });
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
    // Don't proceed if home data is still loading
    if (homeDataLoading) {
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

  // EFFECT: Auto-archive old sessions on page load (keeps database clean)
  // Moves completed/skipped sessions older than current date to archived state
  useEffect(() => {
    if (user) {
      archiveOldSessionsMutation.mutate();
    }
  }, [user?.id]); // Only run when user changes

  // EFFECT: Automatically reschedule missed workouts (no dialog needed)
  // Life happens! We just move the missed workout to today and shift everything forward
  useEffect(() => {
    if (
      missedWorkoutsResponse?.count > 0 && 
      !resetProgramMutation.isPending && 
      !resetProgramMutation.isSuccess &&
      !resetProgramMutation.isError
    ) {
      const missedWorkouts = missedWorkoutsResponse.missedWorkouts;
      if (missedWorkouts.length > 0) {
        // Automatically reschedule - no user decision needed
        resetProgramMutation.mutate();
      }
    }
  }, [missedWorkoutsResponse?.count]); // Only depends on count - mutation reset on success allows future auto-reschedules

  // Check for 7-day cycle completion
  useEffect(() => {
    if (cycleCompletionCheck?.shouldPrompt) {
      setShowCycleCompleteDialog(true);
    }
  }, [cycleCompletionCheck?.shouldPrompt]);

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
  const today = getTodayLocal();
  
  const todaySessions = sessions
    ?.filter((s: any) => {
      if (s.status === 'archived' || !s.scheduledDate) return false;
      const sessionDate = parseLocalDate(s.scheduledDate);
      return isSameCalendarDay(sessionDate, today);
    }) || [];
  
  // Prefer workout sessions over rest sessions when there are multiple for the same day
  // This ensures newly added cardio sessions are displayed instead of old rest sessions
  const sortedTodaySessions = todaySessions.sort((a: any, b: any) => {
    // Workout sessions (including cardio) come before rest sessions
    if (a.sessionType === 'workout' && b.sessionType === 'rest') return -1;
    if (a.sessionType === 'rest' && b.sessionType === 'workout') return 1;
    return 0;
  });
  
  // Always show today's session - whether incomplete or complete
  const todaySession = sortedTodaySessions[0] || null;

  const todayWorkout = todaySession ? programWorkouts?.find(w => w.id === todaySession.programWorkoutId) : null;
  const isTodayRestDay = todaySession?.sessionType === "rest" || false;
  const isTodayComplete = todaySession?.completed === 1;
  
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

  if (homeDataLoading || workoutsLoading) {
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
            {user && user.cycleNumber !== null && user.cycleNumber > 0 && (
              <Badge variant="secondary" className="mt-2" data-testid="badge-cycle-progress">
                Cycle {user.cycleNumber} • {user.totalWorkoutsCompleted} Workouts Completed
              </Badge>
            )}
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
                disabled={generateProgramMutation.isPending || homeDataLoading}
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
                        setPendingCardioDate(parseLocalDate(todaySession.scheduledDate));
                        setShowCardioTypeDialog(true);
                      }}
                      data-testid="button-add-cardio-home"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Add Cardio Session
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

                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={() => setLocation('/workout')}
                      data-testid="button-start-workout"
                    >
                      <PlayCircle className="h-5 w-5 mr-2" />
                      Start Workout
                    </Button>
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
                      {lastSession.session.sessionType === "rest" 
                        ? "Rest Day" 
                        : lastSession.session.workoutType === "cardio"
                          ? "Zone 2 Cardio"
                          : lastSession.workout?.workoutName || "Session"}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-last-workout-date">
                      {formatDate(lastSession.session.scheduledDate || lastSession.session.sessionDate)}
                    </p>
                    {lastSession.session.durationMinutes && (
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

      {/* 7-Day Cycle Completion Dialog */}
      <CycleComplete
        open={showCycleCompleteDialog}
        cycleNumber={cycleCompletionCheck?.cycleNumber || 1}
        totalWorkoutsCompleted={cycleCompletionCheck?.totalWorkoutsCompleted || 0}
        onRepeatSameDays={() => {
          setShowCycleCompleteDialog(false);
          // Handled by CycleComplete component
        }}
        onNewProgram={() => {
          setShowCycleCompleteDialog(false);
          setLocation("/settings");
        }}
      />

      {/* Cardio Type Selection Dialog */}
      <Dialog open={showCardioTypeDialog} onOpenChange={setShowCardioTypeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              Choose Cardio Type
            </DialogTitle>
            <DialogDescription>
              Select the type of cardio workout you want to add to this rest day.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <RadioGroup 
              value={selectedCardioType} 
              onValueChange={(value) => setSelectedCardioType(value as 'hiit' | 'steady-state' | 'zone-2')}
              className="gap-4"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => setSelectedCardioType('hiit')}>
                <RadioGroupItem value="hiit" id="hiit" data-testid="radio-cardio-hiit" />
                <Label htmlFor="hiit" className="cursor-pointer flex-1">
                  <div className="font-medium">HIIT (5-10 min)</div>
                  <div className="text-sm text-muted-foreground">
                    High-intensity intervals for maximum calorie burn and cardiovascular improvement
                  </div>
                </Label>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => setSelectedCardioType('steady-state')}>
                <RadioGroupItem value="steady-state" id="steady-state" data-testid="radio-cardio-steady" />
                <Label htmlFor="steady-state" className="cursor-pointer flex-1">
                  <div className="font-medium">Steady State (10-15 min)</div>
                  <div className="text-sm text-muted-foreground">
                    Moderate continuous cardio for endurance and heart health
                  </div>
                </Label>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => setSelectedCardioType('zone-2')}>
                <RadioGroupItem value="zone-2" id="zone-2" data-testid="radio-cardio-zone2" />
                <Label htmlFor="zone-2" className="cursor-pointer flex-1">
                  <div className="font-medium">Zone 2 (15-20 min)</div>
                  <div className="text-sm text-muted-foreground">
                    Low-intensity aerobic work for fat burning and recovery
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCardioTypeDialog(false)}
              data-testid="button-cancel-cardio-type"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingCardioDate) {
                  addCardioMutation.mutate({ date: pendingCardioDate, type: selectedCardioType });
                }
              }}
              disabled={addCardioMutation.isPending}
              data-testid="button-confirm-cardio-type"
            >
              {addCardioMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Cardio
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
