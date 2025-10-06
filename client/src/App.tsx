import { useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import WelcomePage from "./components/WelcomePage";
import QuestionnaireFlow from "./components/QuestionnaireFlow";
import FitnessTestForm from "./components/FitnessTestForm";
import NutritionAssessment from "./components/NutritionAssessment";
import EquipmentSelector from "./components/EquipmentSelector";
import AvailabilityForm from "./components/AvailabilityForm";
import SubscriptionSelector from "./components/SubscriptionSelector";
import SignUpPage from "./components/SignUpPage";
import LoginPage from "./components/LoginPage";
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
import WeightsTestForm from "./components/WeightsTestForm";
import BottomNavigation from "./components/BottomNavigation";
import TestTypeSelector from "./components/TestTypeSelector";
import ProgramPreviewPage from "./components/ProgramPreviewPage";

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
            onGetStarted={() => setCurrentStep("questionnaire")}
            onLogin={() => setCurrentStep("login")}
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
              setQuestionnaireData({ ...questionnaireData, nutrition: data });
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
              setQuestionnaireData({ ...questionnaireData, subscriptionTier: tier, billingPeriod });
              setCurrentStep("programPreview");
              
              // Generate program preview
              setIsGeneratingPreview(true);
              try {
                const response = await fetch("/api/programs/preview", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    experienceLevel: questionnaireData.experienceLevel,
                    fitnessTest: questionnaireData.fitnessTest,
                    weightsTest: questionnaireData.weightsTest,
                    nutritionGoal: questionnaireData.nutrition?.goal,
                    equipment: questionnaireData.equipment || [],
                    workoutDuration: questionnaireData.availability?.minutesPerSession,
                    daysPerWeek: questionnaireData.availability?.daysPerWeek,
                    unitPreference: questionnaireData.unitPreference || "imperial",
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

      case "login":
        return (
          <LoginPage
            onLogin={async (email, password) => {
              try {
                const response = await fetch("/api/auth/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ email, password }),
                });

                if (!response.ok) {
                  const error = await response.json();
                  throw new Error(error.error || "Login failed");
                }

                // Wait for session cookie to propagate
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Navigate to home
                setLocation("/home");
              } catch (error) {
                console.error("Login error:", error);
                throw error;
              }
            }}
            onBack={() => setCurrentStep("welcome")}
          />
        );

      case "signup":
        return (
          <SignUpPage
            onLoginRedirect={() => setCurrentStep("login")}
            onSignUp={async (email, password) => {
              try {
                const response = await fetch("/api/auth/signup", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    email,
                    password,
                    subscriptionTier: questionnaireData.subscriptionTier || "free",
                    height: questionnaireData.nutrition?.height,
                    weight: questionnaireData.nutrition?.weight,
                    age: questionnaireData.nutrition?.age,
                    bmr: questionnaireData.nutrition?.bmr,
                    targetCalories: questionnaireData.nutrition?.calories,
                    nutritionGoal: questionnaireData.nutrition?.goal,
                    unitPreference: questionnaireData.unitPreference || "imperial",
                    equipment: questionnaireData.equipment || [],
                    workoutDuration: questionnaireData.availability?.minutesPerSession,
                    daysPerWeek: questionnaireData.availability?.daysPerWeek,
                    fitnessLevel: questionnaireData.experienceLevel,
                    experienceLevel: questionnaireData.experienceLevel,
                    fitnessTest: questionnaireData.fitnessTest,
                    weightsTest: questionnaireData.weightsTest,
                    generatedProgram: generatedProgram, // Pass pre-generated program
                  }),
                });

                if (!response.ok) {
                  const error = await response.json();
                  console.error("Signup failed:", error);
                  throw new Error(error.error || "Signup failed");
                }

                console.log("User signed up:", email, questionnaireData);
                
                // Wait for session cookie to propagate to browser
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Navigate to home - program has been generated server-side
                setLocation("/home");
              } catch (error) {
                console.error("Signup error:", error);
                throw error; // Re-throw so SignUpPage can handle it
              }
            }}
          />
        );

      default:
        return (
          <WelcomePage
            onGetStarted={() => setCurrentStep("questionnaire")}
            onLogin={() => setCurrentStep("login")}
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
  const [location, setLocation] = useLocation();
  const [workoutSummaryData, setWorkoutSummaryData] = useState<any>(null);

  const saveWorkoutMutation = useMutation({
    mutationFn: async (workoutData: any) => {
      return await apiRequest("POST", "/api/workout-sessions", workoutData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions"] });
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
                console.log("Program saved");
                setLocation("/home");
              }}
            />
          </Route>

          <Route path="/workout">
            <WorkoutSession
              onComplete={(summary) => {
                setWorkoutSummaryData(summary);
                setLocation("/summary");
              }}
            />
          </Route>

          <Route path="/summary">
            <WorkoutSummary
              {...workoutSummaryData}
              onFinish={async (difficulty) => {
                console.log("Workout difficulty:", difficulty);
                
                if (workoutSummaryData) {
                  await saveWorkoutMutation.mutateAsync({
                    programWorkoutId: workoutSummaryData.programWorkoutId,
                    completed: 1,
                    durationMinutes: Math.floor(workoutSummaryData.duration / 60),
                    notes: workoutSummaryData.incomplete ? `Ended early - completed ${workoutSummaryData.completedExercises || 0} exercises` : undefined,
                  });
                }
                
                setLocation("/home");
              }}
            />
          </Route>

          <Route path="/workout-history">
            <WorkoutHistory onBack={() => setLocation("/home")} />
          </Route>

          <Route path="/progress">
            <ProgressView onBack={() => setLocation("/home")} />
          </Route>

          <Route path="/">
            <OnboardingFlow />
          </Route>
        </Switch>
      
      {showBottomNav && <BottomNavigation />}
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppRoutes />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
