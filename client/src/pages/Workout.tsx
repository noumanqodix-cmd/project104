// ==========================================
// WORKOUT PAGE - Active Workout Router
// ==========================================
// This page determines which type of workout to display:
// 1. Strength Workout → Shows WorkoutSession component (sets/reps tracking)
// 2. Cardio Workout → Shows CardioWorkoutSession component (timer/intervals)
// 3. Completed Workout → Shows completion message
// 4. No Workout → Shows "no workout scheduled" message
//
// FLOW:
// 1. Fetch today's session from database
// 2. Check if completed → show completion message
// 3. Check if cardio → delegate to CardioWorkoutSession
// 4. Otherwise → delegate to WorkoutSession (strength)
// ==========================================

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import WorkoutSession, { WorkoutSummary } from "@/components/WorkoutSession";
import CardioWorkoutSession, { CardioSummary } from "@/components/CardioWorkoutSession";
import type { WorkoutSession as WorkoutSessionType, User, WorkoutProgram, FitnessAssessment } from "@shared/schema";
import { parseLocalDate, isSameCalendarDay, getTodayLocal } from "@shared/dateUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";

interface WorkoutPageProps {
  onComplete: (summary: WorkoutSummary | CardioSummary) => void;
}

export default function WorkoutPage({ onComplete }: WorkoutPageProps) {
  const { data: homeData, isLoading: loadingHomeData } = useQuery<{
    user: User | null;
    activeProgram: WorkoutProgram | null;
    sessions: WorkoutSessionType[];
    fitnessAssessments: FitnessAssessment[];
  }>({
    queryKey: ["/api/home-data"],
  });

  const user = homeData?.user;
  const sessions = homeData?.sessions;

  // Find TODAY's session - show it whether completed or not
  const today = getTodayLocal();
  
  const todaySession = sessions?.find((s: any) => {
    if (!s.scheduledDate || s.status === 'archived') return false;
    const sessionDate = parseLocalDate(s.scheduledDate);
    return isSameCalendarDay(sessionDate, today);
  });

  const isCompleted = todaySession?.status === 'complete';

  if (loadingHomeData || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!todaySession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">No Workout Scheduled</h2>
          <p className="text-muted-foreground">There's no workout scheduled for today.</p>
        </div>
      </div>
    );
  }

  // If workout is completed, show completion message
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Today's Workout</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-xl mb-2" data-testid="text-workout-completed">
              Workout Completed!
            </h3>
            <p className="text-muted-foreground">
              {todaySession.workoutType === "cardio" 
                ? "Cardio session completed for today"
                : "Strength workout completed for today"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if this is a cardio session
  const isCardioSession = todaySession?.workoutType === "cardio";

  if (isCardioSession) {
    return (
      <CardioWorkoutSession
        sessionId={todaySession.id}
        onComplete={onComplete as (summary: CardioSummary) => void}
        user={user}
      />
    );
  }

  // Default to regular workout session
  return <WorkoutSession onComplete={onComplete as (summary: WorkoutSummary) => void} />;
}
