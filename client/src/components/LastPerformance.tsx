import { History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WorkoutSet {
  id: string;
  sessionId: string;
  setNumber: number;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  rir?: number;
  timestamp: string;
}

interface LastPerformanceProps {
  recentSets: WorkoutSet[];
  unitPreference: 'imperial' | 'metric';
}

export default function LastPerformance({ recentSets, unitPreference }: LastPerformanceProps) {
  if (!recentSets || recentSets.length === 0) {
    return null;
  }

  // Group sets by session and get the most recent session
  const sessionGroups = recentSets.reduce((acc, set) => {
    if (!acc[set.sessionId]) {
      acc[set.sessionId] = [];
    }
    acc[set.sessionId].push(set);
    return acc;
  }, {} as Record<string, WorkoutSet[]>);

  // Get the most recent session (sets are already ordered by timestamp desc)
  const mostRecentSessionId = recentSets[0].sessionId;
  const lastSessionSets = sessionGroups[mostRecentSessionId].sort((a, b) => a.setNumber - b.setNumber);
  const lastPerformedDate = new Date(recentSets[0].timestamp);

  const weightUnit = unitPreference === 'imperial' ? 'lbs' : 'kg';

  // Check if this is duration-based (cardio)
  const isDurationBased = lastSessionSets[0].durationSeconds !== null && lastSessionSets[0].durationSeconds !== undefined;

  return (
    <div className="p-4 bg-muted/30 rounded-lg border border-border" data-testid="last-performance-card">
      <div className="flex items-start gap-3">
        <History className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-2">
            <p className="font-semibold text-sm" data-testid="last-performance-title">Last Time</p>
            <p className="text-xs text-muted-foreground" data-testid="last-performance-date">
              {formatDistanceToNow(lastPerformedDate, { addSuffix: true })}
            </p>
          </div>
          
          {isDurationBased ? (
            <p className="text-sm" data-testid="last-performance-duration">
              Duration: <span className="font-mono font-semibold">
                {Math.floor(lastSessionSets[0].durationSeconds! / 60)}:
                {(lastSessionSets[0].durationSeconds! % 60).toString().padStart(2, '0')}
              </span>
            </p>
          ) : (
            <div className="space-y-1">
              {lastSessionSets.map((set, idx) => (
                <p key={set.id} className="text-sm font-mono" data-testid={`last-performance-set-${idx + 1}`}>
                  Set {set.setNumber}: {set.weight ? (
                    <>
                      <span className="font-semibold">{unitPreference === 'imperial' ? set.weight : (set.weight * 0.453592).toFixed(1)}</span> {weightUnit} × <span className="font-semibold">{set.reps}</span> reps
                      {set.rir !== null && set.rir !== undefined && (
                        <span className="text-muted-foreground ml-1">({set.rir} RIR)</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">{set.reps}</span> reps
                      {set.rir !== null && set.rir !== undefined && (
                        <span className="text-muted-foreground ml-1">({set.rir} RIR)</span>
                      )}
                    </>
                  )}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
