import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Dumbbell, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function OIDCCallbackPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function completeOnboarding() {
      try {
        // Retrieve onboarding data from localStorage
        const storedData = localStorage.getItem('fitforge_onboarding_data');
        
        if (!storedData) {
          console.log("No onboarding data found, user might be returning - redirecting to home");
          setLocation("/home");
          return;
        }

        const onboardingData = JSON.parse(storedData);
        const { questionnaireData, generatedProgram } = onboardingData;

        // Clear the localStorage data
        localStorage.removeItem('fitforge_onboarding_data');

        // Send the onboarding data to complete-onboarding endpoint
        await apiRequest('POST', '/api/auth/complete-onboarding', {
          ...questionnaireData,
          generatedProgram,
        });

        // Redirect to home page
        setLocation("/home");
      } catch (error) {
        console.error("Error completing onboarding:", error);
        setError(error instanceof Error ? error.message : "Failed to complete onboarding");
      }
    }

    completeOnboarding();
  }, [setLocation]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-8 max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="bg-destructive/20 p-3 rounded-full">
              <Dumbbell className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center mb-2">Setup Error</h2>
          <p className="text-muted-foreground text-center mb-4">{error}</p>
          <button
            onClick={() => setLocation("/")}
            className="w-full text-primary hover:underline"
            data-testid="link-return-home"
          >
            Return to Home
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-8 max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="bg-primary/20 p-3 rounded-full">
            <Dumbbell className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-2">Setting up your account...</h2>
        <p className="text-muted-foreground text-center mb-6">
          We're creating your personalized workout program
        </p>
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-onboarding" />
        </div>
      </Card>
    </div>
  );
}
