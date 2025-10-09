import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dumbbell, Loader2, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function OIDCCallbackPage() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [storedOnboardingData, setStoredOnboardingData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function completeOnboarding() {
      try {
        // Retrieve onboarding data from localStorage
        const storedData = localStorage.getItem('fitforge_onboarding_data');
        
        if (!storedData) {
          console.log("No onboarding data found, checking if user is already set up");
          
          // Smart detection: Check if user has an active program (existing users)
          const programResponse = await apiRequest('GET', '/api/programs/active');
          const activeProgram = await programResponse.json();
          
          // If user has an active program, they're already set up - skip onboarding
          if (activeProgram) {
            console.log("User has existing program, redirecting to home");
            setLocation("/home");
            return;
          }
          
          // New user with no program - send to onboarding
          console.log("New user without program, redirecting to assessment");
          setLocation("/onboarding-assessment");
          return;
        }

        const onboardingData = JSON.parse(storedData);
        
        // Check if this is the new comprehensive assessment flow
        if (onboardingData.isOnboardingAssessment) {
          console.log("Processing comprehensive assessment data");
          const assessmentData = onboardingData.questionnaireData;
          
          // Call the comprehensive assessment endpoint
          await apiRequest('POST', '/api/onboarding-assessment/complete', assessmentData);
          
          // Clear localStorage and redirect
          localStorage.removeItem('fitforge_onboarding_data');
          setLocation("/home");
          return;
        }
        
        // Old onboarding flow (legacy support)
        const { questionnaireData, generatedProgram } = onboardingData;

        // Store for later use in case user confirms replacement
        setStoredOnboardingData({ questionnaireData, generatedProgram });

        // Send the onboarding data to complete-onboarding endpoint
        const response = await apiRequest('POST', '/api/auth/complete-onboarding', {
          ...questionnaireData,
          generatedProgram,
        });

        // Check if user has existing data
        const data = await response.json();
        if (data.existingData) {
          // User has existing program/assessment - show confirmation dialog
          console.log("User has existing data, showing confirmation dialog");
          setShowConfirmDialog(true);
          return;
        }

        // No existing data - complete onboarding normally
        localStorage.removeItem('fitforge_onboarding_data');
        setLocation("/home");
      } catch (error) {
        console.error("Error completing onboarding:", error);
        setError(error instanceof Error ? error.message : "Failed to complete onboarding");
      }
    }

    completeOnboarding();
  }, [setLocation]);

  const handleKeepExisting = () => {
    // User wants to keep their existing data
    console.log("User chose to keep existing data");
    localStorage.removeItem('fitforge_onboarding_data');
    setShowConfirmDialog(false);
    setLocation("/home");
  };

  const handleReplaceData = async () => {
    // User confirmed replacement - call force endpoint
    setIsProcessing(true);
    try {
      console.log("User confirmed replacement, calling force endpoint");
      await apiRequest('POST', '/api/auth/complete-onboarding-force', {
        ...storedOnboardingData.questionnaireData,
        generatedProgram: storedOnboardingData.generatedProgram,
      });

      // Clear localStorage and redirect
      localStorage.removeItem('fitforge_onboarding_data');
      setShowConfirmDialog(false);
      setLocation("/home");
    } catch (error) {
      console.error("Error forcing onboarding completion:", error);
      setError(error instanceof Error ? error.message : "Failed to replace program");
      setShowConfirmDialog(false);
    } finally {
      setIsProcessing(false);
    }
  };

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
    <>
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

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent data-testid="dialog-confirm-replace">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-warning/20 p-3 rounded-full">
                <AlertTriangle className="h-8 w-8 text-warning" />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-2xl">
              Replace Existing Program?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              You already have an active workout program and fitness assessment data. 
              Continuing will replace your current program with the new one you just created.
              <br /><br />
              <strong>This action cannot be undone.</strong> Your current progress and program will be archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleKeepExisting}
              disabled={isProcessing}
              data-testid="button-keep-existing"
              className="w-full sm:w-auto"
            >
              Keep Existing Program
            </Button>
            <Button
              variant="default"
              onClick={handleReplaceData}
              disabled={isProcessing}
              data-testid="button-replace-program"
              className="w-full sm:w-auto"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Replacing...
                </>
              ) : (
                "Replace with New Program"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
