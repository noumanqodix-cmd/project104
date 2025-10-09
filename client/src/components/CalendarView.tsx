import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Flame, Dumbbell, Plus, Heart } from "lucide-react";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WorkoutSession } from "@shared/schema";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  sessions: WorkoutSession[];
}

export function CalendarView({ sessions }: CalendarViewProps) {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Get sessions for the selected date
  const selectedDateSessions = selectedDate
    ? sessions.filter(session => {
        const sessionDisplayDate = session.scheduledDate ? new Date(session.scheduledDate) : new Date(session.sessionDate);
        return isSameDay(sessionDisplayDate, selectedDate);
      })
    : [];

  // Check if selected date is a rest day
  const isRestDay = selectedDateSessions.some(s => s.sessionType === "rest");
  const hasCardio = selectedDateSessions.some(s => s.sessionType === "workout" && s.workoutType === "cardio");

  // Mutation to add cardio session to a rest day
  const addCardioMutation = useMutation({
    mutationFn: async (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return await apiRequest("POST", `/api/programs/sessions/cardio/${dateStr}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions"] });
      setSelectedDate(null);
      toast({
        title: "Cardio Session Added!",
        description: "Zone 2 cardio workout has been added to this rest day.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add cardio session. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create a map of dates to sessions for quick lookup
  const sessionsByDate = new Map<string, WorkoutSession[]>();
  sessions.forEach(session => {
    // Use scheduledDate if available, otherwise fall back to sessionDate
    const displayDate = session.scheduledDate ? new Date(session.scheduledDate) : new Date(session.sessionDate);
    const dateKey = format(displayDate, 'yyyy-MM-dd');
    if (!sessionsByDate.has(dateKey)) {
      sessionsByDate.set(dateKey, []);
    }
    sessionsByDate.get(dateKey)!.push(session);
  });

  // Get day color based on session status (using backend status field)
  // Priority: Completed > Skipped > Rest > Scheduled
  const getDayColor = (date: Date): string => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const daySessions = sessionsByDate.get(dateKey) || [];
    
    if (daySessions.length === 0) return '';
    
    // Highest priority: Check if completed (using backend completed flag)
    const hasCompleted = daySessions.some(s => s.completed && s.status !== 'skipped');
    if (hasCompleted) return 'bg-green-500/20 hover:bg-green-500/30 border-green-500/50';
    
    // Second priority: Check if skipped (using backend status field)
    const hasSkipped = daySessions.some(s => s.status === 'skipped');
    if (hasSkipped) return 'bg-red-500/20 hover:bg-red-500/30 border-red-500/50';
    
    // Third priority: Check if it's a rest day
    const hasRestDay = daySessions.some(s => s.sessionType === "rest");
    if (hasRestDay) return 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/50';
    
    // Default: Scheduled (all other cases - rely on backend status, don't compute client-side)
    return 'bg-muted/50 hover:bg-muted border-border';
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold" data-testid="calendar-month-year">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={previousMonth}
            data-testid="button-previous-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={nextMonth}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-green-500/30 border border-green-500/50" />
          <span className="text-muted-foreground">Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-red-500/30 border border-red-500/50" />
          <span className="text-muted-foreground">Missed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-blue-500/30 border border-blue-500/50" />
          <span className="text-muted-foreground">Rest</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-muted border border-border" />
          <span className="text-muted-foreground">Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <Heart className="h-3 w-3 text-red-500 fill-red-500" />
          <span className="text-muted-foreground">Cardio</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => {
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isToday = isSameDay(day, new Date());
              const dayColor = getDayColor(day);
              const dateKey = format(day, 'yyyy-MM-dd');
              const hasSessions = sessionsByDate.has(dateKey);
              const daySessions = sessionsByDate.get(dateKey) || [];
              const hasCardioSession = daySessions.some(s => s.sessionType === "workout" && s.workoutType === "cardio");

              return (
                <button
                  key={index}
                  onClick={() => hasSessions && setSelectedDate(day)}
                  disabled={!hasSessions}
                  data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                  className={cn(
                    "relative aspect-square rounded-md border transition-colors",
                    "flex items-center justify-center text-sm",
                    isCurrentMonth ? "text-foreground" : "text-muted-foreground/50",
                    isToday && "ring-2 ring-primary ring-offset-2",
                    hasSessions ? dayColor : "border-transparent",
                    !hasSessions && "cursor-default"
                  )}
                >
                  <span className={cn(
                    isToday && "font-bold"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {hasCardioSession && (
                    <Heart 
                      className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 text-red-500 fill-red-500" 
                      data-testid={`cardio-indicator-${format(day, 'yyyy-MM-dd')}`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day Details Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent data-testid="dialog-day-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedDateSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No workouts scheduled for this day
              </p>
            ) : (
              <>
                {selectedDateSessions.map((session) => (
                  <Card key={session.id} data-testid={`session-detail-${session.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold">
                          {session.sessionType === 'cardio' ? (
                            <span className="flex items-center gap-2">
                              <Heart className="h-4 w-4 text-red-500" />
                              Zone 2 Cardio
                            </span>
                          ) : (
                            session.workoutName
                          )}
                        </h3>
                        <span className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          session.completed && session.status !== 'skipped' && "bg-green-500/20 text-green-700 dark:text-green-300",
                          session.status === 'skipped' && "bg-red-500/20 text-red-700 dark:text-red-300",
                          session.sessionType === "rest" && "bg-blue-500/20 text-blue-700 dark:text-blue-300",
                          !session.completed && session.status !== 'skipped' && session.sessionType !== "rest" && "bg-muted text-muted-foreground"
                        )}>
                          {session.completed && session.status !== 'skipped' ? 'Completed' :
                           session.status === 'skipped' ? 'Skipped' :
                           session.sessionType === "rest" ? 'Rest' : 'Scheduled'}
                        </span>
                      </div>
                      
                      {session.completed && (
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          {session.durationMinutes && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {session.durationMinutes} min
                            </div>
                          )}
                          {session.caloriesBurned && (
                            <div className="flex items-center gap-1">
                              <Flame className="h-3 w-3" />
                              {session.caloriesBurned} cal
                            </div>
                          )}
                        </div>
                      )}

                      {session.notes && (
                        <p className="text-sm text-muted-foreground">{session.notes}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {/* Add Cardio Button for Rest Days */}
                {isRestDay && !hasCardio && selectedDate && (
                  <Button
                    onClick={() => addCardioMutation.mutate(selectedDate)}
                    disabled={addCardioMutation.isPending}
                    variant="outline"
                    className="w-full"
                    data-testid="button-add-cardio"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Cardio Session
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
