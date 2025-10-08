import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Dumbbell, TrendingUp, FileText, Archive } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import type { WorkoutSession, WorkoutProgram, ProgramWorkout } from "@shared/schema";
import { CalendarView } from "@/components/CalendarView";

export default function History() {
  const { data: sessions, isLoading: sessionsLoading } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/workout-sessions"],
  });

  const { data: activeProgram, isLoading: activeProgramLoading } = useQuery<WorkoutProgram>({
    queryKey: ["/api/programs/active"],
  });

  const { data: activeProgramWorkouts } = useQuery<ProgramWorkout[]>({
    queryKey: ["/api/program-workouts", activeProgram?.id],
    queryFn: async () => {
      if (!activeProgram?.id) return [];
      const response = await fetch(`/api/program-workouts/${activeProgram.id}`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return await response.json();
    },
    enabled: !!activeProgram?.id,
  });

  const { data: archivedPrograms, isLoading: archivedProgramsLoading } = useQuery<WorkoutProgram[]>({
    queryKey: ["/api/programs/archived"],
  });

  // Get IDs of workouts in the active program
  const activeProgramWorkoutIds = new Set(activeProgramWorkouts?.map(w => w.id) || []);

  // Filter sessions to only show completed ones from the active program
  const completedSessions = sessions?.filter(s => {
    if (!s.completed) return false;
    if (!s.programWorkoutId) return false;
    return activeProgramWorkoutIds.has(s.programWorkoutId);
  }) || [];

  const totalStats = {
    totalSessions: completedSessions.length,
    totalTime: completedSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0),
    avgDuration: completedSessions.length > 0 
      ? Math.round(completedSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / completedSessions.length)
      : 0,
  };

  const isLoading = sessionsLoading || activeProgramLoading || archivedProgramsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">History</h1>
            <p className="text-muted-foreground">Track your fitness journey</p>
          </div>
          <p className="text-center text-muted-foreground" data-testid="loading-state">Loading history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">History</h1>
          <p className="text-muted-foreground">Track your fitness journey</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Dumbbell className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-total-sessions">
                    {totalStats.totalSessions}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-avg-duration">
                    {totalStats.avgDuration}m
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-total-time">
                    {Math.round(totalStats.totalTime / 60)}h
                  </p>
                  <p className="text-xs text-muted-foreground">Total Time</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Archive className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-programs">
                    {archivedPrograms?.length || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Past Programs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calendar" data-testid="tab-calendar">Calendar</TabsTrigger>
            <TabsTrigger value="programs" data-testid="tab-programs">Programs</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-6">
            {!sessions || sessions.length === 0 ? (
              <Card className="p-12">
                <div className="text-center space-y-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No Program Yet</h3>
                    <p className="text-sm text-muted-foreground" data-testid="empty-calendar">
                      Generate a workout program to see your schedule.
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <CalendarView sessions={sessions} />
            )}
          </TabsContent>

          <TabsContent value="programs" className="space-y-4 mt-6">
            {!archivedPrograms || archivedPrograms.length === 0 ? (
              <Card className="p-12">
                <div className="text-center space-y-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Archive className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No Program History Yet</h3>
                    <p className="text-sm text-muted-foreground" data-testid="empty-programs">
                      Completed or replaced programs will appear here.
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              archivedPrograms.map((program) => (
                <Card key={program.id} data-testid={`program-${program.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{program.programType}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          Created: {format(new Date(program.createdDate), "MMM d, yyyy")}
                        </CardDescription>
                        {program.archivedDate && (
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <Archive className="h-3 w-3" />
                            Archived: {format(new Date(program.archivedDate), "MMM d, yyyy")}
                          </CardDescription>
                        )}
                      </div>
                      <Badge variant={program.archivedReason === "completed" ? "default" : "secondary"}>
                        {program.archivedReason === "completed" ? "Completed" : "Replaced"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">{program.weeklyStructure}</p>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {program.durationWeeks} weeks
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
