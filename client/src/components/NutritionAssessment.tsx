import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState<Date | undefined>(undefined);
  const [goal, setGoal] = useState("");
  
  const unitPreference = localStorage.getItem('unitPreference') || 'imperial';
  const isMetric = unitPreference === 'metric';

  // Construct date when all three values are set
  useEffect(() => {
    if (birthMonth && birthDay && birthYear) {
      const month = parseInt(birthMonth);
      const day = parseInt(birthDay);
      const year = parseInt(birthYear);
      
      // Validate the date is valid
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() === year && 
          date.getMonth() === month - 1 && 
          date.getDate() === day) {
        setDateOfBirth(date);
      } else {
        // Clear stale date if current combination is invalid
        setDateOfBirth(undefined);
      }
    } else {
      setDateOfBirth(undefined);
    }
  }, [birthMonth, birthDay, birthYear]);

  // Reset day when month/year changes make it invalid
  useEffect(() => {
    if (birthDay && birthMonth && birthYear) {
      const maxDays = getDaysInMonth();
      if (parseInt(birthDay) > maxDays) {
        setBirthDay("");
      }
    }
  }, [birthMonth, birthYear]);

  // Get days in selected month
  const getDaysInMonth = () => {
    if (!birthMonth || !birthYear) return 31;
    const month = parseInt(birthMonth);
    const year = parseInt(birthYear);
    return new Date(year, month, 0).getDate();
  };

  const calculateBMR = () => {
    let h = parseFloat(height);
    let w = parseFloat(weight);
    const age = calculateAge(dateOfBirth);
    
    if (!age) {
      throw new Error("Date of birth is required to calculate BMR");
    }
    
    if (!isMetric) {
      h = h * 2.54;
      w = w * 0.453592;
    }
    
    return Math.round(10 * w + 6.25 * h - 5 * age + 5);
  };

  const calculateHeartRateZones = (): HeartRateZones => {
    const age = calculateAge(dateOfBirth);
    
    if (!age) {
      throw new Error("Date of birth is required to calculate heart rate zones");
    }
    
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

  const canProceed = height && weight && birthMonth && birthDay && birthYear && dateOfBirth && goal;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-8 max-w-2xl w-full">
        <h2 className="text-3xl font-bold mb-3">Nutrition Assessment</h2>
        <p className="text-muted-foreground mb-8">
          Let's calculate your daily calorie needs
        </p>

        <div className="space-y-6">

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


            <div className="space-y-2">
              <Label>Birthday</Label>
              <div className="grid grid-cols-3 gap-2">
                <Select value={birthMonth} onValueChange={setBirthMonth}>
                  <SelectTrigger data-testid="select-birth-month">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">January</SelectItem>
                    <SelectItem value="2">February</SelectItem>
                    <SelectItem value="3">March</SelectItem>
                    <SelectItem value="4">April</SelectItem>
                    <SelectItem value="5">May</SelectItem>
                    <SelectItem value="6">June</SelectItem>
                    <SelectItem value="7">July</SelectItem>
                    <SelectItem value="8">August</SelectItem>
                    <SelectItem value="9">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={birthDay} onValueChange={setBirthDay}>
                  <SelectTrigger data-testid="select-birth-day">
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: getDaysInMonth() }, (_, i) => i + 1).map(day => (
                      <SelectItem key={day} value={day.toString()}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={birthYear} onValueChange={setBirthYear}>
                  <SelectTrigger data-testid="select-birth-year">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      { length: new Date().getFullYear() - 13 - 1924 + 1 },
                      (_, i) => new Date().getFullYear() - 13 - i
                    ).map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              
              </div>
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
