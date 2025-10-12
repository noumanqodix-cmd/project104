// ==========================================
// ONBOARDING ASSESSMENT - New User Setup Journey
// ==========================================
// This component guides new users through the complete onboarding process
// It's a multi-step wizard that collects all necessary information to build
// a personalized workout program
//
// ONBOARDING FLOW (5 STEPS):
// 1. QUESTIONNAIRE → Collect experience level, available equipment, training schedule
// 2. NUTRITION → Calculate BMR/TDEE, heart rate zones, set nutrition goals
// 3. TEST SELECTION → Choose fitness test type (bodyweight, weights, or skip)
// 4. FITNESS TEST → Complete chosen test (bodyweight OR weights OR skip)
// 5. SUBMIT → Save everything and generate workout program
//
// AUTHENTICATION HANDLING:
// - If user is logged in → Save directly to database → Navigate to /home
// - If user is NOT logged in → Save to localStorage → Redirect to login → Resume after auth
//
// DATA COLLECTED:
// - Training preferences (days/week, duration, equipment)
// - Body metrics (height, weight, age)
// - Nutrition goals (gain/maintain/lose)
// - Fitness test results (optional but recommended)
//
// WHY THIS MATTERS:
// All this information is used by the AI workout generator to create
// a custom program that matches your abilities and goals
// ==========================================

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
import { formatLocalDate, getTodayLocal } from "@shared/dateUtils";

// Defines which step of onboarding the user is on
type AssessmentStep = "questionnaire" | "nutrition" | "testSelection" | "fitnessTest" | "weightsTest";

export default function OnboardingAssessment() {
  // ==========================================
  // STATE MANAGEMENT (Component Memory)
  // ==========================================
  
  const [, setLocation] = useLocation();  // Navigation function
  const { toast } = useToast();  // Popup notification function
  
  // STATE: Which step is user currently on?
  // Flow: questionnaire → nutrition → testSelection → fitnessTest/weightsTest
  const [currentStep, setCurrentStep] = useState<AssessmentStep>("questionnaire");
  
  // STATE: Data collected from questionnaire step
  // Includes: experience level, equipment, schedule (days/week, duration, selected days)
  const [questionnaireData, setQuestionnaireData] = useState<QuestionnaireData | null>(null);
  
  // STATE: Data collected from nutrition step
  // Includes: height, weight, age, nutrition goal, calculated BMR/TDEE, heart rate zones
  const [nutritionData, setNutritionData] = useState<NutritionData | null>(null);
  
  // STATE: Which fitness test type did user choose?
  // "bodyweight" = push-ups, pull-ups, squats | "weights" = 1RM lifts | "skip" = no test
  const [testType, setTestType] = useState<"bodyweight" | "weights" | "skip" | null>(null);

  // ==========================================
  // MUTATION: Submit Complete Onboarding Data
  // ==========================================
  // This handles the final submission of all collected onboarding data
  // It's smart about authentication - works for both logged-in and anonymous users
  //
  // TWO POSSIBLE FLOWS:
  // 
  // FLOW A - User Already Logged In:
  //   1. Check auth status → User has session
  //   2. Save directly to database → Success!
  //   3. Navigate to /home → Start using app
  //
  // FLOW B - User NOT Logged In (Anonymous):
  //   1. Check auth status → No session
  //   2. Save data to localStorage (browser storage)
  //   3. Redirect to login page
  //   4. After login → OIDCCallbackPage retrieves localStorage → Saves to database → Navigate to /home
  //      (Note: The resume logic happens in OIDCCallbackPage.tsx, not in this component)
  //
  // WHY TWO FLOWS?
  // Some users want to explore the app before creating an account
  // We don't lose their data - we save it temporarily and complete setup after login
  const completeAssessmentMutation = useMutation({
    // The actual API call function
    mutationFn: async (data: any) => {
      console.log('[ONBOARDING] Mutation started with data:', data);
      
      // STEP 1: Check if user is authenticated
      try {
        console.log('[ONBOARDING] Checking authentication...');
        const userResponse = await apiRequest("GET", "/api/auth/user");
        const user = await userResponse.json();
        console.log('[ONBOARDING] User authentication response:', user);
        
        if (user && user.id) {
          // AUTHENTICATED FLOW - Save directly to database
          console.log('[ONBOARDING] User authenticated, saving assessment...');
          const response = await apiRequest("POST", "/api/onboarding-assessment/complete", {
            ...data,
            startDate: formatLocalDate(getTodayLocal()),  // Program starts today
          });
          const responseData = await response.json();
          console.log('[ONBOARDING] Assessment saved successfully:', responseData);
          return { authenticated: true, data: responseData };
        }
      } catch (error) {
        console.log('[ONBOARDING] Authentication check failed:', error);
        // Fall through to unauthenticated flow
      }
      
      // UNAUTHENTICATED FLOW - Save to browser storage for later
      console.log('[ONBOARDING] User not authenticated, saving to localStorage');
      return { authenticated: false, data };
    },
    
    // What to do if submission succeeds
    onSuccess: (result) => {
      console.log('[ONBOARDING] Mutation success, result:', result);
      
      if (result.authenticated) {
        // AUTHENTICATED SUCCESS - Go straight to app
        console.log('[ONBOARDING] Authenticated flow - invalidating queries and navigating to /home');
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });  // Reload user data
        queryClient.invalidateQueries({ queryKey: ["/api/fitness-assessments"] });  // Reload assessments
        toast({
          title: "Assessment Complete!",
          description: "Your profile has been set up successfully.",
        });
        console.log('[ONBOARDING] Navigating to /home');
        setLocation("/home");  // Navigate to main app
      } else {
        // UNAUTHENTICATED SUCCESS - Save and redirect to login
        console.log('[ONBOARDING] Unauthenticated flow - saving to localStorage and redirecting to login');
        const onboardingData = {
          questionnaireData: result.data,
          isOnboardingAssessment: true,  // Flag to indicate this is onboarding data
        };
        localStorage.setItem('fitforge_onboarding_data', JSON.stringify(onboardingData));
        console.log('[ONBOARDING] Redirecting to /api/login');
        window.location.href = "/api/login";  // Redirect to Replit Auth login
      }
    },
    
    // What to do if submission fails
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
          pikePushups: results.pikePushups,
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
