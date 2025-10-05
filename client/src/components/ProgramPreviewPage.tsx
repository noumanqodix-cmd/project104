import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Calendar, TrendingUp } from "lucide-react";
import type { ProgramWorkout, ProgramExercise, Exercise } from "@shared/schema";

interface WorkoutWithExercises extends ProgramWorkout {
  exercises: (ProgramExercise & { exercise: Exercise })[];
}

interface GeneratedProgram {
  programType: string;
  weeklyStructure: string;
  durationWeeks: number;
  workouts: WorkoutWithExercises[];
}

interface ProgramPreviewPageProps {
  generatedProgram: GeneratedProgram;
  onContinue: () => void;
}

export default function ProgramPreviewPage({ generatedProgram, onContinue }: ProgramPreviewPageProps) {
  const firstWeekWorkouts = generatedProgram.workouts.filter(
    workout => workout.dayOfWeek >= 1 && workout.dayOfWeek <= 7
  );

  const formatReps = (ex: ProgramExercise) => {
    if (ex.durationSeconds) {
      return `${ex.durationSeconds}s`;
    }
    if (ex.repsMin && ex.repsMax) {
      return `${ex.repsMin}-${ex.repsMax}`;
    }
    if (ex.repsMin) {
      return `${ex.repsMin}`;
    }
    return '-';
  };

  const getDayName = (dayOfWeek: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek % 7];
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-6 bg-primary/5">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Dumbbell className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold" data-testid="text-program-title">
                {generatedProgram.programType}
              </h1>
              <p className="text-muted-foreground mt-1">Your personalized workout program</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm" data-testid="text-weekly-structure">
                <span className="font-semibold">{generatedProgram.weeklyStructure}</span> schedule
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm" data-testid="text-duration">
                <span className="font-semibold">{generatedProgram.durationWeeks} weeks</span> program
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Week 1 Preview</h2>
          <p className="text-muted-foreground mb-6">
            Here's what your first week looks like. Create an account to access your full program and start tracking your progress.
          </p>

          <div className="space-y-6">
            {firstWeekWorkouts.map((workout) => (
              <Card key={workout.id} className="overflow-hidden">
                <div className="bg-muted/50 p-4 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold" data-testid={`text-workout-name-${workout.dayOfWeek}`}>
                        {workout.workoutName}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1" data-testid={`text-day-${workout.dayOfWeek}`}>
                        {getDayName(workout.dayOfWeek)} • {workout.movementFocus.join(', ')}
                      </p>
                    </div>
                    <Badge variant="secondary" data-testid={`badge-day-${workout.dayOfWeek}`}>
                      Day {workout.dayOfWeek}
                    </Badge>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {workout.exercises.map((ex, index) => (
                    <div 
                      key={ex.id} 
                      className="flex items-start gap-4 pb-4 border-b last:border-b-0 last:pb-0"
                      data-testid={`exercise-${workout.dayOfWeek}-${index}`}
                    >
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{index + 1}</span>
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2" data-testid={`text-exercise-name-${workout.dayOfWeek}-${index}`}>
                          {ex.exercise.name}
                        </h4>
                        
                        <div className="flex flex-wrap gap-2 mb-3">
                          {ex.exercise.equipment?.map((eq, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {eq}
                            </Badge>
                          ))}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Sets</p>
                            <p className="text-sm font-semibold" data-testid={`text-sets-${workout.dayOfWeek}-${index}`}>
                              {ex.sets}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Reps</p>
                            <p className="text-sm font-semibold" data-testid={`text-reps-${workout.dayOfWeek}-${index}`}>
                              {formatReps(ex)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Rest</p>
                            <p className="text-sm font-semibold" data-testid={`text-rest-${workout.dayOfWeek}-${index}`}>
                              {ex.restSeconds}s
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
          <div className="p-8 text-center">
            <h3 className="text-2xl font-bold mb-2">Ready to Transform?</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your free account to unlock your complete {generatedProgram.durationWeeks}-week program, 
              track your progress, and achieve your fitness goals.
            </p>
            <Button 
              size="lg" 
              className="text-lg px-8"
              onClick={onContinue}
              data-testid="button-create-account"
            >
              Create Account to Start
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
