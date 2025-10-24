import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, AlertCircle, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SignUpPageProps {
  generatedProgram?: any;
  questionnaireData?: any;
  onGenerateProgram?: () => Promise<void>;
}

export default function SignUpPage({ 
  generatedProgram,
  questionnaireData,
  onGenerateProgram
}: SignUpPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingProgram, setIsGeneratingProgram] = useState(false);

  const handleGenerateProgram = async () => {
    if (onGenerateProgram) {
      setIsGeneratingProgram(true);
      setError(null);
      try {
        await onGenerateProgram();
      } catch (error) {
        console.error("Program generation error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to generate program";
        setError(errorMessage);
      } finally {
        setIsGeneratingProgram(false);
      }
    }
  };

  const handleSignInWithReplit = () => {
    // Require generated program before proceeding to OIDC
    if (!generatedProgram) {
      setError("Please generate a workout program before signing in.");
      return;
    }
    
    // Store onboarding data in localStorage before OIDC redirect
    localStorage.setItem('fitforge_onboarding_data', JSON.stringify({
      questionnaireData,
      generatedProgram,
      timestamp: Date.now()
    }));
    
    // Redirect to Replit Auth login
    window.location.href = '/home';
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-8 max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="bg-primary/20 p-3 rounded-full">
            <Dumbbell className="h-8 w-8 text-primary" />
          </div>
        </div>

        <h2 className="text-3xl font-bold text-center mb-2">You're almost there!</h2>
        <p className="text-muted-foreground text-center mb-8">
          Sign in to get your personalized workout program
        </p>

        {!generatedProgram && (
          <Alert className="mb-4">
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">No program generated yet. Generate one before signing in.</span>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleGenerateProgram}
                  disabled={isGeneratingProgram}
                  data-testid="button-generate-program"
                >
                  {isGeneratingProgram ? "Generating..." : "Generate Program"}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <Button
            size="lg"
            className="w-full"
            onClick={handleSignInWithReplit}
            disabled={!generatedProgram}
            data-testid="button-sign-in-replit"
          >
            Sign in with Replit
          </Button>
          
          {!generatedProgram && (
            <p className="text-sm text-muted-foreground text-center" data-testid="text-program-required">
              Generate a workout program above to continue
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
