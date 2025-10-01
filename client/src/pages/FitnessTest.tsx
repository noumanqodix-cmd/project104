import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Dumbbell, Award, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

interface TestResult {
  id: number;
  date: Date;
  type: "bodyweight" | "weights";
  results: {
    pushups?: number;
    pullups?: number;
    squats?: number;
    mileTime?: number;
    squat?: number;
    deadlift?: number;
    benchPress?: number;
    overheadPress?: number;
    row?: number;
  };
}

export default function FitnessTest() {
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState<"bodyweight" | "weights" | null>(null);

  const testHistory: TestResult[] = [
    {
      id: 1,
      date: new Date(2025, 9, 1),
      type: "bodyweight",
      results: {
        pushups: 35,
        pullups: 12,
        squats: 50,
        mileTime: 7.5,
      }
    },
    {
      id: 2,
      date: new Date(2025, 8, 15),
      type: "weights",
      results: {
        squat: 225,
        deadlift: 275,
        benchPress: 185,
        overheadPress: 115,
        row: 155,
      }
    },
    {
      id: 3,
      date: new Date(2025, 8, 1),
      type: "bodyweight",
      results: {
        pushups: 30,
        pullups: 10,
        squats: 45,
        mileTime: 8.2,
      }
    },
  ];

  const bodyweightTests = testHistory.filter(t => t.type === "bodyweight");
  const weightsTests = testHistory.filter(t => t.type === "weights");

  const getImprovement = (current: number, previous: number, lowerIsBetter = false) => {
    const diff = current - previous;
    const percentChange = ((diff / previous) * 100).toFixed(1);
    const isImprovement = lowerIsBetter ? diff < 0 : diff > 0;
    return {
      diff,
      percent: percentChange,
      isImprovement,
    };
  };

  const renderBodyweightProgress = () => {
    if (bodyweightTests.length === 0) return null;
    const latest = bodyweightTests[0];
    const previous = bodyweightTests[1];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Bodyweight Test Progress
          </CardTitle>
          <CardDescription>Track your relative strength improvements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Push-ups</p>
              <p className="text-2xl font-bold" data-testid="stat-pushups">
                {latest.results.pushups}
              </p>
              {previous && (
                <p className={`text-xs ${getImprovement(latest.results.pushups!, previous.results.pushups!).isImprovement ? "text-green-500" : "text-red-500"}`}>
                  {getImprovement(latest.results.pushups!, previous.results.pushups!).diff > 0 ? "+" : ""}
                  {getImprovement(latest.results.pushups!, previous.results.pushups!).diff} ({getImprovement(latest.results.pushups!, previous.results.pushups!).percent}%)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Pull-ups</p>
              <p className="text-2xl font-bold" data-testid="stat-pullups">
                {latest.results.pullups}
              </p>
              {previous && (
                <p className={`text-xs ${getImprovement(latest.results.pullups!, previous.results.pullups!).isImprovement ? "text-green-500" : "text-red-500"}`}>
                  {getImprovement(latest.results.pullups!, previous.results.pullups!).diff > 0 ? "+" : ""}
                  {getImprovement(latest.results.pullups!, previous.results.pullups!).diff} ({getImprovement(latest.results.pullups!, previous.results.pullups!).percent}%)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Air Squats</p>
              <p className="text-2xl font-bold" data-testid="stat-squats">
                {latest.results.squats}
              </p>
              {previous && (
                <p className={`text-xs ${getImprovement(latest.results.squats!, previous.results.squats!).isImprovement ? "text-green-500" : "text-red-500"}`}>
                  {getImprovement(latest.results.squats!, previous.results.squats!).diff > 0 ? "+" : ""}
                  {getImprovement(latest.results.squats!, previous.results.squats!).diff} ({getImprovement(latest.results.squats!, previous.results.squats!).percent}%)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Mile Time</p>
              <p className="text-2xl font-bold" data-testid="stat-mile-time">
                {latest.results.mileTime} min
              </p>
              {previous && (
                <p className={`text-xs ${getImprovement(latest.results.mileTime!, previous.results.mileTime!, true).isImprovement ? "text-green-500" : "text-red-500"}`}>
                  {getImprovement(latest.results.mileTime!, previous.results.mileTime!, true).diff > 0 ? "+" : ""}
                  {getImprovement(latest.results.mileTime!, previous.results.mileTime!, true).diff} min
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderWeightsProgress = () => {
    if (weightsTests.length === 0) return null;
    const latest = weightsTests[0];
    const previous = weightsTests[1];

    const lifts = [
      { key: "squat", label: "Squat" },
      { key: "deadlift", label: "Deadlift" },
      { key: "benchPress", label: "Bench Press" },
      { key: "overheadPress", label: "Overhead Press" },
      { key: "row", label: "Row" },
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Weights Test Progress
          </CardTitle>
          <CardDescription>Track your absolute strength gains</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {lifts.map(lift => {
              const current = latest.results[lift.key as keyof typeof latest.results] as number;
              const prev = previous?.results[lift.key as keyof typeof previous.results] as number;
              
              return (
                <div key={lift.key} className="space-y-2">
                  <p className="text-sm text-muted-foreground">{lift.label}</p>
                  <p className="text-2xl font-bold" data-testid={`stat-${lift.key}`}>
                    {current} lbs
                  </p>
                  {prev && (
                    <p className={`text-xs ${getImprovement(current, prev).isImprovement ? "text-green-500" : "text-red-500"}`}>
                      {getImprovement(current, prev).diff > 0 ? "+" : ""}
                      {getImprovement(current, prev).diff} lbs ({getImprovement(current, prev).percent}%)
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (selectedType) {
    setLocation(`/test/${selectedType}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Fitness Test</h1>
          <p className="text-muted-foreground">Track your progress and test your limits</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Choose Your Test</CardTitle>
            <CardDescription>Select the type of fitness test you want to perform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-4"
              onClick={() => setSelectedType("bodyweight")}
              data-testid="button-bodyweight-test"
            >
              <div className="flex items-start gap-3 text-left">
                <Award className="h-5 w-5 mt-1" />
                <div>
                  <div className="font-semibold mb-1">Bodyweight Test</div>
                  <div className="text-sm text-muted-foreground">
                    Push-ups, Pull-ups, Air Squats, Mile Run
                  </div>
                </div>
              </div>
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full justify-start h-auto py-4"
              onClick={() => setSelectedType("weights")}
              data-testid="button-weights-test"
            >
              <div className="flex items-start gap-3 text-left">
                <Dumbbell className="h-5 w-5 mt-1" />
                <div>
                  <div className="font-semibold mb-1">Weights Test</div>
                  <div className="text-sm text-muted-foreground">
                    Squat, Deadlift, Bench Press, Overhead Press, Row
                  </div>
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>

        {renderBodyweightProgress()}
        {renderWeightsProgress()}

        <Card>
          <CardHeader>
            <CardTitle>Test History</CardTitle>
            <CardDescription>All previous fitness assessments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {testHistory.map((test) => (
              <div 
                key={test.id} 
                className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                data-testid={`test-result-${test.id}`}
              >
                <div className="flex items-center gap-3">
                  {test.type === "bodyweight" ? (
                    <Award className="h-4 w-4 text-primary" />
                  ) : (
                    <Dumbbell className="h-4 w-4 text-primary" />
                  )}
                  <div>
                    <p className="font-medium">
                      {test.type === "bodyweight" ? "Bodyweight Test" : "Weights Test"}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(test.date, "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <Badge variant="outline">
                  {Object.keys(test.results).length} metrics
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
