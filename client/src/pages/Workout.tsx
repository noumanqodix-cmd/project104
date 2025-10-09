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

  // Find TODAY's session only
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todaySession = sessions?.find((s: any) => {
    if (!s.scheduledDate || s.status === 'archived' || s.status === 'skipped') return false;
    if (s.completed === 1) return false;
    const sessionDate = new Date(s.scheduledDate);
    sessionDate.setHours(0, 0, 0, 0);
    return sessionDate.getTime() === today.getTime();
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
