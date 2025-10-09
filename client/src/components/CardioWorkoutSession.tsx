import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Heart, Play, Pause, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { poundsToKg } from "@/lib/calorie-calculator";
import { calculateAge } from "@shared/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CardioWorkoutSessionProps {
  sessionId: string;
  onComplete: (summary: CardioSummary) => void;
  user: any;
}

export interface CardioSummary {
  duration: number;
  caloriesBurned: number;
  sessionId: string;
}

const ZONE_2_MET = 4.0; // Zone 2 cardio MET value (low-intensity steady state)

export default function CardioWorkoutSession({ sessionId, onComplete, user }: CardioWorkoutSessionProps) {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const unitPreference = user?.unitPreference || 'imperial';

  // Calculate Zone 2 heart rate range
  const age = calculateAge(user?.dateOfBirth) || 25; // Default to 25 if no DOB
  const maxHR = 220 - age;
  const zone2Min = Math.round(maxHR * 0.60);
  const zone2Max = Math.round(maxHR * 0.70);

  // Calculate Zone 2 calories based on elapsed time and user weight
  const calculateZone2Calories = (durationMinutes: number): number => {
    if (!user?.weight) return 0;
    
    const weightKg = unitPreference === 'imperial' ? poundsToKg(user.weight) : user.weight;
    // Calories = Duration (min) × ((MET × 3.5) × Weight (kg) / 200)
    const calories = durationMinutes * ((ZONE_2_MET * 3.5) * weightKg / 200);
    return Math.round(calories);
  };

  const currentCalories = calculateZone2Calories(Math.floor(elapsedTime / 60));

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const completeSessionMutation = useMutation({
    mutationFn: async () => {
      const durationMinutes = Math.floor(elapsedTime / 60);
      const caloriesBurned = calculateZone2Calories(durationMinutes);

      return await apiRequest("PATCH", `/api/workout-sessions/${sessionId}`, {
        completed: true,
        status: "completed",
        durationMinutes,
        caloriesBurned,
      });
    },
    onSuccess: () => {
      const durationMinutes = Math.floor(elapsedTime / 60);
      onComplete({
        duration: elapsedTime,
        caloriesBurned: calculateZone2Calories(durationMinutes),
        sessionId,
      });
      toast({
        title: "Cardio Session Completed!",
        description: `Great work! ${Math.floor(elapsedTime / 60)} minutes of Zone 2 cardio completed.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to complete cardio session. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = () => {
    setIsRunning(!isRunning);
  };

  const handleComplete = () => {
    completeSessionMutation.mutate();
  };

  const handleCancel = () => {
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = () => {
    setShowCancelDialog(false);
    onComplete({
      duration: 0,
      caloriesBurned: 0,
      sessionId,
    });
  };

  const progress = Math.min((elapsedTime / (30 * 60)) * 100, 100); // 30 min target

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-6 w-6 text-primary" />
            Zone 2 Cardio Session
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Low-intensity steady-state cardio. Target: {zone2Min}-{zone2Max} bpm (60-70% max HR)
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Timer Display */}
          <div className="text-center space-y-4">
            <div className="text-6xl font-bold tabular-nums" data-testid="text-timer">
              {formatTime(elapsedTime)}
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Target: 30 min</span>
              <span>{Math.floor(elapsedTime / 60)} / 30 min</span>
            </div>
          </div>

          {/* Calories Display */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold" data-testid="text-calories">
                  {currentCalories}
                </div>
                <div className="text-sm text-muted-foreground">Calories Burned</div>
              </div>
            </CardContent>
          </Card>

          {/* Control Buttons */}
          <div className="flex gap-3">
            <Button
              size="lg"
              variant={isRunning ? "secondary" : "default"}
              className="flex-1"
              onClick={handleToggle}
              data-testid={isRunning ? "button-pause" : "button-start"}
            >
              {isRunning ? (
                <>
                  <Pause className="h-5 w-5 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  {elapsedTime > 0 ? "Resume" : "Start"}
                </>
              )}
            </Button>
          </div>

          <div className="flex gap-3">
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              onClick={handleCancel}
              disabled={completeSessionMutation.isPending}
              data-testid="button-cancel"
            >
              <X className="h-5 w-5 mr-2" />
              Cancel
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={handleComplete}
              disabled={completeSessionMutation.isPending || elapsedTime === 0}
              data-testid="button-complete"
            >
              <Check className="h-5 w-5 mr-2" />
              Complete
            </Button>
          </div>

          {/* Instructions */}
          <div className="text-sm text-muted-foreground space-y-2 border-t pt-4">
            <p className="font-semibold">Zone 2 Guidelines:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Maintain a conversational pace - you should be able to talk</li>
              <li>Keep heart rate at 60-70% of your maximum</li>
              <li>Focus on steady, sustainable effort</li>
              <li>Recommended: 20-45 minutes duration</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent data-testid="dialog-cancel-cardio">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Cardio Session?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this cardio session? Your progress will not be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-no">No, Continue</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel} data-testid="button-cancel-yes">
              Yes, Cancel Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
