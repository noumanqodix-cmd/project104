import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar, AlertTriangle, X } from "lucide-react";

interface MissedWorkoutDialogProps {
  open: boolean;
  missedCount: number;
  dateRange: string;
  onReset: () => void;
  onSkip: () => void;
  isProcessing?: boolean;
}

export default function MissedWorkoutDialog({
  open,
  missedCount,
  dateRange,
  onReset,
  onSkip,
  isProcessing = false
}: MissedWorkoutDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent data-testid="dialog-missed-workout">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <AlertDialogTitle data-testid="text-missed-title">
                Missed Workouts Detected
              </AlertDialogTitle>
              <AlertDialogDescription data-testid="text-missed-subtitle">
                You have {missedCount} workout{missedCount > 1 ? 's' : ''} from {dateRange}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground">
            Life happens! Choose how you'd like to handle your missed workouts:
          </p>

          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h4 className="font-semibold">Reset Program</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Move your oldest missed workout to today and reschedule all remaining workouts. 
              This keeps your program sequence intact.
            </p>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <X className="h-5 w-5 text-muted-foreground" />
              <h4 className="font-semibold">Skip Missed Sessions</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Mark missed workouts as skipped and continue with your current schedule.
            </p>
          </div>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            onClick={onReset}
            disabled={isProcessing}
            className="w-full"
            data-testid="button-reset-program"
          >
            <Calendar className="h-4 w-4 mr-2" />
            {isProcessing ? "Resetting..." : "Reset Program"}
          </Button>
          <Button
            onClick={onSkip}
            disabled={isProcessing}
            variant="outline"
            className="w-full"
            data-testid="button-skip-missed"
          >
            <X className="h-4 w-4 mr-2" />
            {isProcessing ? "Skipping..." : "Skip Missed Sessions"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
