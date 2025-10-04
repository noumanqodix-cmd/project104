import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Heart, TrendingUp, Weight, Ruler, Flame, AlertCircle, Apple, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";

export default function Body() {
  const unitPreference = localStorage.getItem('unitPreference') || 'imperial';
  const weightUnit = unitPreference === 'imperial' ? 'lbs' : 'kg';
  const heightUnit = unitPreference === 'imperial' ? 'in' : 'cm';
  
  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const isMetric = unitPreference === 'metric';
  
  let displayWeight = user?.weight || 70;
  let displayHeight = user?.height || 170;
  
  if (user?.weight && !isMetric) {
    displayWeight = user.weight * 2.20462;
  }
  
  if (user?.height && !isMetric) {
    displayHeight = user.height / 2.54;
  }
  
  const healthStats = {
    weight: Math.round(displayWeight),
    height: Math.round(displayHeight),
    bmi: 24.4,
    bmr: user?.bmr || 1850,
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

  const tdee = Math.round(healthStats.bmr * 1.55);
  
  const recommendedMacros = {
    calories: tdee,
    protein: Math.round((tdee * 0.30) / 4),
    carbs: Math.round((tdee * 0.40) / 4),
    fat: Math.round((tdee * 0.30) / 9),
  };

  const vitals = [
    { label: "Weight", value: `${healthStats.weight} ${weightUnit}`, icon: Weight, change: `-2 ${weightUnit} this week` },
    { label: "Height", value: `${healthStats.height} ${heightUnit}`, icon: Ruler, change: null },
    { label: "BMI", value: healthStats.bmi.toFixed(1), icon: Activity, change: "Normal range" },
    { label: "BMR", value: `${healthStats.bmr} cal`, icon: Flame, change: "Daily baseline" },
  ];

  const dailyStats = [
    { label: "Heart Rate", value: `${healthStats.heartRate} bpm`, icon: Heart },
    { label: "Steps", value: healthStats.steps.toLocaleString(), icon: TrendingUp },
    { label: "Calories", value: `${healthStats.calories} cal`, icon: Flame },
  ];

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
            <CardDescription>Based on your BMR of {healthStats.bmr} cal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Total Calories</p>
                <p className="text-2xl font-bold" data-testid="recommended-calories">{recommendedMacros.calories}</p>
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
                Calculations: TDEE = BMR × 1.55 (moderate activity). Macros: 30% protein, 40% carbs, 30% fat.
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
            <Button variant="outline" className="w-full" data-testid="button-update-metrics">
              Update Metrics
            </Button>
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
