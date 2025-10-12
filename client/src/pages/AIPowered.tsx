import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Brain, 
  ArrowLeft,
  Zap,
  BarChart3,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { useLocation } from "wouter";

export default function AIPowered() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 mb-4">
            <Brain className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold">AI-Powered Progression</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Programs that evolve week by week, cycle by cycle
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          <Card className="p-8 space-y-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold">Smart Program Generation</h2>
            </div>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Every program is uniquely generated based on your specific inputs. The AI considers:
            </p>
            
            <div className="grid gap-4">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1 flex-1">
                  <h3 className="font-semibold">Your Fitness Level</h3>
                  <p className="text-sm text-muted-foreground">
                    Optional fitness tests assess your strength across all 10 movement patterns. 
                    Programs adapt exercise difficulty to match your current abilities.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1 flex-1">
                  <h3 className="font-semibold">Your Equipment</h3>
                  <p className="text-sm text-muted-foreground">
                    From bodyweight-only to full gym access, the AI selects from 196 exercises 
                    that match what you have available.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1 flex-1">
                  <h3 className="font-semibold">Your Goals</h3>
                  <p className="text-sm text-muted-foreground">
                    Whether building muscle, losing fat, or maintaining fitness, the AI adjusts 
                    workout intensity, volume, and cardio recommendations.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 space-y-4">
            <h3 className="text-xl font-semibold">Intelligent Workout Design</h3>
            <p className="text-muted-foreground leading-relaxed">
              Each workout follows professional programming principles:
            </p>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div>
                  <strong className="text-foreground">CNS-Ordered Progression:</strong> Warmup → Power → Compounds → Isolations → Core → Cardio
                </div>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div>
                  <strong className="text-foreground">Smart Exercise Variety:</strong> Hierarchical reuse prevents fatigue while maximizing variety
                </div>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div>
                  <strong className="text-foreground">Muscle Recovery Tracking:</strong> Prevents overwork through dual-layer muscle tracking
                </div>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div>
                  <strong className="text-foreground">Precise Time Calculation:</strong> Workouts hit your target duration (30-90 min) consistently
                </div>
              </li>
            </ul>
          </Card>

          <div className="bg-muted/30 rounded-lg p-6 space-y-3">
            <h3 className="font-semibold text-lg">Week-by-Week Adaptation</h3>
            <p className="text-muted-foreground">
              As you complete cycles and progress, the system tracks your improvements. 
              Retake fitness tests to update your program difficulty. Adjust equipment or goals 
              anytime to regenerate with fresh workouts that match your evolving needs.
            </p>
          </div>

          <Card className="p-8 bg-primary/10 border-primary/30">
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-bold">Ready to Experience It?</h3>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Create your account to unlock AI-powered functional fitness training 
                that adapts to your life and goals.
              </p>
              <div className="pt-4">
                <Button
                  size="lg"
                  className="text-lg px-8 h-14"
                  onClick={() => window.location.href = "/api/login"}
                  data-testid="button-create-account"
                >
                  <Zap className="h-5 w-5 mr-2" />
                  Create Your Account
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  onClick={() => window.location.href = "/api/login"}
                  className="text-primary hover:underline font-medium"
                  data-testid="link-login"
                >
                  Log in here
                </button>
              </p>
            </div>
          </Card>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-8 border-t">
          <Button
            variant="ghost"
            onClick={() => setLocation("/how-it-works")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="text-sm text-muted-foreground">
            Step 3 of 3
          </div>
        </div>
      </div>
    </div>
  );
}
