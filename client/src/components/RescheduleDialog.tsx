// ==========================================
// RESCHEDULE DIALOG - Manual Workout Rescheduling
// ==========================================
// Allows users to reschedule upcoming workouts to a new date
// Features:
// - Date picker for selecting new date
// - Validation to prevent date conflicts
// - Shows current workout details
// ==========================================

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { parseLocalDate, formatLocalDate, isSameCalendarDay } from "@shared/dateUtils";
import type { WorkoutSession, ProgramWorkout } from "@shared/schema";
import { CalendarIcon, AlertCircle } from "lucide-react";

interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: WorkoutSession | null;
  workout: ProgramWorkout | null;
  sessions: WorkoutSession[];
  onConfirm: (sessionId: string, newDate: Date) => void;
  isPending?: boolean;
}

export function RescheduleDialog({
  open,
  onOpenChange,
  session,
  workout,
  sessions,
  onConfirm,
  isPending = false,
}: RescheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const handleConfirm = () => {
    if (session && selectedDate) {
      onConfirm(session.id, selectedDate);
      setSelectedDate(undefined);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Only reset state when closing
      setSelectedDate(undefined);
    }
    onOpenChange(isOpen);
  };

  const handleClose = () => {
    setSelectedDate(undefined);
    onOpenChange(false);
  };

  // Check if selected date has a conflict (another workout scheduled)
  const hasConflict = selectedDate ? sessions.some(s => {
    if (s.status === 'archived' || s.id === session?.id) return false;
    const displayDate = s.scheduledDate ? parseLocalDate(s.scheduledDate) : (s.sessionDate ? new Date(s.sessionDate) : null);
    if (!displayDate) return false;
    // Only consider it a conflict if there's a workout (not rest day)
    return s.sessionType === 'workout' && isSameCalendarDay(displayDate, selectedDate);
  }) : false;

  const currentDate = session?.scheduledDate 
    ? parseLocalDate(session.scheduledDate) 
    : session?.sessionDate 
    ? new Date(session.sessionDate) 
    : null;

  // Disable dates that have workout conflicts or are in the past
  const disabledDates = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Disable past dates
    if (date < today) return true;
    
    // Disable dates with workout conflicts
    return sessions.some(s => {
      if (s.status === 'archived' || s.id === session?.id) return false;
      const displayDate = s.scheduledDate ? parseLocalDate(s.scheduledDate) : (s.sessionDate ? new Date(s.sessionDate) : null);
      if (!displayDate) return false;
      return s.sessionType === 'workout' && isSameCalendarDay(displayDate, date);
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="dialog-reschedule">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Reschedule Workout
          </DialogTitle>
          <DialogDescription>
            Select a new date for this workout
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current workout info */}
          <div className="rounded-lg border p-4 space-y-2">
            <div className="text-sm text-muted-foreground">Current Workout</div>
            <div className="font-semibold">{workout?.workoutName || "Unknown"}</div>
            {currentDate && (
              <div className="text-sm text-muted-foreground">
                Currently scheduled for {format(currentDate, 'EEEE, MMMM d, yyyy')}
              </div>
            )}
          </div>

          {/* Date picker */}
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={disabledDates}
              className="rounded-md border"
              data-testid="calendar-reschedule"
            />
          </div>

          {/* Conflict warning */}
          {hasConflict && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>
                <div className="font-medium">Date Conflict</div>
                <div className="text-xs mt-1">
                  Another workout is already scheduled for this date. Please choose a different date.
                </div>
              </div>
            </div>
          )}

          {/* Selected date display */}
          {selectedDate && !hasConflict && (
            <div className="rounded-lg bg-primary/10 p-3 text-sm">
              <div className="text-muted-foreground">New Date</div>
              <div className="font-medium">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
            data-testid="button-cancel-reschedule"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedDate || hasConflict || isPending}
            data-testid="button-confirm-reschedule"
          >
            {isPending ? "Rescheduling..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
