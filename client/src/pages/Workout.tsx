import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import WorkoutSession, { WorkoutSummary } from "@/components/WorkoutSession";
import CardioWorkoutSession, { CardioSummary } from "@/components/CardioWorkoutSession";
import type { WorkoutSession as WorkoutSessionType, User } from "@shared/schema";

interface WorkoutPageProps {
  onComplete: (summary: WorkoutSummary | CardioSummary) => void;
}

export default function WorkoutPage({ onComplete }: WorkoutPageProps) {
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: sessions, isLoading: loadingSessions } = useQuery<WorkoutSessionType[]>({
    queryKey: ["/api/workout-sessions"],
  });

  // Helper: Parse YYYY-MM-DD string into Date in local timezone (not UTC)
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed
  };

  // Helper: Compare dates by calendar date (year/month/day) in user's timezone
  const isSameCalendarDay = (date1: Date, date2: Date) => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  };

  // Find TODAY's session only
  const today = new Date();
  
  const todaySession = sessions?.find((s: any) => {
    if (!s.scheduledDate || s.status === 'archived' || s.status === 'skipped') return false;
    if (s.completed === 1) return false;
    const sessionDate = parseLocalDate(s.scheduledDate);
    return isSameCalendarDay(sessionDate, today);
  });

  if (loadingSessions || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  // Check if this is a cardio session
  const isCardioSession = todaySession?.workoutType === "cardio";

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
