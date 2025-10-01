import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Heart, TrendingUp, Weight, Ruler, Flame, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Body() {
  const healthStats = {
    weight: 180,
    height: 72,
    bmi: 24.4,
    bmr: 1850,
    heartRate: 72,
    steps: 8245,
    calories: 2100,
    lastUpdated: "2 hours ago",
  };

  const vitals = [
    { label: "Weight", value: `${healthStats.weight} lbs`, icon: Weight, change: "-2 lbs this week" },
    { label: "Height", value: `${healthStats.height} in`, icon: Ruler, change: null },
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
            Health data integration coming soon. For now, stats are manually entered. 
            Future versions will sync with Apple Health and Google Fit.
          </AlertDescription>
        </Alert>

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
