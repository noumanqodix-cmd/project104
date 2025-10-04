import { useState, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import type { Subscription } from "@shared/schema";
import Landing from "./pages/Landing";
import SubscriptionSelection from "./pages/SubscriptionSelection";
import FitnessTestForm from "./components/FitnessTestForm";
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

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: subscription, isLoading: isLoadingSubscription } = useQuery<Subscription>({ 
    queryKey: ["/api/subscription"],
    enabled: isAuthenticated,
    retry: false,
  });
  const [workoutSummaryData, setWorkoutSummaryData] = useState<any>(null);

  const showBottomNav = !location.startsWith("/subscription-selection") &&
                        (location.startsWith("/home") || 
                        location.startsWith("/history") || 
                        location.startsWith("/fitness-test") || 
                        location.startsWith("/body") ||
                        location.startsWith("/workout-preview") ||
                        location.startsWith("/program") ||
                        location.startsWith("/test/"));

  useEffect(() => {
    if (isAuthenticated && !isLoadingSubscription) {
      const needsTier = !subscription || (!subscription.tier && subscription.tier !== 'free');
      
      if (location === "/") {
        if (needsTier) {
          setLocation("/subscription-selection");
        } else {
          setLocation("/home");
        }
      } else if (needsTier && location !== "/subscription-selection") {
        setLocation("/subscription-selection");
      }
    }
  }, [isAuthenticated, isLoadingSubscription, subscription, location, setLocation]);

  if (isLoading || (isAuthenticated && isLoadingSubscription)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Switch>
        {!isAuthenticated ? (
          <Route path="/" component={Landing} />
        ) : (
          <>
            <Route path="/home">
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

            <Route path="/workout-preview">
              <WorkoutPreview />
            </Route>

            <Route path="/settings">
              <Settings />
            </Route>

            <Route path="/subscription-selection">
              <SubscriptionSelection />
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
                onSave={(exercises) => {
                  console.log("Program saved:", exercises);
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
              <Home />
            </Route>
          </>
        )}
      </Switch>
      
      {showBottomNav && isAuthenticated && <BottomNavigation />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
