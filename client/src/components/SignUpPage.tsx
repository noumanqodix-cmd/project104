import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dumbbell, AlertCircle, LogIn, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SignUpPageProps {
  onSignUp: (email: string, password: string) => Promise<void>;
  onLoginRedirect?: () => void;
  generatedProgram?: any;
  questionnaireData?: any;
  onGenerateProgram?: () => Promise<void>;
}

export default function SignUpPage({ 
  onSignUp, 
  onLoginRedirect,
  generatedProgram,
  questionnaireData,
  onGenerateProgram
}: SignUpPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDuplicateUser, setIsDuplicateUser] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Require generated program before signup
    if (!generatedProgram) {
      setError("Please generate a workout program before signing up.");
      return;
    }
    
    if (email && password && !isSubmitting) {
      setIsSubmitting(true);
      setError(null);
      setIsDuplicateUser(false);
      try {
        await onSignUp(email, password);
      } catch (error) {
        console.error("Signup error:", error);
        const errorMessage = error instanceof Error ? error.message : "An error occurred during signup";
        setError(errorMessage);
        
        // Check if it's a duplicate user error
        if (errorMessage.toLowerCase().includes("already exists") || errorMessage.toLowerCase().includes("user already exists")) {
          setIsDuplicateUser(true);
        }
        
        setIsSubmitting(false);
      }
    }
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
          Create your account to get your personalized program
        </p>

        {!generatedProgram && (
          <Alert className="mb-4">
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm">No program generated yet. Generate one before signing up.</span>
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
              {isDuplicateUser && (
                <div className="mt-2 text-sm">
                  This email is already registered. Try a different email or{" "}
                  {onLoginRedirect ? (
                    <button
                      type="button"
                      onClick={onLoginRedirect}
                      className="underline font-semibold hover:text-destructive-foreground"
                      data-testid="link-go-to-login"
                    >
                      log in to your existing account
                    </button>
                  ) : (
                    <span className="font-semibold">log in to your existing account</span>
                  )}
                  .
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              data-testid="input-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              data-testid="input-password"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={!email || !password || isSubmitting || !generatedProgram}
            data-testid="button-create-account"
          >
            {isSubmitting ? "Building Your Program..." : "Create Account"}
          </Button>
          
          {!generatedProgram && (email || password) && (
            <p className="text-sm text-muted-foreground text-center" data-testid="text-program-required">
              Generate a workout program above to enable signup
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
