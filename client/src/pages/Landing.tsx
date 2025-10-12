import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dumbbell, Target, TrendingUp, Calendar, Zap, Award } from "lucide-react";
import { useLocation } from "wouter";

export default function Landing() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        
        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center space-y-8">
            {/* Logo/Brand */}
            <div className="flex items-center justify-center gap-3">
              <div className="p-3 rounded-2xl bg-primary/10">
                <Dumbbell className="h-12 w-12 text-primary" />
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                FitForge
              </h1>
            </div>

            {/* Main Headline */}
            <div className="space-y-4 max-w-3xl mx-auto">
              <h2 className="text-4xl lg:text-5xl font-bold leading-tight">
                Build Functional Fitness <br />
                <span className="text-primary">For Real Life</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                AI-powered workout programs that adapt to your life, not the other way around. 
                Train movement patterns that matter.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Button
                size="lg"
                className="text-lg px-8 h-14 w-full sm:w-auto"
                onClick={() => setLocation("/about")}
                data-testid="button-get-started"
              >
                <Zap className="h-5 w-5 mr-2" />
                Get Started
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 h-14 w-full sm:w-auto"
                onClick={() => window.location.href = "/api/login"}
                data-testid="button-login"
              >
                Log In
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="p-6 space-y-4">
            <div className="p-3 rounded-lg bg-primary/10 w-fit">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Functional Movement Patterns</h3>
            <p className="text-muted-foreground">
              Train the 10 fundamental movement patterns your body uses every day. 
              Build real-world strength that transfers to life.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="p-3 rounded-lg bg-primary/10 w-fit">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Flexible 7-Day Cycles</h3>
            <p className="text-muted-foreground">
              Choose your training days each week. Complete a cycle, then repeat or regenerate. 
              Perfect for busy schedules.
            </p>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="p-3 rounded-lg bg-primary/10 w-fit">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">AI-Powered Progression</h3>
            <p className="text-muted-foreground">
              Programs that adapt week by week based on your equipment, fitness level, and goals. 
              Smart training that evolves with you.
            </p>
          </Card>
        </div>
      </div>

      {/* Social Proof / Trust Section */}
      <div className="bg-muted/30 py-16">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-8">
          <div className="flex items-center justify-center gap-2">
            <Award className="h-8 w-8 text-primary" />
            <h3 className="text-2xl font-bold">Built for Everyone</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">196</div>
              <p className="text-muted-foreground">Exercise Variations</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">10</div>
              <p className="text-muted-foreground">Movement Patterns</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">3-5</div>
              <p className="text-muted-foreground">Days Per Week</p>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="space-y-6 max-w-2xl mx-auto">
          <h3 className="text-3xl font-bold">Ready to Build Real Strength?</h3>
          <p className="text-lg text-muted-foreground">
            Join athletes, parents, and busy professionals who train smarter, not harder.
          </p>
          <Button
            size="lg"
            className="text-lg px-8 h-14"
            onClick={() => setLocation("/about")}
            data-testid="button-start-journey"
          >
            Start Your Journey
          </Button>
        </div>
      </div>
    </div>
  );
}
