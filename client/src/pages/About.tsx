import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Target, 
  ArrowRight, 
  ArrowLeft,
  Activity,
  TrendingUp,
  Repeat
} from "lucide-react";
import { useLocation } from "wouter";

export default function About() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 mb-4">
            <Target className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold">Functional Movement Patterns</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Train the way your body was designed to move
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          <Card className="p-8 space-y-6">
            <h2 className="text-2xl font-semibold">Real Fitness for Real Life</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Forget isolated muscle training. FitForge programs are built around <strong>10 fundamental movement patterns</strong> that your body uses every single day:
            </p>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 mt-1">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium">Push & Pull</div>
                  <p className="text-sm text-muted-foreground">Opening doors, lifting objects</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 mt-1">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium">Squat & Hinge</div>
                  <p className="text-sm text-muted-foreground">Sitting, bending, picking up kids</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 mt-1">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium">Carry & Rotation</div>
                  <p className="text-sm text-muted-foreground">Groceries, sports, twisting</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 mt-1">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium">Core & Gait</div>
                  <p className="text-sm text-muted-foreground">Stability, walking, running</p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-8 bg-primary/5 border-primary/20">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="text-xl font-semibold">Why This Matters</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When you train movement patterns instead of muscles, you build <strong>functional strength</strong> that 
                  transfers directly to your daily life. You'll move better, feel stronger, and reduce injury risk.
                </p>
              </div>
            </div>
          </Card>

          <div className="bg-muted/30 rounded-lg p-6 space-y-3">
            <h3 className="font-semibold text-lg">What You'll Get:</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Programs built around 196 exercise variations
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Balanced training across all 10 movement patterns
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Workouts that adapt to your equipment and fitness level
              </li>
            </ul>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-8 border-t">
          <Button
            variant="ghost"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <Button
            size="lg"
            onClick={() => setLocation("/how-it-works")}
            data-testid="button-next"
          >
            Next: 7-Day Cycles
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
