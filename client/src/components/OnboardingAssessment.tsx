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
import { formatLocalDate } from "@shared/dateUtils";

type AssessmentStep = "questionnaire" | "nutrition" | "testSelection" | "fitnessTest" | "weightsTest";

export default function OnboardingAssessment() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<AssessmentStep>("questionnaire");
  const [questionnaireData, setQuestionnaireData] = useState<QuestionnaireData | null>(null);
  const [nutritionData, setNutritionData] = useState<NutritionData | null>(null);
  const [testType, setTestType] = useState<"bodyweight" | "weights" | "skip" | null>(null);

  const completeAssessmentMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('[ONBOARDING] Mutation started with data:', data);
      
      // Check if user is authenticated
      try {
        console.log('[ONBOARDING] Checking authentication...');
        const userResponse = await apiRequest("GET", "/api/auth/user");
        const user = await userResponse.json();
        console.log('[ONBOARDING] User authentication response:', user);
        
        if (user && user.id) {
          // User is authenticated, save directly
          console.log('[ONBOARDING] User authenticated, saving assessment...');
          const response = await apiRequest("POST", "/api/onboarding-assessment/complete", {
            ...data,
            startDate: formatLocalDate(new Date()), // Include user's local date for timezone-safe session generation
          });
          const responseData = await response.json();
          console.log('[ONBOARDING] Assessment saved successfully:', responseData);
          return { authenticated: true, data: responseData };
        }
      } catch (error) {
        console.log('[ONBOARDING] Authentication check failed:', error);
        // User not authenticated
      }
      
      // User not authenticated, save to localStorage and redirect to login
      console.log('[ONBOARDING] User not authenticated, saving to localStorage');
      return { authenticated: false, data };
    },
    onSuccess: (result) => {
      console.log('[ONBOARDING] Mutation success, result:', result);
      
      if (result.authenticated) {
        // Direct save successful
        console.log('[ONBOARDING] Authenticated flow - invalidating queries and navigating to /home');
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        queryClient.invalidateQueries({ queryKey: ["/api/fitness-assessments"] });
        toast({
          title: "Assessment Complete!",
          description: "Your profile has been set up successfully.",
        });
        console.log('[ONBOARDING] Navigating to /home');
        setLocation("/home");
      } else {
        // Save to localStorage and redirect to login
        console.log('[ONBOARDING] Unauthenticated flow - saving to localStorage and redirecting to login');
        const onboardingData = {
          questionnaireData: result.data,
          isOnboardingAssessment: true,
        };
        localStorage.setItem('fitforge_onboarding_data', JSON.stringify(onboardingData));
        console.log('[ONBOARDING] Redirecting to /api/login');
        window.location.href = "/api/login";
      }
    },
    onError: (error: any) => {
      console.error('[ONBOARDING] Mutation error:', error);
      console.error('[ONBOARDING] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      toast({
        title: "Assessment Failed",
        description: error.message || "Failed to save assessment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFitnessTestComplete = (results: FitnessTestResults) => {
    console.log('[ONBOARDING] handleFitnessTestComplete called with results:', results);
    
    try {
      // Combine all data and submit
      const completeData = {
        // Questionnaire data
        experienceLevel: questionnaireData?.experienceLevel,
        unitPreference: questionnaireData?.unitPreference,
        equipment: questionnaireData?.equipment || [],
        workoutDuration: questionnaireData?.availability?.minutesPerSession,
        daysPerWeek: questionnaireData?.availability?.daysPerWeek,
        selectedDays: questionnaireData?.availability?.selectedDays || [],
        
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
          walkingLunges: results.walkingLunges,
          singleLegRdl: results.singleLegRdl,
          plankHold: results.plankHold,
          mileTime: results.mileTime,
        },
      };

      console.log('[ONBOARDING] Prepared complete data:', completeData);
      console.log('[ONBOARDING] Triggering mutation...');
      completeAssessmentMutation.mutate(completeData);
    } catch (error) {
      console.error('[ONBOARDING] Error in handleFitnessTestComplete:', error);
      toast({
        title: "Error",
        description: "Failed to prepare assessment data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleWeightsTestComplete = (results: WeightsTestResults) => {
    console.log('[ONBOARDING] handleWeightsTestComplete called with results:', results);
    
    try {
      // Combine all data and submit
      const completeData = {
        // Questionnaire data
        experienceLevel: questionnaireData?.experienceLevel,
        unitPreference: questionnaireData?.unitPreference,
        equipment: questionnaireData?.equipment || [],
        workoutDuration: questionnaireData?.availability?.minutesPerSession,
        daysPerWeek: questionnaireData?.availability?.daysPerWeek,
        selectedDays: questionnaireData?.availability?.selectedDays || [],
        
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
          dumbbellLunge1rm: results.dumbbellLunge,
          plankHold: results.plankHold,
          farmersCarry1rm: results.farmersCarry,
          mileTime: results.mileTime,
        },
      };

      console.log('[ONBOARDING] Prepared complete data:', completeData);
      console.log('[ONBOARDING] Triggering mutation...');
      completeAssessmentMutation.mutate(completeData);
    } catch (error) {
      console.error('[ONBOARDING] Error in handleWeightsTestComplete:', error);
      toast({
        title: "Error",
        description: "Failed to prepare assessment data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSkipTest = () => {
    console.log('[ONBOARDING] handleSkipTest called - user skipped fitness test');
    
    try {
      // Submit without fitness test data - program will use conservative defaults
      const completeData = {
        // Questionnaire data
        experienceLevel: questionnaireData?.experienceLevel,
        unitPreference: questionnaireData?.unitPreference,
        equipment: questionnaireData?.equipment || [],
        workoutDuration: questionnaireData?.availability?.minutesPerSession,
        daysPerWeek: questionnaireData?.availability?.daysPerWeek,
        selectedDays: questionnaireData?.availability?.selectedDays || [],
        
        // Nutrition data
        height: nutritionData?.height,
        weight: nutritionData?.weight,
        dateOfBirth: nutritionData?.dateOfBirth,
        nutritionGoal: nutritionData?.goal,
        bmr: nutritionData?.bmr,
        tdee: nutritionData?.calories,
        heartRateZones: nutritionData?.heartRateZones,
        
        // No fitness test data - AI will use experience level for conservative defaults
      };

      console.log('[ONBOARDING] Prepared complete data (skip test):', completeData);
      console.log('[ONBOARDING] Triggering mutation...');
      completeAssessmentMutation.mutate(completeData);
    } catch (error) {
      console.error('[ONBOARDING] Error in handleSkipTest:', error);
      toast({
        title: "Error",
        description: "Failed to prepare assessment data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case "questionnaire":
        return (
          <QuestionnaireFlow
            onComplete={(data) => {
              setQuestionnaireData(data);
              // Save unitPreference to localStorage for NutritionAssessment to read
              if (data.unitPreference) {
                localStorage.setItem('unitPreference', data.unitPreference);
              }
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
              } else if (type === "weights") {
                setCurrentStep("weightsTest");
              } else if (type === "skip") {
                // Skip test and submit with conservative defaults
                handleSkipTest();
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
