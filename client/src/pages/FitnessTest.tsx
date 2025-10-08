import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Dumbbell, Award, Calendar, Target, AlertTriangle, ChevronUp, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { FitnessAssessment } from "@shared/schema";
import { calculateMovementPatternLevels, getProgressionTargets, type MovementPatternLevels, type MovementPatternLevel } from "@shared/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function FitnessTest() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [overrideDialog, setOverrideDialog] = useState<{
    open: boolean;
    pattern: keyof MovementPatternLevels | null;
    currentLevel: MovementPatternLevel | null;
    nextLevel: MovementPatternLevel | null;
  }>({ open: false, pattern: null, currentLevel: null, nextLevel: null });
  
  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const unitPreference = user?.unitPreference || 'imperial';
  const weightUnit = unitPreference === 'imperial' ? 'lbs' : 'kg';

  const { data: assessments, isLoading } = useQuery<FitnessAssessment[]>({
    queryKey: ["/api/fitness-assessments"],
  });

  const overrideMutation = useMutation({
    mutationFn: (data: { assessmentId: string; pattern: string; level: string }) => {
      const overrideField = `${data.pattern}Override`;
      return apiRequest('PATCH', `/api/fitness-assessments/${data.assessmentId}/override`, { [overrideField]: data.level });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fitness-assessments"] });
      setOverrideDialog({ open: false, pattern: null, currentLevel: null, nextLevel: null });
      toast({
        title: "Level Override Applied",
        description: "Your manual level override has been saved successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Override mutation error:", error);
      toast({
        variant: "destructive",
        title: "Override Failed",
        description: error.message || "Failed to apply level override. Please try again.",
      });
    },
  });

  const bodyweightTests = assessments?.filter(a => 
    a.pushups || a.pullups || a.squats || a.mileTime
  ) || [];
  
  const weightsTests = assessments?.filter(a => 
    a.squat1rm || a.deadlift1rm || a.benchPress1rm || a.overheadPress1rm || a.barbellRow1rm
  ) || [];

  const getImprovement = (current: number, previous: number, lowerIsBetter = false) => {
    const diff = current - previous;
    const percentChange = ((diff / previous) * 100).toFixed(1);
    const isImprovement = lowerIsBetter ? diff < 0 : diff > 0;
    return {
      diff,
      percent: percentChange,
      isImprovement,
    };
  };

  const renderBodyweightProgress = () => {
    if (bodyweightTests.length === 0) return null;
    const latest = bodyweightTests[0];
    const previous = bodyweightTests[1];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Bodyweight Test Progress
          </CardTitle>
          <CardDescription>Track your relative strength improvements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {latest.pushups !== null && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Push-ups</p>
                <p className="text-2xl font-bold" data-testid="stat-pushups">
                  {latest.pushups}
                </p>
                {previous?.pushups && (
                  <p className={`text-xs ${getImprovement(latest.pushups, previous.pushups).isImprovement ? "text-green-500" : "text-red-500"}`}>
                    {getImprovement(latest.pushups, previous.pushups).diff > 0 ? "+" : ""}
                    {getImprovement(latest.pushups, previous.pushups).diff} ({getImprovement(latest.pushups, previous.pushups).percent}%)
                  </p>
                )}
              </div>
            )}

            {latest.pullups !== null && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Pull-ups</p>
                <p className="text-2xl font-bold" data-testid="stat-pullups">
                  {latest.pullups}
                </p>
                {previous?.pullups && (
                  <p className={`text-xs ${getImprovement(latest.pullups, previous.pullups).isImprovement ? "text-green-500" : "text-red-500"}`}>
                    {getImprovement(latest.pullups, previous.pullups).diff > 0 ? "+" : ""}
                    {getImprovement(latest.pullups, previous.pullups).diff} ({getImprovement(latest.pullups, previous.pullups).percent}%)
                  </p>
                )}
              </div>
            )}

            {latest.squats !== null && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Air Squats</p>
                <p className="text-2xl font-bold" data-testid="stat-squats">
                  {latest.squats}
                </p>
                {previous?.squats && (
                  <p className={`text-xs ${getImprovement(latest.squats, previous.squats).isImprovement ? "text-green-500" : "text-red-500"}`}>
                    {getImprovement(latest.squats, previous.squats).diff > 0 ? "+" : ""}
                    {getImprovement(latest.squats, previous.squats).diff} ({getImprovement(latest.squats, previous.squats).percent}%)
                  </p>
                )}
              </div>
            )}

            {latest.mileTime !== null && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Mile Time</p>
                <p className="text-2xl font-bold" data-testid="stat-mile-time">
                  {latest.mileTime} min
                </p>
                {previous?.mileTime && (
                  <p className={`text-xs ${getImprovement(latest.mileTime, previous.mileTime, true).isImprovement ? "text-green-500" : "text-red-500"}`}>
                    {getImprovement(latest.mileTime, previous.mileTime, true).diff > 0 ? "+" : ""}
                    {getImprovement(latest.mileTime, previous.mileTime, true).diff} min
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderWeightsProgress = () => {
    if (weightsTests.length === 0) return null;
    const latest = weightsTests[0];
    const previous = weightsTests[1];

    const lifts = [
      { key: "squat1rm" as const, label: "Squat", testId: "squat" },
      { key: "deadlift1rm" as const, label: "Deadlift", testId: "deadlift" },
      { key: "benchPress1rm" as const, label: "Bench Press", testId: "benchPress" },
      { key: "overheadPress1rm" as const, label: "Overhead Press", testId: "overheadPress" },
      { key: "barbellRow1rm" as const, label: "Barbell Row", testId: "row" },
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Weights Test Progress
          </CardTitle>
          <CardDescription>Track your absolute strength gains</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {lifts.map(lift => {
              const current = latest[lift.key];
              const prev = previous?.[lift.key];
              
              if (!current) return null;
              
              return (
                <div key={lift.key} className="space-y-2">
                  <p className="text-sm text-muted-foreground">{lift.label}</p>
                  <p className="text-2xl font-bold" data-testid={`stat-${lift.testId}`}>
                    {current} {weightUnit}
                  </p>
                  {prev && (
                    <p className={`text-xs ${getImprovement(current, prev).isImprovement ? "text-green-500" : "text-red-500"}`}>
                      {getImprovement(current, prev).diff > 0 ? "+" : ""}
                      {getImprovement(current, prev).diff} {weightUnit} ({getImprovement(current, prev).percent}%)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  const getLevelColor = (level: MovementPatternLevel) => {
    switch (level) {
      case 'beginner':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      case 'intermediate':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'advanced':
        return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
    }
  };

  const renderMovementPatternLevels = () => {
    if (!assessments || assessments.length === 0 || !user) return null;
    
    const latest = assessments[0];
    const previous = assessments[1];
    
    const currentLevels = calculateMovementPatternLevels(latest, user);
    const previousLevels = previous ? calculateMovementPatternLevels(previous, user) : null;
    const progressionTargets = getProgressionTargets(user.weight, user.unitPreference);
    
    const patterns = [
      { 
        key: 'push' as keyof MovementPatternLevels, 
        label: 'Push', 
        description: 'Push-ups, Bench Press, Overhead Press',
        testId: 'push'
      },
      { 
        key: 'pull' as keyof MovementPatternLevels, 
        label: 'Pull', 
        description: 'Pull-ups, Barbell Row',
        testId: 'pull'
      },
      { 
        key: 'lowerBody' as keyof MovementPatternLevels, 
        label: 'Lower Body', 
        description: 'Squats, Squat 1RM',
        testId: 'lowerBody'
      },
      { 
        key: 'hinge' as keyof MovementPatternLevels, 
        label: 'Hinge', 
        description: 'Deadlifts, Squat stability',
        testId: 'hinge'
      },
      { 
        key: 'cardio' as keyof MovementPatternLevels, 
        label: 'Cardio', 
        description: 'Mile run time',
        testId: 'cardio'
      },
    ];

    const getNextLevel = (current: MovementPatternLevel): MovementPatternLevel | null => {
      if (current === 'beginner') return 'intermediate';
      if (current === 'intermediate') return 'advanced';
      return null;
    };

    const handleOverrideClick = (pattern: keyof MovementPatternLevels, currentLevel: MovementPatternLevel) => {
      const nextLevel = getNextLevel(currentLevel);
      if (nextLevel) {
        setOverrideDialog({
          open: true,
          pattern,
          currentLevel,
          nextLevel,
        });
      }
    };

    const getOverrideFieldName = (pattern: keyof MovementPatternLevels): string => {
      const fieldMap: Record<keyof MovementPatternLevels, string> = {
        push: 'pushOverride',
        pull: 'pullOverride',
        lowerBody: 'lowerBodyOverride',
        hinge: 'hingeOverride',
        cardio: 'cardioOverride',
      };
      return fieldMap[pattern];
    };

    const isOverridden = (pattern: keyof MovementPatternLevels): boolean => {
      const fieldName = getOverrideFieldName(pattern);
      return !!(latest as any)[fieldName];
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Movement Pattern Levels & Progression Targets
          </CardTitle>
          <CardDescription>Your current skill level and what it takes to advance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {patterns.map(pattern => {
            const currentLevel = currentLevels[pattern.key];
            const previousLevel = previousLevels?.[pattern.key];
            const leveledUp = previousLevel && previousLevel !== currentLevel && 
              ((previousLevel === 'beginner' && currentLevel !== 'beginner') || 
               (previousLevel === 'intermediate' && currentLevel === 'advanced'));
            const target = progressionTargets[pattern.key];
            const nextLevel = getNextLevel(currentLevel);
            const override = isOverridden(pattern.key);

            return (
              <div 
                key={pattern.key} 
                className="p-4 rounded-lg border bg-card space-y-3"
                data-testid={`pattern-level-${pattern.testId}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{pattern.label}</p>
                      {leveledUp && (
                        <Badge 
                          variant="outline" 
                          className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                          data-testid={`level-up-${pattern.testId}`}
                        >
                          <TrendingUp className="h-3 w-3 mr-1" />
                          LEVELED UP!
                        </Badge>
                      )}
                      {override && (
                        <Badge 
                          variant="outline" 
                          className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"
                          data-testid={`override-indicator-${pattern.testId}`}
                        >
                          <ShieldAlert className="h-3 w-3 mr-1" />
                          Manual Override
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{pattern.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`${getLevelColor(currentLevel)} capitalize font-medium`}
                      data-testid={`level-badge-${pattern.testId}`}
                    >
                      {currentLevel}
                    </Badge>
                    {nextLevel && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOverrideClick(pattern.key, currentLevel)}
                        data-testid={`override-button-${pattern.testId}`}
                      >
                        <ChevronUp className="h-4 w-4 mr-1" />
                        Override to {nextLevel}
                      </Button>
                    )}
                  </div>
                </div>

                {nextLevel && (
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-muted-foreground">To reach {nextLevel}:</p>
                    <div className="grid grid-cols-2 gap-3 pl-3">
                      {target.weightedTest !== 'N/A' && (
                        <>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Bodyweight Test:</p>
                            <p className="text-sm">{nextLevel === 'intermediate' ? target.bodyweightIntermediate : target.bodyweightAdvanced}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">Weighted Test:</p>
                            <p className="text-sm">{nextLevel === 'intermediate' ? target.weightedIntermediate : target.weightedAdvanced}</p>
                          </div>
                        </>
                      )}
                      {target.weightedTest === 'N/A' && (
                        <div className="col-span-2 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Target:</p>
                          <p className="text-sm">{nextLevel === 'intermediate' ? target.bodyweightIntermediate : target.bodyweightAdvanced}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Fitness Test</h1>
            <p className="text-muted-foreground">Track your progress and test your limits</p>
          </div>
          <p className="text-center text-muted-foreground" data-testid="loading-state">Loading fitness assessments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Fitness Test</h1>
          <p className="text-muted-foreground">Track your progress and test your limits</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Choose Your Test</CardTitle>
            <CardDescription>Select the type of fitness test you want to perform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-4"
              onClick={() => setLocation("/test/bodyweight")}
              data-testid="button-bodyweight-test"
            >
              <div className="flex items-start gap-3 text-left">
                <Award className="h-5 w-5 mt-1" />
                <div>
                  <div className="font-semibold mb-1">Bodyweight Test</div>
                  <div className="text-sm text-muted-foreground">
                    Push-ups, Pull-ups, Air Squats, Mile Run
                  </div>
                </div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-4"
              onClick={() => setLocation("/test/weights")}
              data-testid="button-weights-test"
            >
              <div className="flex items-start gap-3 text-left">
                <Dumbbell className="h-5 w-5 mt-1" />
                <div>
                  <div className="font-semibold mb-1">Weights Test</div>
                  <div className="text-sm text-muted-foreground">
                    Squat, Deadlift, Bench Press, Overhead Press, Row
                  </div>
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>

        {renderMovementPatternLevels()}
        {renderBodyweightProgress()}
        {renderWeightsProgress()}

        <Card>
          <CardHeader>
            <CardTitle>Test History</CardTitle>
            <CardDescription>All previous fitness assessments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!assessments || assessments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8" data-testid="empty-state">
                No fitness assessments yet. Complete your first test to track your progress.
              </p>
            ) : (
              assessments.map((assessment) => {
                const isBodyweight = assessment.pushups || assessment.pullups || assessment.squats || assessment.mileTime;
                const isWeights = assessment.squat1rm || assessment.deadlift1rm || assessment.benchPress1rm || assessment.overheadPress1rm || assessment.barbellRow1rm;

                return (
                  <Card 
                    key={assessment.id} 
                    data-testid={`test-result-${assessment.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isBodyweight ? (
                            <Award className="h-4 w-4 text-primary" />
                          ) : (
                            <Dumbbell className="h-4 w-4 text-primary" />
                          )}
                          <div>
                            <CardTitle className="text-base">
                              {isBodyweight && isWeights ? "Combined Test" : isBodyweight ? "Bodyweight Test" : "Weights Test"}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-1 mt-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(assessment.testDate), "MMM d, yyyy")}
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {assessment.pushups !== null && (
                          <div>
                            <p className="text-muted-foreground">Push-ups</p>
                            <p className="font-semibold" data-testid={`test-${assessment.id}-pushups`}>{assessment.pushups}</p>
                          </div>
                        )}
                        {assessment.pullups !== null && (
                          <div>
                            <p className="text-muted-foreground">Pull-ups</p>
                            <p className="font-semibold" data-testid={`test-${assessment.id}-pullups`}>{assessment.pullups}</p>
                          </div>
                        )}
                        {assessment.squats !== null && (
                          <div>
                            <p className="text-muted-foreground">Air Squats</p>
                            <p className="font-semibold" data-testid={`test-${assessment.id}-squats`}>{assessment.squats}</p>
                          </div>
                        )}
                        {assessment.mileTime !== null && (
                          <div>
                            <p className="text-muted-foreground">Mile Time</p>
                            <p className="font-semibold" data-testid={`test-${assessment.id}-miletime`}>{assessment.mileTime} min</p>
                          </div>
                        )}
                        {assessment.squat1rm !== null && (
                          <div>
                            <p className="text-muted-foreground">Squat</p>
                            <p className="font-semibold" data-testid={`test-${assessment.id}-squat`}>{assessment.squat1rm} {weightUnit}</p>
                          </div>
                        )}
                        {assessment.deadlift1rm !== null && (
                          <div>
                            <p className="text-muted-foreground">Deadlift</p>
                            <p className="font-semibold" data-testid={`test-${assessment.id}-deadlift`}>{assessment.deadlift1rm} {weightUnit}</p>
                          </div>
                        )}
                        {assessment.benchPress1rm !== null && (
                          <div>
                            <p className="text-muted-foreground">Bench Press</p>
                            <p className="font-semibold" data-testid={`test-${assessment.id}-bench`}>{assessment.benchPress1rm} {weightUnit}</p>
                          </div>
                        )}
                        {assessment.overheadPress1rm !== null && (
                          <div>
                            <p className="text-muted-foreground">Overhead Press</p>
                            <p className="font-semibold" data-testid={`test-${assessment.id}-ohp`}>{assessment.overheadPress1rm} {weightUnit}</p>
                          </div>
                        )}
                        {assessment.barbellRow1rm !== null && (
                          <div>
                            <p className="text-muted-foreground">Barbell Row</p>
                            <p className="font-semibold" data-testid={`test-${assessment.id}-row`}>{assessment.barbellRow1rm} {weightUnit}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={overrideDialog.open} onOpenChange={(open) => !open && setOverrideDialog({ open: false, pattern: null, currentLevel: null, nextLevel: null })}>
        <DialogContent data-testid="override-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Override Level Warning
            </DialogTitle>
            <DialogDescription>
              You're about to manually override your skill level for this movement pattern
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-2">
                ⚠️ Not Recommended Until You Meet Requirements
              </p>
              <p className="text-sm text-muted-foreground">
                Overriding your level will unlock more advanced exercises, but doing so before meeting the performance targets may lead to:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                <li>Increased injury risk</li>
                <li>Poor exercise form</li>
                <li>Suboptimal training progress</li>
              </ul>
            </div>

            {overrideDialog.pattern && overrideDialog.nextLevel && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Current Level: <span className="capitalize">{overrideDialog.currentLevel}</span></p>
                <p className="text-sm font-medium">Override To: <span className="capitalize text-primary">{overrideDialog.nextLevel}</span></p>
                <div className="mt-3 p-3 rounded-lg bg-muted">
                  <p className="text-sm font-medium mb-2">Targets to reach {overrideDialog.nextLevel}:</p>
                  {(() => {
                    const targets = getProgressionTargets(user?.weight, user?.unitPreference);
                    const target = targets[overrideDialog.pattern];
                    return (
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p><strong>Bodyweight:</strong> {overrideDialog.nextLevel === 'intermediate' ? target.bodyweightIntermediate : target.bodyweightAdvanced}</p>
                        {target.weightedTest !== 'N/A' && (
                          <p><strong>Weighted:</strong> {overrideDialog.nextLevel === 'intermediate' ? target.weightedIntermediate : target.weightedAdvanced}</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setOverrideDialog({ open: false, pattern: null, currentLevel: null, nextLevel: null })}
              data-testid="button-cancel-override"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (overrideDialog.pattern && overrideDialog.nextLevel && assessments?.[0]) {
                  overrideMutation.mutate({
                    assessmentId: assessments[0].id,
                    pattern: overrideDialog.pattern,
                    level: overrideDialog.nextLevel,
                  });
                }
              }}
              disabled={overrideMutation.isPending}
              data-testid="button-confirm-override"
            >
              {overrideMutation.isPending ? "Saving..." : "Confirm Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
