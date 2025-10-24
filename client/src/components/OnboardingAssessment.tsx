// ==========================================
// ONBOARDING ASSESSMENT - New User Setup Journey
// ==========================================
// This component guides authenticated new users through onboarding
// Users reach this page after: Landing → Marketing → Login → No existing program
//
// ONBOARDING FLOW (5 STEPS):
// 1. QUESTIONNAIRE → Collect experience level, available equipment, training schedule
// 2. NUTRITION → Calculate BMR/TDEE, heart rate zones, set nutrition goals
// 3. TEST SELECTION → Choose fitness test type (bodyweight, weights, or skip)
// 4. FITNESS TEST → Complete chosen test (bodyweight OR weights OR skip)
// 5. DATE SELECTION → Pick calendar dates for workout cycle
// 6. SUBMIT → Save to database and generate workout program → Navigate to /home
//
// DATA COLLECTED:
// - Training preferences (days/week, duration, equipment)
// - Body metrics (height, weight, age)
// - Nutrition goals (gain/maintain/lose)
// - Fitness test results (optional but recommended)
// - Calendar dates for first workout cycle
//
// WHY THIS MATTERS:
// All this information is used to create a science-backed workout program
// tailored to your abilities and goals using functional movement patterns
// ==========================================

import { useState } from "react";
import { useLocation } from "wouter";
import IntroSlides from "./IntroSlides";
import QuestionnaireFlow, { type QuestionnaireData } from "./QuestionnaireFlow";
import NutritionAssessment, { type NutritionData } from "./NutritionAssessment";
import TestTypeSelector from "./TestTypeSelector";
import FitnessTestForm, { type FitnessTestResults } from "./FitnessTestForm";
import WeightsTestForm, { type WeightsTestResults } from "./WeightsTestForm";
import { DayPicker } from "./DayPicker";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatLocalDate, getTodayLocal } from "@shared/dateUtils";

// Defines which step of onboarding the user is on
type AssessmentStep = "intro" | "questionnaire" | "nutrition" | "testSelection" | "fitnessTest" | "weightsTest" | "dateSelection";

export default function OnboardingAssessment() {
  // ==========================================
  // STATE MANAGEMENT (Component Memory)
  // ==========================================
  
  const [, setLocation] = useLocation();  // Navigation function
  const { toast } = useToast();  // Popup notification function
  
  // STATE: Which step is user currently on?
  // Flow: intro → questionnaire → nutrition → testSelection → fitnessTest/weightsTest → dateSelection
  const [currentStep, setCurrentStep] = useState<AssessmentStep>("intro");
  
  // STATE: Data collected from questionnaire step
  // Includes: experience level, equipment, schedule (days/week, duration)
  const [questionnaireData, setQuestionnaireData] = useState<QuestionnaireData | null>(null);
  
  // STATE: Data collected from nutrition step
  // Includes: height, weight, age, nutrition goal, calculated BMR/TDEE, heart rate zones
  const [nutritionData, setNutritionData] = useState<NutritionData | null>(null);
  
  // STATE: Which fitness test type did user chose?
  // "bodyweight" = push-ups, pull-ups, squats | "weights" = 1RM lifts | "skip" = no test
  const [testType, setTestType] = useState<"bodyweight" | "weights" | "skip" | null>(null);
  
  // STATE: Fitness/Weights test results (stored to use later when submitting)
  const [fitnessTestResults, setFitnessTestResults] = useState<FitnessTestResults | null>(null);
  const [weightsTestResults, setWeightsTestResults] = useState<WeightsTestResults | null>(null);
  
  // STATE: Selected dates for workout cycle (replaces selectedDays)
  // Array of calendar dates (YYYY-MM-DD strings) chosen by user for their workouts
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // ==========================================
  // MUTATION: Submit Complete Onboarding Data
  // ==========================================
  // Saves all collected onboarding data to database and generates workout program
  // User is always authenticated at this point (logged in via marketing → auth flow)
  const completeAssessmentMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log('[ONBOARDING] Saving assessment data:', data);
      
      const response = await apiRequest("POST", "/api/onboarding-assessment/complete", {
        ...data,
        startDate: formatLocalDate(getTodayLocal()),
      });
      
      return await response.json();
    },
    
    onSuccess: () => {
      console.log('[ONBOARDING] Assessment complete, redirecting to home');
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fitness-assessments"] });
      toast({
        title: "Assessment Complete!",
        description: "Your personalized program is ready.",
      });
      setLocation("/home");
    },
    
    onError: (error: any) => {
      console.error('[ONBOARDING] Error:', error);
      toast({
        title: "Assessment Failed",
        description: error.message || "Failed to save assessment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFitnessTestComplete = (results: FitnessTestResults) => {
    console.log('[ONBOARDING] handleFitnessTestComplete called with results:', results);
    
    // Store fitness test results for later submission
    setFitnessTestResults(results);
    
    // Move to date selection step instead of submitting immediately
    setCurrentStep("dateSelection");
  };

  const handleWeightsTestComplete = (results: WeightsTestResults) => {
    console.log('[ONBOARDING] handleWeightsTestComplete called with results:', results);
    
    // Store weights test results for later submission
    setWeightsTestResults(results);
    
    // Move to date selection step instead of submitting immediately
    setCurrentStep("dateSelection");
  };

  const handleSkipTest = () => {
    console.log('[ONBOARDING] handleSkipTest called - user skipped fitness test');
    
    // No test results to store, just move to date selection
    // Program will use conservative defaults based on experience level
    setCurrentStep("dateSelection");
  };

  const handleDateSelection = (dates: string[]) => {
    console.log('[ONBOARDING] handleDateSelection called with dates:', dates);
    
    try {
      // Build complete data with all collected information
      const completeData = {
        // Questionnaire data
        experienceLevel: questionnaireData?.experienceLevel,
        unitPreference: questionnaireData?.unitPreference,
        equipment: questionnaireData?.equipment || [],
        workoutDuration: questionnaireData?.availability?.minutesPerSession,
        daysPerWeek: questionnaireData?.availability?.daysPerWeek,
        selectedDates: dates,  // NEW: Calendar dates instead of day-of-week
        
        // Nutrition data
        height: nutritionData?.height,
        weight: nutritionData?.weight,
        dateOfBirth: nutritionData?.dateOfBirth,
        nutritionGoal: nutritionData?.goal,
        bmr: nutritionData?.bmr,
        tdee: nutritionData?.calories,
        heartRateZones: nutritionData?.heartRateZones,
        
        // Fitness test data (if available)
        ...(fitnessTestResults && {
          fitnessTest: {
            pushups: fitnessTestResults.pushups,
            pikePushups: fitnessTestResults.pikePushups,
            pullups: fitnessTestResults.pullups,
            squats: fitnessTestResults.squats,
            walkingLunges: fitnessTestResults.walkingLunges,
            singleLegRdl: fitnessTestResults.singleLegRdl,
            plankHold: fitnessTestResults.plankHold,
            mileTime: fitnessTestResults.mileTime,
          },
        }),
        
        // Weights test data (if available)
        ...(weightsTestResults && {
          weightsTest: {
            squat1rm: weightsTestResults.squat,
            deadlift1rm: weightsTestResults.deadlift,
            benchPress1rm: weightsTestResults.benchPress,
            overheadPress1rm: weightsTestResults.overheadPress,
            barbellRow1rm: weightsTestResults.row,
            dumbbellLunge1rm: weightsTestResults.dumbbellLunge,
            plankHold: weightsTestResults.plankHold,
            farmersCarry1rm: weightsTestResults.farmersCarry,
            mileTime: weightsTestResults.mileTime,
          },
        }),
      };

      console.log('[ONBOARDING] Prepared complete data:', completeData);
      console.log('[ONBOARDING] Triggering mutation...');
      completeAssessmentMutation.mutate(completeData);
    } catch (error) {
      console.error('[ONBOARDING] Error in handleDateSelection:', error);
      toast({
        title: "Error",
        description: "Failed to prepare assessment data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case "intro":
        return (
          <IntroSlides
            onComplete={() => {
              setCurrentStep("questionnaire");
            }}
          />
        );

      case "questionnaire":
        return (
          <QuestionnaireFlow
            onComplete={(data) => {
              setQuestionnaireData(data);
              setCurrentStep("nutrition");
            }}
            onBack={() => setCurrentStep("intro")}
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

      case "dateSelection":
        return (
          <DayPicker
            daysPerWeek={questionnaireData?.availability?.daysPerWeek || 3}
            onDatesSelected={(dates) => setSelectedDates(dates)}  // Just update state, don't submit
            initialSelectedDates={selectedDates}  // Preserve selections if user goes back
            onBack={() => {
              // Go back to the appropriate test step
              if (testType === "bodyweight") {
                setCurrentStep("fitnessTest");
              } else if (testType === "weights") {
                setCurrentStep("weightsTest");
              } else {
                setCurrentStep("testSelection");
              }
            }}
            onConfirm={() => handleDateSelection(selectedDates)}  // Submit only on confirmation
          />
        );

      default:
        return null;
    }
  };

  return renderStep();
}
