import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Zap } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

export default function SubscriptionSelection() {
  const [, setLocation] = useLocation();

  const selectPlanMutation = useMutation({
    mutationFn: async (tier: 'free' | 'paid') => {
      console.log("Mutation started for tier:", tier);
      const response = await apiRequest("POST", "/api/subscription", {
        tier,
        billingCycle: tier === 'paid' ? 'monthly' : null,
        isActive: 1,
      });
      console.log("Mutation response:", response);
      return response;
    },
    onSuccess: () => {
      console.log("Mutation successful, navigating to /home");
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      setLocation("/home");
    },
    onError: (error) => {
      console.error("Mutation error:", error);
    },
  });

  console.log("SubscriptionSelection render - isPending:", selectPlanMutation.isPending);

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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-8 py-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start with our free tier or upgrade to Premium for an enhanced experience
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
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
                onClick={() => selectPlanMutation.mutate('free')}
                disabled={selectPlanMutation.isPending}
                data-testid="button-select-free"
              >
                Continue with Free
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
                  <div className="text-muted-foreground">/month</div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">or $36/year (save 40%)</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {paidTierFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => selectPlanMutation.mutate('paid')}
                disabled={selectPlanMutation.isPending}
                data-testid="button-select-premium"
              >
                <Zap className="h-4 w-4 mr-2" />
                Start Premium
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
