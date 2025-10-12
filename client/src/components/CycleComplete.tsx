import { Trophy } from "lucide-react";
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
import { Button } from "@/components/ui/button";

interface CycleCompleteProps {
  open: boolean;
  cycleNumber: number;
  totalWorkoutsCompleted: number;
  onRepeatSameDays: () => void;
  onNewProgram: () => void;
}

export function CycleComplete({
  open,
  cycleNumber,
  totalWorkoutsCompleted,
  onRepeatSameDays,
  onNewProgram,
}: CycleCompleteProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <AlertDialogTitle className="text-2xl" data-testid="text-cycle-number">
            Cycle {cycleNumber} Complete!
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base" data-testid="text-workouts-completed">
            Congratulations! You've completed all {totalWorkoutsCompleted} workouts in your 7-day cycle.
            What would you like to do next?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={onRepeatSameDays}
            className="w-full"
            data-testid="button-repeat-same-days"
          >
            Repeat Same Days
          </Button>
          <Button
            onClick={onNewProgram}
            variant="outline"
            className="w-full"
            data-testid="button-new-program"
          >
            New Program
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
