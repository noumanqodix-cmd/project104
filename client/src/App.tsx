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
import WeightsTestForm from "./components/WeightsTestForm";
import BottomNavigation from "./components/BottomNavigation";

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
              if (data.experienceLevel === "unknown") {
                setCurrentStep("fitnessTest");
              } else {
                setCurrentStep("nutrition");
              }
            }}
            onBack={() => setCurrentStep("welcome")}
          />
        );

      case "fitnessTest":
        return (
          <FitnessTestForm
            onComplete={(results) => {
              setQuestionnaireData({ ...questionnaireData, fitnessTest: results });
              setCurrentStep("nutrition");
            }}
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
              setCurrentStep("signup");
            }}
          />
        );

      case "signup":
        return (
          <SignUpPage
            onSignUp={(email, password) => {
              console.log("User signed up:", email, questionnaireData);
              setLocation("/");
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

  const showBottomNav = !location.startsWith("/onboarding") && 
                        !location.startsWith("/workout") && 
                        !location.startsWith("/summary") &&
                        !location.startsWith("/program") &&
                        !location.startsWith("/test/");

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          <Route path="/onboarding">
            <OnboardingFlow />
          </Route>

          <Route path="/">
            <Home />
          </Route>

          <Route path="/history">
            <History />
          </Route>

          <Route path="/body">
            <Body />
          </Route>

          <Route path="/fitness-test">
            <FitnessTest />
          </Route>

          <Route path="/test/bodyweight">
            <FitnessTestForm
              onComplete={(results) => {
                console.log("Bodyweight test completed:", results);
                setLocation("/fitness-test");
              }}
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
              onBack={() => setLocation("/")}
              onSave={(exercises) => {
                console.log("Program saved:", exercises);
                setLocation("/");
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
                setLocation("/");
              }}
            />
          </Route>

          <Route path="/workout-history">
            <WorkoutHistory onBack={() => setLocation("/")} />
          </Route>

          <Route path="/progress">
            <ProgressView onBack={() => setLocation("/")} />
          </Route>

          <Route>
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
