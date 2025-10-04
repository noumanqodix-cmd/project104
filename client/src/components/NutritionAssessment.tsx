import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface NutritionAssessmentProps {
  onComplete: (data: NutritionData) => void;
}

export interface NutritionData {
  height: number;
  weight: number;
  goal: string;
  bmr: number;
  calories: number;
}

export default function NutritionAssessment({ onComplete }: NutritionAssessmentProps) {
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState("");
  
  const unitPreference = localStorage.getItem('unitPreference') || 'imperial';
  const isMetric = unitPreference === 'metric';

  const calculateBMR = () => {
    let h = parseFloat(height);
    let w = parseFloat(weight);
    
    if (!isMetric) {
      h = h * 2.54;
      w = w * 0.453592;
    }
    
    return Math.round(10 * w + 6.25 * h - 5 * 30 + 5);
  };

  const calculateCalories = (bmr: number, goal: string) => {
    if (goal === "gain") return bmr + 500;
    if (goal === "maintain") return bmr;
    if (goal === "lose") return bmr - 500;
    return bmr;
  };

  const handleSubmit = () => {
    const bmr = calculateBMR();
    const calories = calculateCalories(bmr, goal);
    
    onComplete({
      height: parseFloat(height),
      weight: parseFloat(weight),
      goal,
      bmr,
      calories,
    });
  };

  const canProceed = height && weight && goal;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-8 max-w-2xl w-full">
        <h2 className="text-3xl font-bold mb-3">Nutrition Assessment</h2>
        <p className="text-muted-foreground mb-8">
          Let's calculate your daily calorie needs
        </p>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="height">
                Height ({isMetric ? 'cm' : 'in'})
              </Label>
              <Input
                id="height"
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder={isMetric ? '170' : '68'}
                data-testid="input-height"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">
                Weight ({isMetric ? 'kg' : 'lbs'})
              </Label>
              <Input
                id="weight"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={isMetric ? '70' : '155'}
                data-testid="input-weight"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>What's your goal?</Label>
            <RadioGroup value={goal} onValueChange={setGoal}>
              <Label
                htmlFor="gain"
                className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover-elevate"
                data-testid="option-gain"
              >
                <RadioGroupItem value="gain" id="gain" />
                <div>
                  <div className="font-semibold">Gain Muscle</div>
                  <div className="text-sm text-muted-foreground">+500 calories surplus</div>
                </div>
              </Label>

              <Label
                htmlFor="maintain"
                className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover-elevate"
                data-testid="option-maintain"
              >
                <RadioGroupItem value="maintain" id="maintain" />
                <div>
                  <div className="font-semibold">Maintain Weight</div>
                  <div className="text-sm text-muted-foreground">Recomp: lose fat & build muscle</div>
                </div>
              </Label>

              <Label
                htmlFor="lose"
                className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover-elevate"
                data-testid="option-lose"
              >
                <RadioGroupItem value="lose" id="lose" />
                <div>
                  <div className="font-semibold">Lose weight and gain muscle</div>
                  <div className="text-sm text-muted-foreground">-500 calories deficit</div>
                </div>
              </Label>
            </RadioGroup>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={!canProceed}
            data-testid="button-calculate"
          >
            Calculate My Needs
          </Button>
        </div>
      </Card>
    </div>
  );
}
