import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Clock, CheckCircle2, FileText, Flame } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { WorkoutSession } from "@shared/schema";

interface WorkoutHistoryProps {
  onBack: () => void;
}

export default function WorkoutHistory({ onBack }: WorkoutHistoryProps) {
  const [limit] = useState(30);
  const [offset, setOffset] = useState(0);
  const [allSessions, setAllSessions] = useState<WorkoutSession[]>([]);

  const { data: paginatedData, isLoading } = useQuery<{ sessions: WorkoutSession[], total: number }>({
    queryKey: ["/api/workout-sessions/paginated", { limit, offset }],
  });

  // Accumulate sessions as we load more pages with deduplication
  useEffect(() => {
    if (paginatedData?.sessions) {
      if (offset === 0) {
        // First page - replace all
        setAllSessions(paginatedData.sessions);
      } else {
        // Subsequent pages - append with deduplication
        setAllSessions(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const newSessions = paginatedData.sessions.filter(s => !existingIds.has(s.id));
          return [...prev, ...newSessions];
        });
      }
    }
  }, [paginatedData, offset]);

  const completedSessions = allSessions.filter(s => s.status === 'complete') || [];
  const hasMore = paginatedData ? (offset + limit) < paginatedData.total : false;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b p-4">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Workout History</h1>
          </div>
        </header>
        <main className="max-w-4xl mx-auto p-6">
          <p className="text-center text-muted-foreground" data-testid="loading-state">Loading workout history...</p>
        </main>
      </div>
    );
  }

  if (!completedSessions.length) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b p-4">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Workout History</h1>
          </div>
        </header>
        <main className="max-w-4xl mx-auto p-6">
          <Card className="p-12">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">No Workout History Yet</h3>
                <p className="text-sm text-muted-foreground" data-testid="empty-state">
                  Complete your first workout to see your history here.
                </p>
              </div>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Workout History</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-4">
        {completedSessions.map((session) => (
          <Card key={session.id} className="p-6 hover-elevate" data-testid={`workout-${session.id}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(session.scheduledDate || session.sessionDate).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </div>
              </div>
              <Badge variant="default">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completed
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-semibold">{session.durationMinutes ? `${session.durationMinutes} min` : 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Calories</p>
                  <p className="font-semibold" data-testid={`text-calories-${session.id}`}>
                    {session.caloriesBurned ? session.caloriesBurned.toLocaleString() : '--'}
                  </p>
                </div>
              </div>
              {session.notes && (
                <div className="flex items-center gap-2 col-span-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="font-semibold text-sm truncate">{session.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
        
        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button 
              onClick={() => setOffset(offset + limit)}
              variant="outline"
              data-testid="button-load-more"
            >
              Load More
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
