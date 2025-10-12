import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Dumbbell, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function OIDCCallbackPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        console.log("Auth callback - checking user program status");
        
        // Smart routing: Check if user has an active program
        const programResponse = await apiRequest('GET', '/api/programs/active');
        const activeProgram = await programResponse.json();
        
        // Force refresh all data before navigating to ensure fresh state
        await queryClient.invalidateQueries();
        
        if (activeProgram) {
          // Existing user with program → go to home
          console.log("User has existing program, redirecting to home");
          setLocation("/home");
        } else {
          // New user without program → go to onboarding
          console.log("New user without program, redirecting to onboarding");
          setLocation("/onboarding-assessment");
        }
      } catch (error) {
        console.error("Error in auth callback:", error);
        setError(error instanceof Error ? error.message : "Failed to complete authentication");
      }
    }

    handleAuthCallback();
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
        <h2 className="text-2xl font-bold text-center mb-2">Checking your account...</h2>
        <p className="text-muted-foreground text-center mb-6">
          Please wait while we set things up
        </p>
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loader-auth-callback" />
        </div>
      </Card>
    </div>
  );
}
