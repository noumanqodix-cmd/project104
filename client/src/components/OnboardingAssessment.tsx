import { useState } from "react";
import { useLocation } from "wouter";
import QuestionnaireFlow, { type QuestionnaireData } from "./QuestionnaireFlow";
import NutritionAssessment, { type NutritionData } from "./NutritionAssessment";
import TestTypeSelector from "./TestTypeSelector";
import FitnessTestForm, { type FitnessTestResults } from "./FitnessTestForm";
import WeightsTestForm, { type WeightsTestResults } from "./WeightsTestForm";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AssessmentStep = "questionnaire" | "nutrition" | "testSelection" | "fitnessTest" | "weightsTest";

export default function OnboardingAssessment() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<AssessmentStep>("questionnaire");
  const [questionnaireData, setQuestionnaireData] = useState<QuestionnaireData | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionData | null>(null);
  const [testType, setTestType] = useState<"bodyweight" | "weights" | null>(null);

  const completeAssessmentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/onboarding-assessment/complete", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fitness-assessments"] });
      toast({
        title: "Assessment Complete!",
        description: "Your profile has been set up successfully.",
      });
      setLocation("/home");
    },
    onError: (error: any) => {
      toast({
        title: "Assessment Failed",
        description: error.message || "Failed to save assessment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFitnessTestComplete = (results: FitnessTestResults) => {
    // Combine all data and submit
    const completeData = {
      // Questionnaire data
      experienceLevel: questionnaireData?.experienceLevel,
      unitPreference: questionnaireData?.unitPreference,
      equipment: questionnaireData?.equipment || [],
      workoutDuration: questionnaireData?.availability?.minutesPerSession,
      daysPerWeek: questionnaireData?.availability?.daysPerWeek,
      
      // Nutrition data
      height: nutritionData?.height,
      weight: nutritionData?.weight,
      dateOfBirth: nutritionData?.dateOfBirth,
      nutritionGoal: nutritionData?.goal,
      bmr: nutritionData?.bmr,
      tdee: nutritionData?.calories,
      heartRateZones: nutritionData?.heartRateZones,
      
      // Fitness test data
      fitnessTest: {
        pushups: results.pushups,
        pullups: results.pullups,
        squats: results.squats,
        mileTime: results.mileTime,
      },
    };

    completeAssessmentMutation.mutate(completeData);
  };

  const handleWeightsTestComplete = (results: WeightsTestResults) => {
    // Combine all data and submit
    const completeData = {
      // Questionnaire data
      experienceLevel: questionnaireData?.experienceLevel,
      unitPreference: questionnaireData?.unitPreference,
      equipment: questionnaireData?.equipment || [],
      workoutDuration: questionnaireData?.availability?.minutesPerSession,
      daysPerWeek: questionnaireData?.availability?.daysPerWeek,
      
      // Nutrition data
      height: nutritionData?.height,
      weight: nutritionData?.weight,
      dateOfBirth: nutritionData?.dateOfBirth,
      nutritionGoal: nutritionData?.goal,
      bmr: nutritionData?.bmr,
      tdee: nutritionData?.calories,
      heartRateZones: nutritionData?.heartRateZones,
      
      // Weights test data
      weightsTest: {
        squat1rm: results.squat,
        deadlift1rm: results.deadlift,
        benchPress1rm: results.benchPress,
        overheadPress1rm: results.overheadPress,
        barbellRow1rm: results.row,
      },
    };

    completeAssessmentMutation.mutate(completeData);
  };

  const renderStep = () => {
    switch (currentStep) {
      case "questionnaire":
        return (
          <QuestionnaireFlow
            onComplete={(data) => {
              setQuestionnaireData(data);
              setCurrentStep("nutrition");
            }}
            onBack={() => setLocation("/")}
          />
        );

      case "nutrition":
        return (
          <NutritionAssessment
            onComplete={(data) => {
              setNutritionData(data);
              setCurrentStep("testSelection");
            }}
          />
        );

      case "testSelection":
        return (
          <TestTypeSelector
            onSelect={(type) => {
              setTestType(type);
              if (type === "bodyweight") {
                setCurrentStep("fitnessTest");
              } else {
                setCurrentStep("weightsTest");
              }
            }}
            onBack={() => setCurrentStep("nutrition")}
          />
        );

      case "fitnessTest":
        return (
          <FitnessTestForm
            onComplete={handleFitnessTestComplete}
            onBack={() => setCurrentStep("testSelection")}
          />
        );

      case "weightsTest":
        return (
          <WeightsTestForm
            onComplete={handleWeightsTestComplete}
            onBack={() => setCurrentStep("testSelection")}
          />
        );

      default:
        return null;
    }
  };

  return renderStep();
}
