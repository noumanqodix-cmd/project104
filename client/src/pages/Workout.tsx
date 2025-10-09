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

  // Find the next actionable session (prioritize today, then upcoming, then past due)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const nextSession = sessions
    ?.filter((s: any) => s.completed === 0 && s.scheduledDate)
    .sort((a: any, b: any) => {
      const dateA = new Date(a.scheduledDate).getTime();
      const dateB = new Date(b.scheduledDate).getTime();
      
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
  const isCardioSession = nextSession?.sessionType === "cardio";

  if (isCardioSession && nextSession) {
    return (
      <CardioWorkoutSession
        sessionId={nextSession.id}
        onComplete={onComplete as (summary: CardioSummary) => void}
        user={user}
      />
    );
  }

  // Default to regular workout session
  return <WorkoutSession onComplete={onComplete as (summary: WorkoutSummary) => void} />;
}
