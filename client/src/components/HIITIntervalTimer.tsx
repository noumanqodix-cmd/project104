import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pause, Play, SkipForward } from "lucide-react";

interface HIITIntervalTimerProps {
  workSeconds: number;
  restSeconds: number;
  totalSets: number;
  onComplete: () => void;
  exerciseName: string;
}

type Phase = "work" | "rest";

export default function HIITIntervalTimer({
  workSeconds,
  restSeconds,
  totalSets,
  onComplete,
  exerciseName,
}: HIITIntervalTimerProps) {
  const [currentSet, setCurrentSet] = useState(1);
  const [phase, setPhase] = useState<Phase>("work");
  const [timeRemaining, setTimeRemaining] = useState(workSeconds);
  const [isPaused, setIsPaused] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const totalPhaseSeconds = phase === "work" ? workSeconds : restSeconds;
  const progress = ((totalPhaseSeconds - timeRemaining) / totalPhaseSeconds) * 100;

  useEffect(() => {
    if (!isPaused && isStarted) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Time's up for current phase
            if (phase === "work") {
              // Switch to rest
              setPhase("rest");
              return restSeconds;
            } else {
              // Rest is done, move to next set or complete
              if (currentSet >= totalSets) {
                // All sets complete
                if (intervalRef.current) {
                  clearInterval(intervalRef.current);
                }
                onComplete();
                return 0;
              } else {
                // Next set
                setCurrentSet((s) => s + 1);
                setPhase("work");
                return workSeconds;
              }
            }
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isPaused, isStarted, phase, currentSet, totalSets, workSeconds, restSeconds, onComplete]);

  const handleStart = () => {
    setIsStarted(true);
    setIsPaused(false);
  };

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };

  const handleSkipPhase = () => {
    if (phase === "work") {
      setPhase("rest");
      setTimeRemaining(restSeconds);
    } else {
      if (currentSet >= totalSets) {
        // Complete the workout
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setTimeRemaining(0);
        setIsPaused(true);
        onComplete();
      } else {
        setCurrentSet((s) => s + 1);
        setPhase("work");
        setTimeRemaining(workSeconds);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="bg-card">
      <CardContent className="pt-6 space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2" data-testid="text-exercise-name">
            {exerciseName}
          </h3>
          <p className="text-sm text-muted-foreground" data-testid="text-set-info">
            Set {currentSet} of {totalSets}
          </p>
        </div>

        <div className="space-y-4">
          {/* Phase indicator */}
          <div
            className={`text-center p-6 rounded-lg ${
              phase === "work"
                ? "bg-primary/20 border-2 border-primary"
                : "bg-muted/50 border-2 border-muted"
            }`}
            data-testid={`phase-${phase}`}
          >
            <p className="text-sm uppercase tracking-wider mb-2 text-muted-foreground">
              {phase === "work" ? "Work" : "Rest"}
            </p>
            <p className="text-6xl font-bold tabular-nums" data-testid="text-timer">
              {formatTime(timeRemaining)}
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-3" data-testid="progress-timer" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Work: {workSeconds}s</span>
              <span>Rest: {restSeconds}s</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {!isStarted ? (
            <Button
              size="lg"
              className="w-full"
              onClick={handleStart}
              data-testid="button-start-hiit"
            >
              <Play className="h-5 w-5 mr-2" />
              Start Interval
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                variant="outline"
                className="flex-1"
                onClick={handlePauseResume}
                data-testid="button-pause-hiit"
              >
                {isPaused ? (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-5 w-5 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleSkipPhase}
                disabled={isPaused}
                data-testid="button-skip-phase"
              >
                <SkipForward className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>

        {/* Workout summary */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{totalSets}</p>
              <p className="text-xs text-muted-foreground">Total Sets</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{workSeconds}s</p>
              <p className="text-xs text-muted-foreground">Work Time</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{restSeconds}s</p>
              <p className="text-xs text-muted-foreground">Rest Time</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
