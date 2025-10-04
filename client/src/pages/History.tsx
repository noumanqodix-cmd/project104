import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Dumbbell, TrendingUp, FileText } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import type { WorkoutSession } from "@shared/schema";

export default function History() {
  const { data: sessions, isLoading } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/workout-sessions"],
  });

  const completedSessions = sessions?.filter(s => s.completed) || [];

  const totalStats = {
    totalWorkouts: completedSessions.length,
    totalTime: completedSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0),
    avgDuration: completedSessions.length > 0 
      ? Math.round(completedSessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) / completedSessions.length)
      : 0,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Workout History</h1>
            <p className="text-muted-foreground">Track your fitness journey</p>
          </div>
          <p className="text-center text-muted-foreground" data-testid="loading-state">Loading workout history...</p>
        </div>
      </div>
    );
  }

  if (completedSessions.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Workout History</h1>
            <p className="text-muted-foreground">Track your fitness journey</p>
          </div>
          <Card className="p-12">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Dumbbell className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">No Workout History Yet</h3>
                <p className="text-sm text-muted-foreground" data-testid="empty-state">
                  Complete your first workout to start tracking your fitness journey.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Workout History</h1>
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
                  <p className="text-2xl font-bold" data-testid="stat-total-workouts">
                    {totalStats.totalWorkouts}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Workouts</p>
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
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-total-sets">
                    -
                  </p>
                  <p className="text-xs text-muted-foreground">Total Sets</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Recent Workouts</h2>
          {completedSessions.map((session) => (
            <Card key={session.id} data-testid={`workout-${session.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">Workout Session</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(session.sessionDate), "MMM d, yyyy")}
                    </CardDescription>
                  </div>
                  <Badge variant="default">Completed</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  {session.durationMinutes && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {session.durationMinutes} min
                    </div>
                  )}
                </div>
                {session.notes && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm text-muted-foreground">{session.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
