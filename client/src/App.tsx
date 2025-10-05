import { useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
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

function OnboardingFlow() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState<string>("welcome");
  const [questionnaireData, setQuestionnaireData] = useState<any>({});

  const renderStep = () => {
    switch (currentStep) {
      case "welcome":
        return <WelcomePage onGetStarted={() => setCurrentStep("questionnaire")} />;

      case "questionnaire":
        return (
          <QuestionnaireFlow
            onComplete={(data) => {
              setQuestionnaireData(data);
              if (data.unitPreference) {
                localStorage.setItem('unitPreference', data.unitPreference);
              }
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
            onSelect={(tier, billingPeriod) => {
              setQuestionnaireData({ ...questionnaireData, subscriptionTier: tier, billingPeriod });
              setCurrentStep("signup");
            }}
          />
        );

      case "signup":
        return (
          <SignUpPage
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
                    bmr: questionnaireData.nutrition?.bmr,
                    targetCalories: questionnaireData.nutrition?.calories,
                    nutritionGoal: questionnaireData.nutrition?.goal,
                    unitPreference: questionnaireData.unitPreference || "imperial",
                    equipment: questionnaireData.equipment || [],
                    workoutDuration: questionnaireData.availability?.minutesPerSession,
                    fitnessLevel: questionnaireData.experienceLevel,
                  }),
                });

                if (!response.ok) {
                  const error = await response.json();
                  console.error("Signup failed:", error);
                  throw new Error(error.error || "Signup failed");
                }

                console.log("User signed up:", email, questionnaireData);
                
                // Wait 2 seconds for session cookie to be fully set in browser
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Save fitness assessment (must complete before program generation)
                if (questionnaireData.fitnessTest || questionnaireData.weightsTest) {
                  const assessmentResponse = await fetch("/api/fitness-assessments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      experienceLevel: questionnaireData.experienceLevel,
                      ...questionnaireData.fitnessTest,
                      ...questionnaireData.weightsTest,
                    }),
                  });
                  
                  if (!assessmentResponse.ok) {
                    const error = await assessmentResponse.json();
                    throw new Error(error.error || "Failed to save fitness assessment");
                  }
                }
                
                // Seed exercises (must complete before program generation)
                const seedResponse = await fetch("/api/exercises/seed", { 
                  method: "POST",
                  credentials: "include",
                });
                
                if (!seedResponse.ok) {
                  const error = await seedResponse.json();
                  throw new Error(error.error || "Failed to seed exercises");
                }
                
                // Generate workout program automatically
                const programResponse = await fetch("/api/programs/generate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({}),
                });
                
                if (!programResponse.ok) {
                  const error = await programResponse.json();
                  throw new Error(error.error || "Failed to generate workout program");
                }
                
                // Navigate to home with program ready
                setLocation("/home");
              } catch (error) {
                console.error("Signup error:", error);
                throw error; // Re-throw so SignUpPage can handle it
              }
            }}
          />
        );

      default:
        return <WelcomePage onGetStarted={() => setCurrentStep("questionnaire")} />;
    }
  };

  return renderStep();
}

function App() {
  const [location, setLocation] = useLocation();
  const [workoutSummaryData, setWorkoutSummaryData] = useState<any>(null);

  const showBottomNav = location.startsWith("/home") || 
                        location.startsWith("/history") || 
                        location.startsWith("/fitness-test") || 
                        location.startsWith("/body") ||
                        location.startsWith("/workout-preview") ||
                        location.startsWith("/program") ||
                        location.startsWith("/test/");

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
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
            <FitnessTestForm
              onComplete={(results) => {
                console.log("Bodyweight test completed:", results);
                setLocation("/fitness-test");
              }}
              onBack={() => setLocation("/fitness-test")}
            />
          </Route>

          <Route path="/test/weights">
            <WeightsTestForm
              onComplete={(results) => {
                console.log("Weights test completed:", results);
                setLocation("/fitness-test");
              }}
              onBack={() => setLocation("/fitness-test")}
            />
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
              onFinish={(difficulty) => {
                console.log("Workout difficulty:", difficulty);
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
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
