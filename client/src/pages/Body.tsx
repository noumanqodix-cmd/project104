import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Heart, TrendingUp, Weight, Ruler, Flame, AlertCircle, Apple, Plus, Dumbbell } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { calculateAge } from "@shared/utils";
import { formatLocalDate } from "@shared/dateUtils";

export default function Body() {
  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  // Include current date in query to ensure calories are calculated for user's timezone
  const currentDate = formatLocalDate(new Date());
  const { data: todayCaloriesData } = useQuery<{ calories: number }>({
    queryKey: ["/api/workout-sessions/calories/today", currentDate],
    queryFn: async () => {
      const response = await fetch(`/api/workout-sessions/calories/today?date=${currentDate}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch calories');
      return response.json();
    },
  });

  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const unitPreference = user?.unitPreference || 'imperial';
  const weightUnit = unitPreference === 'imperial' ? 'lbs' : 'kg';
  const heightUnit = unitPreference === 'imperial' ? 'in' : 'cm';
  const isMetric = unitPreference === 'metric';
  
  let displayWeight = user?.weight || 70;
  let displayHeight = user?.height || 170;
  
  if (user?.weight && !isMetric) {
    displayWeight = user.weight * 2.20462;
  }
  
  if (user?.height && !isMetric) {
    displayHeight = user.height / 2.54;
  }
  
  const bmr = user?.bmr || 1850;
  const workoutCalories = todayCaloriesData?.calories || 0;
  const realTDEE = bmr + workoutCalories;
  
  // Calculate recommended intake based on nutrition goal
  const nutritionGoal = user?.nutritionGoal?.toLowerCase() || '';
  let recommendedIntake = realTDEE;
  let calorieAdjustment = 0;
  let goalDescription = "Maintenance";
  
  // Muscle gain goals: add surplus
  if (nutritionGoal.includes('gain') || nutritionGoal.includes('build') || 
      nutritionGoal.includes('bulk') || nutritionGoal.includes('muscle') || 
      nutritionGoal.includes('mass')) {
    calorieAdjustment = 400;
    recommendedIntake = realTDEE + calorieAdjustment;
    goalDescription = "Muscle Gain (+400 cal)";
  }
  // Fat loss goals: add deficit
  else if (nutritionGoal.includes('lose') || nutritionGoal.includes('cut') || 
           nutritionGoal.includes('shred') || nutritionGoal.includes('fat loss') || 
           nutritionGoal.includes('weight loss')) {
    calorieAdjustment = -500;
    recommendedIntake = realTDEE + calorieAdjustment;
    goalDescription = "Fat Loss (-500 cal)";
  }
  
  const healthStats = {
    weight: Math.round(displayWeight),
    height: Math.round(displayHeight),
    bmi: 24.4,
    bmr,
    heartRate: 72,
    steps: 8245,
    calories: 2100,
    lastUpdated: "2 hours ago",
  };

  const [todayNutrition, setTodayNutrition] = useState({
    calories: 1650,
    protein: 120,
    carbs: 180,
    fat: 55,
  });

  const [showNutritionInput, setShowNutritionInput] = useState(false);
  
  const recommendedMacros = {
    calories: Math.round(recommendedIntake),
    protein: Math.round((recommendedIntake * 0.30) / 4),
    carbs: Math.round((recommendedIntake * 0.40) / 4),
    fat: Math.round((recommendedIntake * 0.30) / 9),
  };

  // Calculate age from dateOfBirth
  const userAge = user?.dateOfBirth ? calculateAge(new Date(user.dateOfBirth)) : null;

  const vitals = [
    { label: "Weight", value: `${healthStats.weight} ${weightUnit}`, icon: Weight, change: `-2 ${weightUnit} this week` },
    { label: "Height", value: `${healthStats.height} ${heightUnit}`, icon: Ruler, change: null },
    { label: "Age", value: userAge ? `${userAge} years` : "N/A", icon: Activity, change: null },
    { label: "BMR", value: `${healthStats.bmr} cal`, icon: Flame, change: "Daily baseline" },
  ];

  const dailyStats = [
    { label: "Heart Rate", value: `${healthStats.heartRate} bpm`, icon: Heart },
    { label: "Steps", value: healthStats.steps.toLocaleString(), icon: TrendingUp },
    { label: "Calories", value: `${healthStats.calories} cal`, icon: Flame },
  ];

  // Form for updating metrics
  const form = useForm({
    defaultValues: {
      height: displayHeight.toString(),
      weight: displayWeight.toString(),
    }
  });

  const updateMetricsMutation = useMutation({
    mutationFn: async (data: { height: string; weight: string }) => {
      let heightValue = parseFloat(data.height);
      let weightValue = parseFloat(data.weight);

      // Convert to metric if user is using imperial
      if (!isMetric) {
        heightValue = heightValue * 2.54; // inches to cm
        weightValue = weightValue * 0.453592; // lbs to kg
      }

      const response = await fetch("/api/auth/user/metrics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          height: heightValue,
          weight: weightValue
        })
      });

      if (!response.ok) {
        throw new Error("Failed to update metrics");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Metrics Updated",
        description: "Your body metrics have been updated successfully.",
      });
      setDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update metrics. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmitMetrics = (data: { height: string; weight: string }) => {
    updateMetricsMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Health Stats</h1>
          <p className="text-muted-foreground">Monitor your body metrics</p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nutrition tracking: Manual entry available below. Direct integration with MyFitnessPal or Apple Health requires third-party API services not currently available on this platform.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Calorie Balance</CardTitle>
            <CardDescription>Your daily calorie needs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Flame className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">BMR (Baseline)</p>
                  </div>
                  <p className="text-2xl font-bold" data-testid="stat-bmr-calories">{bmr.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">cal/day</p>
                </div>
                <div className="text-center p-4 border rounded-lg bg-primary/10">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Dumbbell className="h-4 w-4 text-primary" />
                    <p className="text-sm text-muted-foreground">Workouts Today</p>
                  </div>
                  <p className="text-2xl font-bold text-foreground" data-testid="stat-workout-calories">+{workoutCalories.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">cal burned</p>
                </div>
              </div>
              
              <div className="p-4 border-2 rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Total Burned (TDEE)</p>
                  <p className="text-3xl font-bold" data-testid="stat-tdee">{realTDEE.toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Recommended Intake</p>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground" data-testid="stat-recommended-intake">{recommendedMacros.calories.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{goalDescription}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  {workoutCalories > 0 
                    ? `Today's workouts burned ${workoutCalories} calories. Your recommended intake is adjusted based on your ${nutritionGoal || 'maintenance'} goal.`
                    : `No workouts completed today. Your recommended intake is based on BMR and your ${nutritionGoal || 'maintenance'} goal.`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Nutrition</CardTitle>
            <CardDescription>Track your daily intake</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Calories</span>
                  </div>
                  <span className="text-sm font-bold" data-testid="nutrition-calories">
                    {todayNutrition.calories} / {recommendedMacros.calories}
                  </span>
                </div>
                <Progress 
                  value={(todayNutrition.calories / recommendedMacros.calories) * 100} 
                  className="h-2" 
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Protein</span>
                  <span className="text-sm font-bold" data-testid="nutrition-protein">
                    {todayNutrition.protein}g / {recommendedMacros.protein}g
                  </span>
                </div>
                <Progress 
                  value={(todayNutrition.protein / recommendedMacros.protein) * 100} 
                  className="h-2" 
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Carbs</span>
                  <span className="text-sm font-bold" data-testid="nutrition-carbs">
                    {todayNutrition.carbs}g / {recommendedMacros.carbs}g
                  </span>
                </div>
                <Progress 
                  value={(todayNutrition.carbs / recommendedMacros.carbs) * 100} 
                  className="h-2" 
                />
              </div>

              <div className="col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Fat</span>
                  <span className="text-sm font-bold" data-testid="nutrition-fat">
                    {todayNutrition.fat}g / {recommendedMacros.fat}g
                  </span>
                </div>
                <Progress 
                  value={(todayNutrition.fat / recommendedMacros.fat) * 100} 
                  className="h-2" 
                />
              </div>
            </div>

            {!showNutritionInput ? (
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setShowNutritionInput(true)}
                data-testid="button-log-nutrition"
              >
                <Plus className="h-4 w-4 mr-2" />
                Log Today's Nutrition
              </Button>
            ) : (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="calories-input">Calories</Label>
                    <Input
                      id="calories-input"
                      type="number"
                      placeholder="0"
                      defaultValue={todayNutrition.calories}
                      data-testid="input-calories"
                    />
                  </div>
                  <div>
                    <Label htmlFor="protein-input">Protein (g)</Label>
                    <Input
                      id="protein-input"
                      type="number"
                      placeholder="0"
                      defaultValue={todayNutrition.protein}
                      data-testid="input-protein"
                    />
                  </div>
                  <div>
                    <Label htmlFor="carbs-input">Carbs (g)</Label>
                    <Input
                      id="carbs-input"
                      type="number"
                      placeholder="0"
                      defaultValue={todayNutrition.carbs}
                      data-testid="input-carbs"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="fat-input">Fat (g)</Label>
                    <Input
                      id="fat-input"
                      type="number"
                      placeholder="0"
                      defaultValue={todayNutrition.fat}
                      data-testid="input-fat"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    className="flex-1"
                    onClick={() => {
                      const caloriesValue = (document.getElementById('calories-input') as HTMLInputElement).value;
                      const proteinValue = (document.getElementById('protein-input') as HTMLInputElement).value;
                      const carbsValue = (document.getElementById('carbs-input') as HTMLInputElement).value;
                      const fatValue = (document.getElementById('fat-input') as HTMLInputElement).value;
                      
                      const calories = parseInt(caloriesValue) || 0;
                      const protein = parseInt(proteinValue) || 0;
                      const carbs = parseInt(carbsValue) || 0;
                      const fat = parseInt(fatValue) || 0;
                      
                      setTodayNutrition({ calories, protein, carbs, fat });
                      setShowNutritionInput(false);
                    }}
                    data-testid="button-save-nutrition"
                  >
                    Save
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={() => setShowNutritionInput(false)}
                    data-testid="button-cancel-nutrition"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommended Daily Macros</CardTitle>
            <CardDescription>Based on your TDEE of {realTDEE.toLocaleString()} cal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Calories</p>
                <p className="text-2xl font-bold" data-testid="recommended-calories">{recommendedMacros.calories.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">cal/day</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Protein</p>
                <p className="text-2xl font-bold" data-testid="recommended-protein">{recommendedMacros.protein}g</p>
                <p className="text-xs text-muted-foreground mt-1">30% of calories</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Carbohydrates</p>
                <p className="text-2xl font-bold" data-testid="recommended-carbs">{recommendedMacros.carbs}g</p>
                <p className="text-xs text-muted-foreground mt-1">40% of calories</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Fat</p>
                <p className="text-2xl font-bold" data-testid="recommended-fat">{recommendedMacros.fat}g</p>
                <p className="text-xs text-muted-foreground mt-1">30% of calories</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                Calculations: TDEE = BMR + workout calories. Recommended intake adjusted for {goalDescription}. Macros: 30% protein, 40% carbs, 30% fat.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Body Metrics</CardTitle>
            <CardDescription>Last updated {healthStats.lastUpdated}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {vitals.map((vital) => {
                const Icon = vital.icon;
                return (
                  <div key={vital.label} className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Icon className="h-4 w-4" />
                      <span className="text-sm">{vital.label}</span>
                    </div>
                    <p className="text-2xl font-bold" data-testid={`stat-${vital.label.toLowerCase()}`}>
                      {vital.value}
                    </p>
                    {vital.change && (
                      <p className="text-xs text-muted-foreground">{vital.change}</p>
                    )}
                  </div>
                );
              })}
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" data-testid="button-update-metrics">
                  Update Metrics
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Body Metrics</DialogTitle>
                  <DialogDescription>
                    Update your height and weight. Values are stored in metric units (cm/kg).
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmitMetrics)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="height"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Height ({heightUnit})</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.1" 
                              placeholder={`Enter height in ${heightUnit}`}
                              data-testid="input-update-height"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="weight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weight ({weightUnit})</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.1" 
                              placeholder={`Enter weight in ${weightUnit}`}
                              data-testid="input-update-weight"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button 
                        type="submit" 
                        className="flex-1"
                        disabled={updateMetricsMutation.isPending}
                        data-testid="button-save-metrics"
                      >
                        {updateMetricsMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button 
                        type="button"
                        variant="ghost" 
                        onClick={() => setDialogOpen(false)}
                        data-testid="button-cancel-metrics"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Activity</CardTitle>
            <CardDescription>Real-time health tracking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dailyStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium">{stat.label}</span>
                  </div>
                  <span className="text-lg font-bold" data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
                    {stat.value}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Health Integrations</CardTitle>
            <CardDescription>Connect your health apps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" disabled data-testid="button-connect-apple-health">
              <Activity className="h-4 w-4 mr-2" />
              Connect Apple Health
              <span className="ml-auto text-xs text-muted-foreground">Coming Soon</span>
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled data-testid="button-connect-google-fit">
              <Activity className="h-4 w-4 mr-2" />
              Connect Google Fit
              <span className="ml-auto text-xs text-muted-foreground">Coming Soon</span>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress Tracking</CardTitle>
            <CardDescription>30-day trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Weight Change</span>
                  <span className="font-medium text-green-500">-5 lbs</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: "65%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Body Fat %</span>
                  <span className="font-medium text-green-500">-2%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: "45%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Muscle Mass</span>
                  <span className="font-medium text-primary">+3 lbs</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "75%" }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
