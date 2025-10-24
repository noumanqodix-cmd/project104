import { useState, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import WelcomePage from "./components/WelcomePage";
import QuestionnaireFlow from "./components/QuestionnaireFlow";
import FitnessTestForm from "./components/FitnessTestForm";
import NutritionAssessment from "./components/NutritionAssessment";
import EquipmentSelector from "./components/EquipmentSelector";
import AvailabilityForm from "./components/AvailabilityForm";
import SubscriptionSelector from "./components/SubscriptionSelector";
import SignUpPage from "./components/SignUpPage";
import Dashboard from "./components/Dashboard";
import WorkoutProgramView from "./components/WorkoutProgramView";
import WorkoutSession from "./components/WorkoutSession";
import WorkoutSummary from "./components/WorkoutSummary";
import WorkoutHistory from "./components/WorkoutHistory";
import ProgressView from "./components/ProgressView";
import Home from "./pages/Home";
import History from "./pages/History";
import Body from "./pages/Body";
import FitnessTest from "./pages/FitnessTest";
import WorkoutPreview from "./pages/WorkoutPreview";
import Settings from "./pages/Settings";
import WorkoutPage from "./pages/Workout";
import WeightsTestForm from "./components/WeightsTestForm";
import BottomNavigation from "./components/BottomNavigation";
import TestTypeSelector from "./components/TestTypeSelector";
import ProgramPreviewPage from "./components/ProgramPreviewPage";
import OnboardingAssessment from "./components/OnboardingAssessment";
import Landing from "./pages/Landing";
import About from "./pages/About";
import HowItWorks from "./pages/HowItWorks";
import SmartProgression from "./pages/SmartProgression";

function OnboardingFlow() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<string>("welcome");
  const [questionnaireData, setQuestionnaireData] = useState<any>({});
  const [generatedProgram, setGeneratedProgram] = useState<any>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  const renderStep = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <WelcomePage
            onGetStarted={() => setLocation("/onboarding-assessment")}
            onLogin={() => setLocation("/home")}
          />
        );

      case "questionnaire":
        return (
          <QuestionnaireFlow
            onComplete={(data) => {
              setQuestionnaireData(data);
              setCurrentStep("testSelection");
            }}
            onBack={() => setCurrentStep("welcome")}
          />
        );

      case "testSelection":
        return (
          <TestTypeSelector
            onSelect={(testType) => {
              setQuestionnaireData({ ...questionnaireData, testType });
              if (testType === "bodyweight") {
                setCurrentStep("fitnessTest");
              } else {
                setCurrentStep("weightsTest");
              }
            }}
            onBack={() => setCurrentStep("questionnaire")}
          />
        );

      case "fitnessTest":
        return (
          <FitnessTestForm
            onComplete={(results) => {
              setQuestionnaireData({ ...questionnaireData, fitnessTest: results });
              setCurrentStep("nutrition");
            }}
            onBack={() => setCurrentStep("testSelection")}
          />
        );

      case "weightsTest":
        return (
          <WeightsTestForm
            onComplete={(results) => {
              setQuestionnaireData({ ...questionnaireData, weightsTest: results });
              setCurrentStep("nutrition");
            }}
            onBack={() => setCurrentStep("testSelection")}
          />
        );

      case "nutrition":
        return (
          <NutritionAssessment
            onComplete={(data) => {
              // Flatten nutrition data into questionnaireData
              setQuestionnaireData({ 
                ...questionnaireData,
                height: data.height,
                weight: data.weight,
                dateOfBirth: data.dateOfBirth,
                nutritionGoal: data.goal,
                bmr: data.bmr,
                targetCalories: data.calories,
                heartRateZones: data.heartRateZones,
              });
              setCurrentStep("equipment");
            }}
          />
        );

      case "equipment":
        return (
          <EquipmentSelector
            onComplete={(equipment) => {
              setQuestionnaireData({ ...questionnaireData, equipment });
              setCurrentStep("availability");
            }}
          />
        );

      case "availability":
        return (
          <AvailabilityForm
            onComplete={(data) => {
              setQuestionnaireData({ ...questionnaireData, availability: data });
              setCurrentStep("subscription");
            }}
          />
        );

      case "subscription":
        return (
          <SubscriptionSelector
            onSelect={async (tier, billingPeriod) => {
              const updatedData = { ...questionnaireData, subscriptionTier: tier, billingPeriod };
              setQuestionnaireData(updatedData);
              setCurrentStep("programPreview");
              
              // Generate program preview
              setIsGeneratingPreview(true);
              try {
                const response = await fetch("/api/programs/preview", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    experienceLevel: updatedData.experienceLevel,
                    fitnessTest: updatedData.fitnessTest,
                    weightsTest: updatedData.weightsTest,
                    nutritionGoal: updatedData.nutritionGoal,
                    equipment: updatedData.equipment || [],
                    workoutDuration: updatedData.availability?.minutesPerSession,
                    daysPerWeek: updatedData.availability?.daysPerWeek,
                    selectedDays: updatedData.availability?.selectedDays,
                    unitPreference: updatedData.unitPreference || "imperial",
                  }),
                });

                if (response.ok) {
                  const program = await response.json();
                  setGeneratedProgram(program);
                }
              } catch (error) {
                console.error("Failed to generate preview:", error);
              } finally {
                setIsGeneratingPreview(false);
              }
            }}
          />
        );

      case "programPreview":
        if (isGeneratingPreview || !generatedProgram) {
          return (
            <div className="min-h-screen bg-background flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-xl font-semibold">Generating Your Personalized Program...</p>
                <p className="text-muted-foreground mt-2">This may take a moment</p>
              </div>
            </div>
          );
        }

        return (
          <ProgramPreviewPage
            generatedProgram={generatedProgram}
            onContinue={() => setCurrentStep("signup")}
          />
        );

      case "signup":
        return (
          <SignUpPage
            generatedProgram={generatedProgram}
            questionnaireData={questionnaireData}
            onGenerateProgram={async () => {
              // Generate program using the same logic as preview
              const response = await fetch("/api/programs/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  experienceLevel: questionnaireData.experienceLevel,
                  fitnessTest: questionnaireData.fitnessTest,
                  weightsTest: questionnaireData.weightsTest,
                  nutritionGoal: questionnaireData.nutritionGoal,
                  equipment: questionnaireData.equipment || [],
                  workoutDuration: questionnaireData.availability?.minutesPerSession,
                  daysPerWeek: questionnaireData.availability?.daysPerWeek,
                  selectedDays: questionnaireData.availability?.selectedDays,
                  unitPreference: questionnaireData.unitPreference || "imperial",
                }),
              });

              if (response.ok) {
                const program = await response.json();
                setGeneratedProgram(program);
              } else {
                throw new Error("Failed to generate program");
              }
            }}
          />
        );

      default:
        return (
          <WelcomePage
            onGetStarted={() => setCurrentStep("questionnaire")}
            onLogin={() => setLocation("/home")}
          />
        );
    }
  };

  return renderStep();
}

function BodyweightTestRoute() {
  const [, setLocation] = useLocation();

  const saveFitnessAssessmentMutation = useMutation({
    mutationFn: async (assessmentData: any) => {
      const response = await apiRequest("POST", "/api/fitness-assessments", assessmentData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fitness-assessments"] });
      setLocation("/fitness-test");
    },
  });

  return (
    <FitnessTestForm
      onComplete={(results) => {
        saveFitnessAssessmentMutation.mutate({
          pushups: results.pushups,
          pullups: results.pullups,
          squats: results.squats,
          mileTime: results.mileTime,
        });
      }}
      onBack={() => setLocation("/fitness-test")}
    />
  );
}

function WeightsTestRoute() {
  const [, setLocation] = useLocation();

  const saveFitnessAssessmentMutation = useMutation({
    mutationFn: async (assessmentData: any) => {
      const response = await apiRequest("POST", "/api/fitness-assessments", assessmentData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fitness-assessments"] });
      setLocation("/fitness-test");
    },
  });

  return (
    <WeightsTestForm
      onComplete={(results) => {
        saveFitnessAssessmentMutation.mutate({
          squat1rm: results.squat,
          deadlift1rm: results.deadlift,
          benchPress1rm: results.benchPress,
          overheadPress1rm: results.overheadPress,
          barbellRow1rm: results.row,
        });
      }}
      onBack={() => setLocation("/fitness-test")}
    />
  );
}

function AppRoutes() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [workoutSummaryData, setWorkoutSummaryData] = useState<any>(null);

  const saveWorkoutMutation = useMutation({
    mutationFn: async ({ sessionId, ...workoutData }: any) => {
      return await apiRequest("PATCH", `/api/workout-sessions/${sessionId}`, workoutData);
    },
    onSuccess: async () => {
      console.log('[APP] Workout saved, refreshing all data...');
      
      // Force immediate refetch of all critical data (don't just invalidate)
      await queryClient.refetchQueries({ queryKey: ["/api/home-data"] });
      await queryClient.refetchQueries({ queryKey: ["/api/cycles/completion-check"] });
      await queryClient.refetchQueries({ queryKey: ["/api/workout-sessions"] });
      
      console.log('[APP] All data refreshed successfully');
    },
  });

  const showBottomNav = location.startsWith("/home") || 
                        location.startsWith("/history") || 
                        location.startsWith("/fitness-test") || 
                        location.startsWith("/body") ||
                        location.startsWith("/workout-preview") ||
                        location.startsWith("/program") ||
                        location.startsWith("/test/");

  return (
    <>
        <Switch>
          <Route path="/home">
            <Home />
          </Route>

          <Route path="/history">
            <History />
          </Route>

          <Route path="/body">
            <Body />
          </Route>

          <Route path="/settings">
            <Settings />
          </Route>

          <Route path="/fitness-test">
            <FitnessTest />
          </Route>

          <Route path="/workout-preview">
            <WorkoutPreview />
          </Route>

          <Route path="/test/bodyweight">
            <BodyweightTestRoute />
          </Route>

          <Route path="/test/weights">
            <WeightsTestRoute />
          </Route>

          <Route path="/dashboard">
            <Dashboard
              onStartWorkout={() => setLocation("/workout")}
              onViewProgram={() => setLocation("/program")}
              onViewHistory={() => setLocation("/history")}
              onViewProgress={() => setLocation("/progress")}
            />
          </Route>

          <Route path="/program">
            <WorkoutProgramView
              onBack={() => setLocation("/home")}
              onSave={() => {
                setLocation("/home");
              }}
            />
          </Route>

          <Route path="/workout">
            <WorkoutPage
              onComplete={(summary) => {
                console.log('[APP] Workout onComplete called with summary:', summary);
                setWorkoutSummaryData(summary);
                console.log('[APP] Navigating to /summary');
                setLocation("/summary");
              }}
            />
          </Route>

          <Route path="/summary">
            {workoutSummaryData ? (
              <WorkoutSummary
                {...workoutSummaryData}
                onFinish={async (difficulty) => {
                  if (workoutSummaryData) {
                    if (!workoutSummaryData.sessionId) {
                      toast({
                        title: "Cannot Save Workout",
                        description: "Workout session not properly initialized. Progress was not saved.",
                        variant: "destructive",
                      });
                      setLocation("/home");
                      return;
                    }
                    
                    await saveWorkoutMutation.mutateAsync({
                      sessionId: workoutSummaryData.sessionId,
                      status: workoutSummaryData.incomplete ? "partial" : "complete",
                      durationMinutes: Math.floor(workoutSummaryData.duration / 60),
                      elapsedSeconds: workoutSummaryData.incomplete ? workoutSummaryData.duration : undefined, // Save timer state for partial workouts
                      notes: workoutSummaryData.incomplete ? `Ended early - completed ${workoutSummaryData.completedExercises || 0} exercises` : undefined,
                      sessionDate: new Date(), // User's local time
                    });
                  }
                  
                  setLocation("/home");
                }}
              />
            ) : (
              <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <Card className="p-8 max-w-md text-center">
                  <h2 className="text-2xl font-bold mb-2">No Workout Data</h2>
                  <p className="text-muted-foreground mb-4">
                    Workout summary data is missing. Returning to home.
                  </p>
                  <Button onClick={() => setLocation("/home")} data-testid="button-back-home">
                    Back to Home
                  </Button>
                </Card>
              </div>
            )}
          </Route>

          <Route path="/workout-history">
            <WorkoutHistory onBack={() => setLocation("/home")} />
          </Route>

          <Route path="/progress">
            <ProgressView onBack={() => setLocation("/home")} />
          </Route>


          <Route path="/onboarding-assessment">
            <OnboardingAssessment />
          </Route>

          <Route path="/about">
            <About />
          </Route>

          <Route path="/how-it-works">
            <HowItWorks />
          </Route>

          <Route path="/science">
            <SmartProgression />
          </Route>

          <Route path="/">
            <Landing />
          </Route>
        </Switch>
      
      {showBottomNav && <BottomNavigation />}
      <Toaster />
    </>
  );
}

function App() {
  // Initialize theme on app mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const initialTheme = savedTheme || "dark"; // Default to dark mode
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppRoutes />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
