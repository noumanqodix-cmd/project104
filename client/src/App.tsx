import { useState } from "react";
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

type Screen =
  | "welcome"
  | "questionnaire"
  | "fitnessTest"
  | "nutrition"
  | "equipment"
  | "availability"
  | "signup"
  | "dashboard"
  | "program"
  | "workout"
  | "summary"
  | "history"
  | "progress";

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>("welcome");
  const [questionnaireData, setQuestionnaireData] = useState<any>({});
  const [workoutSummaryData, setWorkoutSummaryData] = useState<any>(null);

  const renderScreen = () => {
    switch (currentScreen) {
      case "welcome":
        return <WelcomePage onGetStarted={() => setCurrentScreen("questionnaire")} />;

      case "questionnaire":
        return (
          <QuestionnaireFlow
            onComplete={(data) => {
              setQuestionnaireData(data);
              if (data.experienceLevel === "unknown") {
                setCurrentScreen("fitnessTest");
              } else {
                setCurrentScreen("nutrition");
              }
            }}
            onBack={() => setCurrentScreen("welcome")}
          />
        );

      case "fitnessTest":
        return (
          <FitnessTestForm
            onComplete={(results) => {
              setQuestionnaireData({ ...questionnaireData, fitnessTest: results });
              setCurrentScreen("nutrition");
            }}
          />
        );

      case "nutrition":
        return (
          <NutritionAssessment
            onComplete={(data) => {
              setQuestionnaireData({ ...questionnaireData, nutrition: data });
              setCurrentScreen("equipment");
            }}
          />
        );

      case "equipment":
        return (
          <EquipmentSelector
            onComplete={(equipment) => {
              setQuestionnaireData({ ...questionnaireData, equipment });
              setCurrentScreen("availability");
            }}
          />
        );

      case "availability":
        return (
          <AvailabilityForm
            onComplete={(data) => {
              setQuestionnaireData({ ...questionnaireData, availability: data });
              setCurrentScreen("signup");
            }}
          />
        );

      case "signup":
        return (
          <SignUpPage
            onSignUp={(email, password) => {
              console.log("User signed up:", email, questionnaireData);
              setCurrentScreen("dashboard");
            }}
          />
        );

      case "dashboard":
        return (
          <Dashboard
            onStartWorkout={() => setCurrentScreen("workout")}
            onViewProgram={() => setCurrentScreen("program")}
            onViewHistory={() => setCurrentScreen("history")}
            onViewProgress={() => setCurrentScreen("progress")}
          />
        );

      case "program":
        return (
          <WorkoutProgramView
            onBack={() => setCurrentScreen("dashboard")}
            onSave={(exercises) => {
              console.log("Program saved:", exercises);
              setCurrentScreen("dashboard");
            }}
          />
        );

      case "workout":
        return (
          <WorkoutSession
            onComplete={(summary) => {
              setWorkoutSummaryData(summary);
              setCurrentScreen("summary");
            }}
          />
        );

      case "summary":
        return (
          <WorkoutSummary
            {...workoutSummaryData}
            onFinish={(difficulty) => {
              console.log("Workout difficulty:", difficulty);
              setCurrentScreen("dashboard");
            }}
          />
        );

      case "history":
        return <WorkoutHistory onBack={() => setCurrentScreen("dashboard")} />;

      case "progress":
        return <ProgressView onBack={() => setCurrentScreen("dashboard")} />;

      default:
        return <WelcomePage onGetStarted={() => setCurrentScreen("questionnaire")} />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {renderScreen()}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
