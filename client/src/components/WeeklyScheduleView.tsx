// ==========================================
// WEEKLY SCHEDULE VIEW - 7-Day Workout List
// ==========================================
// Displays upcoming 7 days of workouts with:
// - Calendar dates
// - Workout names
// - Status indicators (completed/partial/upcoming/missed)
// - Manual reschedule option
// ==========================================

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, AlertCircle, Clock, MoreHorizontal } from "lucide-react";
import { format, addDays } from "date-fns";
import { parseLocalDate, isSameCalendarDay, isBeforeCalendarDay, getTodayLocal } from "@shared/dateUtils";
import type { WorkoutSession, ProgramWorkout } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WeeklyScheduleViewProps {
  sessions: WorkoutSession[];
  programWorkouts: ProgramWorkout[];
  onReschedule?: (session: WorkoutSession) => void;
}

export function WeeklyScheduleView({ sessions, programWorkouts, onReschedule }: WeeklyScheduleViewProps) {
  const today = getTodayLocal();
  
  // Generate array of next 7 days starting from today
  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  
  const getSessionForDate = (date: Date) => {
    return sessions.find(s => {
      if (s.status === 'archived') return false;
      // Use scheduledDate if available, otherwise fall back to sessionDate
      const displayDate = s.scheduledDate ? parseLocalDate(s.scheduledDate) : (s.sessionDate ? new Date(s.sessionDate) : null);
      if (!displayDate) return false;
      return isSameCalendarDay(displayDate, date);
    });
  };
  
  const getWorkoutForSession = (session: WorkoutSession | undefined) => {
    if (!session || !session.programWorkoutId) return null;
    return programWorkouts.find(w => w.id === session.programWorkoutId);
  };
  
  const getSessionStatus = (session: WorkoutSession | undefined, date: Date) => {
    if (!session) {
      // Check if this is a past date with no session
      if (isBeforeCalendarDay(date, today)) {
        return { label: "Rest", variant: "outline" as const, icon: null, className: "" };
      }
      return { label: "Rest", variant: "outline" as const, icon: null, className: "" };
    }
    
    if (session.status === 'partial') {
      return { label: "In Progress", variant: "default" as const, icon: <Clock className="h-3 w-3" />, className: "" };
    }
    
    if (session.completed === 1) {
      return { 
        label: "Completed", 
        variant: "outline" as const, 
        icon: <CheckCircle2 className="h-3 w-3" />, 
        className: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/50" 
      };
    }
    
    // Check if session is in the past and not completed
    if (isBeforeCalendarDay(date, today)) {
      return { label: "Missed", variant: "destructive" as const, icon: <AlertCircle className="h-3 w-3" />, className: "" };
    }
    
    return { label: "Upcoming", variant: "secondary" as const, icon: null, className: "" };
  };
  
  const canReschedule = (session: WorkoutSession | undefined, date: Date) => {
    if (!session) return false;
    if (session.completed === 1) return false;
    if (session.status === 'partial') return false; // Can't reschedule partial workouts
    // Can reschedule upcoming workouts (not today, not past)
    return !isSameCalendarDay(date, today) && !isBeforeCalendarDay(date, today);
  };
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">7-Day Schedule</h3>
      </div>
      
      <div className="grid gap-2">
        {next7Days.map((date, index) => {
          const session = getSessionForDate(date);
          const workout = getWorkoutForSession(session);
          const status = getSessionStatus(session, date);
          const isToday = index === 0;
          const isRestDay = session?.sessionType === 'rest' || !session;
          
          return (
            <Card 
              key={date.toISOString()} 
              className={`transition-all ${isToday ? 'ring-2 ring-primary' : ''}`}
              data-testid={`schedule-day-${format(date, 'yyyy-MM-dd')}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {format(date, 'EEE, MMM d')}
                      </p>
                      {isToday && (
                        <Badge variant="default" className="text-xs">
                          Today
                        </Badge>
                      )}
                    </div>
                    
                    {!isRestDay && workout ? (
                      <div className="space-y-1">
                        <p className="font-semibold text-base truncate" data-testid={`workout-name-${format(date, 'yyyy-MM-dd')}`}>
                          {workout.workoutName}
                        </p>
                        {session?.workoutType && (
                          <p className="text-xs text-muted-foreground capitalize">
                            {session.workoutType === 'hiit' ? 'HIIT' : session.workoutType.replace('-', ' ')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-base text-muted-foreground">Rest Day</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={status.variant}
                      className={`flex items-center gap-1 whitespace-nowrap ${status.className}`}
                      data-testid={`status-${format(date, 'yyyy-MM-dd')}`}
                    >
                      {status.icon}
                      {status.label}
                    </Badge>
                    
                    {canReschedule(session, date) && onReschedule && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            data-testid={`button-reschedule-${format(date, 'yyyy-MM-dd')}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => session && onReschedule(session)}
                            data-testid={`action-reschedule-${format(date, 'yyyy-MM-dd')}`}
                          >
                            Reschedule Workout
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
