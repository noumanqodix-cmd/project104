import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Dumbbell, Zap, TrendingUp, Heart, Target } from "lucide-react";

export default function Landing() {

  const handleSelectPlan = (tier: 'free' | 'paid') => {
    localStorage.setItem('selectedTier', tier);
    window.location.href = "/api/login";
  };

  const freeTierFeatures = [
    "Personalized workout programs",
    "Real-time workout tracking",
    "Progress analytics & history",
    "Fitness assessments",
    "Nutrition tracking & recommendations",
    "Exercise swapping with AI suggestions",
    "Ads during rest periods",
  ];

  const paidTierFeatures = [
    "Everything in Free tier",
    "Ad-free experience",
    "Priority support",
    "Advanced analytics",
    "Exclusive workout programs",
    "Early access to new features",
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 space-y-8 max-w-6xl mx-auto">
        <div className="text-center space-y-4 pt-8">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/20 p-4 rounded-full">
              <Dumbbell className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold">Transform Your Fitness Journey</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get personalized workout programs, track your progress, and achieve your fitness goals with our comprehensive training app
          </p>
        </div>

        <div className="grid gap-6 py-8">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="hover-elevate">
              <CardContent className="p-6 text-center">
                <div className="flex justify-center mb-3">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <h3 className="font-semibold mb-2">Personalized Programs</h3>
                <p className="text-sm text-muted-foreground">Custom workouts tailored to your goals and equipment</p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6 text-center">
                <div className="flex justify-center mb-3">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <h3 className="font-semibold mb-2">Track Progress</h3>
                <p className="text-sm text-muted-foreground">Detailed analytics and history of every workout</p>
              </CardContent>
            </Card>

            <Card className="hover-elevate">
              <CardContent className="p-6 text-center">
                <div className="flex justify-center mb-3">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <Heart className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <h3 className="font-semibold mb-2">Nutrition Guidance</h3>
                <p className="text-sm text-muted-foreground">Macro recommendations based on your goals</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-3xl font-bold text-center mb-8">Choose Your Plan</h2>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-2xl">Free</CardTitle>
                <CardDescription>Get started with essential features</CardDescription>
                <div className="pt-4">
                  <div className="text-4xl font-bold">$0</div>
                  <p className="text-sm text-muted-foreground">Forever free</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {freeTierFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className="w-full" 
                  size="lg"
                  variant="outline"
                  onClick={() => handleSelectPlan('free')}
                  data-testid="button-select-free"
                >
                  Start Free
                </Button>
              </CardContent>
            </Card>

            <Card className="relative border-primary shadow-lg">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg rounded-tr-lg">
                POPULAR
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">Premium</CardTitle>
                <CardDescription>Unlock the full experience</CardDescription>
                <div className="pt-4">
                  <div className="flex items-baseline gap-2">
                    <div className="text-4xl font-bold">$5</div>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">or $36/year (save 40%)</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {paidTierFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={() => handleSelectPlan('paid')}
                    data-testid="button-select-paid"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Start Premium
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Cancel anytime • No commitment
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="text-center pt-8 pb-4">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <a 
              href="/api/login" 
              className="text-primary hover:underline font-medium"
              data-testid="link-login"
            >
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
