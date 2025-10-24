import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  ArrowRight, 
  ArrowLeft,
  Check,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { useLocation } from "wouter";

export default function HowItWorks() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 mb-4">
            <Calendar className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold">The 7-Day Cycle System</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Training that fits your life, not the other way around
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          <Card className="p-8 space-y-6">
            <h2 className="text-2xl font-semibold">How It Works</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                  1
                </div>
                <div className="space-y-2 pt-1">
                  <h3 className="font-semibold text-lg">Pick Your Days</h3>
                  <p className="text-muted-foreground">
                    Select the specific calendar dates you want to train over the next 7 days. 
                    Training 3, 4, or 5 days per week? Choose the exact days that work for your schedule.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                  2
                </div>
                <div className="space-y-2 pt-1">
                  <h3 className="font-semibold text-lg">Complete Your Cycle</h3>
                  <p className="text-muted-foreground">
                    Work through your personalized workouts on your chosen days. Each session is designed 
                    around functional movement patterns with optimal variety and recovery.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                  3
                </div>
                <div className="space-y-2 pt-1">
                  <h3 className="font-semibold text-lg">Repeat or Regenerate</h3>
                  <p className="text-muted-foreground">
                    After completing your cycle, choose to repeat the same schedule +7 days ahead, 
                    or regenerate with new dates and settings. Total flexibility.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-8 bg-primary/5 border-primary/20 space-y-6">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-6 w-6 text-primary" />
              <h3 className="text-xl font-semibold">Smart Cycle Features</h3>
            </div>
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Automatic Rescheduling</div>
                  <p className="text-sm text-muted-foreground">
                    Missed a workout? No problem. The system automatically moves it forward so you complete 
                    every movement pattern.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Progress Tracking</div>
                  <p className="text-sm text-muted-foreground">
                    See your cycle number and total workouts completed. Track your journey across multiple cycles.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Flexible Rest Days</div>
                  <p className="text-sm text-muted-foreground">
                    Add optional cardio to rest days (HIIT, Steady State, or Zone 2) to optimize your training.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <div className="bg-muted/30 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Example Cycle</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-sm">Mon: Full Body</Badge>
              <Badge variant="secondary" className="text-sm">Tue: Rest</Badge>
              <Badge variant="outline" className="text-sm">Wed: Upper Focus</Badge>
              <Badge variant="secondary" className="text-sm">Thu: Rest</Badge>
              <Badge variant="outline" className="text-sm">Fri: Lower Focus</Badge>
              <Badge variant="secondary" className="text-sm">Sat: Rest</Badge>
              <Badge variant="outline" className="text-sm">Sun: Cardio + Core</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              After completing all workouts, choose to repeat these same days next week, or pick entirely new dates.
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-8 border-t">
          <Button
            variant="ghost"
            onClick={() => setLocation("/about")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <Button
            size="lg"
            onClick={() => setLocation("/science")}
            data-testid="button-next"
          >
            Next: Science-Based Progression
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
