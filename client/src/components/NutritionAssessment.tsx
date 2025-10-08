import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { calculateAge } from "@shared/utils";

interface NutritionAssessmentProps {
  onComplete: (data: NutritionData) => void;
}

export interface HeartRateZones {
  maxHeartRate: number;
  zone1: { min: number; max: number; name: string; description: string };
  zone2: { min: number; max: number; name: string; description: string };
  zone3: { min: number; max: number; name: string; description: string };
  zone4: { min: number; max: number; name: string; description: string };
  zone5: { min: number; max: number; name: string; description: string };
}

export interface NutritionData {
  height: number;
  weight: number;
  dateOfBirth: Date;
  goal: string;
  bmr: number;
  calories: number;
  heartRateZones: HeartRateZones;
}

export default function NutritionAssessment({ onComplete }: NutritionAssessmentProps) {
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [goal, setGoal] = useState("");
  
  const unitPreference = localStorage.getItem('unitPreference') || 'imperial';
  const isMetric = unitPreference === 'metric';

  const calculateBMR = () => {
    let h = parseFloat(height);
    let w = parseFloat(weight);
    const age = calculateAge(dateOfBirth);
    
    if (!isMetric) {
      h = h * 2.54;
      w = w * 0.453592;
    }
    
    return Math.round(10 * w + 6.25 * h - 5 * (age || 25) + 5);
  };

  const calculateHeartRateZones = (): HeartRateZones => {
    const age = calculateAge(dateOfBirth) || 25;
    const maxHR = 220 - age;
    
    return {
      maxHeartRate: maxHR,
      zone1: {
        min: Math.round(maxHR * 0.50),
        max: Math.round(maxHR * 0.60),
        name: "Zone 1: Very Light",
        description: "Warm-up and recovery"
      },
      zone2: {
        min: Math.round(maxHR * 0.60),
        max: Math.round(maxHR * 0.70),
        name: "Zone 2: Light",
        description: "Fat burning and base fitness"
      },
      zone3: {
        min: Math.round(maxHR * 0.70),
        max: Math.round(maxHR * 0.80),
        name: "Zone 3: Moderate",
        description: "Aerobic endurance"
      },
      zone4: {
        min: Math.round(maxHR * 0.80),
        max: Math.round(maxHR * 0.90),
        name: "Zone 4: Hard",
        description: "Anaerobic capacity"
      },
      zone5: {
        min: Math.round(maxHR * 0.90),
        max: maxHR,
        name: "Zone 5: Maximum",
        description: "Peak performance"
      }
    };
  };

  const calculateCalories = (bmr: number, goal: string) => {
    if (goal === "gain") return bmr + 500;
    if (goal === "maintain") return bmr;
    if (goal === "lose") return bmr - 500;
    return bmr;
  };

  const handleSubmit = () => {
    if (!dateOfBirth) return;
    
    const bmr = calculateBMR();
    const calories = calculateCalories(bmr, goal);
    const heartRateZones = calculateHeartRateZones();
    
    let h = parseFloat(height);
    let w = parseFloat(weight);
    
    if (!isMetric) {
      h = h * 2.54;
      w = w * 0.453592;
    }
    
    onComplete({
      height: h,
      weight: w,
      dateOfBirth,
      goal,
      bmr,
      calories,
      heartRateZones,
    });
  };

  const canProceed = height && weight && dateOfBirth && goal;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-8 max-w-2xl w-full">
        <h2 className="text-3xl font-bold mb-3">Nutrition Assessment</h2>
        <p className="text-muted-foreground mb-8">
          Let's calculate your daily calorie needs
        </p>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
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
            <div className="space-y-2">
              <Label>Birthday</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateOfBirth && "text-muted-foreground"
                    )}
                    data-testid="button-birthday-picker"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateOfBirth ? format(dateOfBirth, "PPP") : <span>Select birthday</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateOfBirth}
                    onSelect={setDateOfBirth}
                    initialFocus
                    defaultMonth={new Date(1990, 0)}
                    fromYear={1924}
                    toYear={new Date().getFullYear() - 13}
                    captionLayout="dropdown-buttons"
                    data-testid="calendar-birthday"
                  />
                </PopoverContent>
              </Popover>
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
                  <div className="font-semibold">Gain Muscle & Weight</div>
                  <div className="text-sm text-muted-foreground">Calorie surplus</div>
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
                  <div className="text-sm text-muted-foreground">Burn fat & build muscle</div>
                </div>
              </Label>

              <Label
                htmlFor="lose"
                className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover-elevate"
                data-testid="option-lose"
              >
                <RadioGroupItem value="lose" id="lose" />
                <div>
                  <div className="font-semibold">Gain Muscle & Lose Weight</div>
                  <div className="text-sm text-muted-foreground">Calorie deficit</div>
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
