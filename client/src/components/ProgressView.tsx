import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Award, Target } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ProgressViewProps {
  onBack: () => void;
}

export default function ProgressView({ onBack }: ProgressViewProps) {
  //todo: remove mock functionality
  const strengthData = [
    { week: "Week 1", benchPress: 135, squat: 185, deadlift: 225 },
    { week: "Week 2", benchPress: 140, squat: 195, deadlift: 235 },
    { week: "Week 3", benchPress: 145, squat: 200, deadlift: 245 },
    { week: "Week 4", benchPress: 150, squat: 210, deadlift: 255 },
  ];

  const stats = [
    { label: "Total Workouts", value: "24", icon: Award },
    { label: "Current Streak", value: "7 days", icon: TrendingUp },
    { label: "Strength Gain", value: "+12%", icon: Target },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Progress Overview</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-6">
                <Icon className="h-8 w-8 text-primary mb-3" />
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-3xl font-bold">{stat.value}</p>
              </Card>
            );
          })}
        </div>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-6">Strength Progression</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={strengthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
              />
              <Line
                type="monotone"
                dataKey="benchPress"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                name="Bench Press"
              />
              <Line
                type="monotone"
                dataKey="squat"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                name="Squat"
              />
              <Line
                type="monotone"
                dataKey="deadlift"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                name="Deadlift"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-semibold mb-4">Nutrition Summary</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">BMR</p>
              <p className="text-2xl font-bold">1,850 cal</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Daily Target</p>
              <p className="text-2xl font-bold">2,350 cal</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Goal</p>
              <p className="text-2xl font-bold">Gain Muscle</p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
