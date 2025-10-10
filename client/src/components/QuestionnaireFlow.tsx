import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
  ArrowLeft, 
  Dumbbell, 
  Bike, 
  Check,
  Box,
  Anchor,
  Cable,
  Grid3x3,
  Link,
  Repeat,
  User,
  CircleDot,
  Activity,
  Wind
} from "lucide-react";

interface QuestionnaireFlowProps {
  onComplete: (data: QuestionnaireData) => void;
  onBack?: () => void;
}

export interface QuestionnaireData {
  experienceLevel?: string;
  unitPreference?: string;
  fitnessTest?: {
    pushups: number;
    pullups: number;
    squats: number;
    mileTime: number;
  };
  nutrition?: {
    height: number;
    weight: number;
    goal: string;
  };
  equipment: string[];
  availability: {
    daysPerWeek: number;
    minutesPerSession: number;
    selectedDays: number[];
  };
}

type Step = 1 | 2 | 3 | 4;

export default function QuestionnaireFlow({ onComplete, onBack }: QuestionnaireFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [experienceLevel, setExperienceLevel] = useState<string>("");
  const [unitPreference, setUnitPreference] = useState<string>("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(3);
  const [minutesPerSession, setMinutesPerSession] = useState<number>(45);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const equipmentCategories = [
    {
      category: "Strength Equipment",
      items: [
        { id: "bodyweight", label: "Bodyweight Only", icon: User },
        { id: "dumbbells", label: "Dumbbells", icon: Dumbbell },
        { id: "kettlebell", label: "Kettlebell", icon: CircleDot },
        { id: "barbell", label: "Barbell", icon: Anchor },
        { id: "resistance bands", label: "Resistance Bands", icon: Cable },
        { id: "cable machine", label: "Cable Machine", icon: Cable },
        { id: "pull-up bar", label: "Pull-up Bar", icon: Grid3x3 },
        { id: "trx", label: "TRX/Suspension Trainer", icon: Link },
        { id: "medicine ball", label: "Medicine Ball", icon: Box },
        { id: "box", label: "Box/Bench", icon: Box },
        { id: "jump rope", label: "Jump Rope", icon: Repeat },
      ]
    },
    {
      category: "Cardio Equipment",
      items: [
        { id: "rower", label: "Rower", icon: Activity },
        { id: "bike", label: "Bike", icon: Bike },
        { id: "treadmill", label: "Treadmill", icon: Activity },
        { id: "elliptical", label: "Elliptical", icon: Activity },
        { id: "assault bike", label: "Assault Bike", icon: Wind },
        { id: "stair climber", label: "Stair Climber", icon: Activity },
      ]
    }
  ];

  const handleEquipmentToggle = (equipmentId: string) => {
    setEquipment(prev => {
      if (equipmentId === "bodyweight") {
        // If bodyweight only is selected, clear all other equipment
        return prev.includes("bodyweight") ? [] : ["bodyweight"];
      } else {
        // Remove bodyweight if other equipment is selected
        const filtered = prev.filter(e => e !== "bodyweight");
        if (filtered.includes(equipmentId)) {
          return filtered.filter(e => e !== equipmentId);
        } else {
          return [...filtered, equipmentId];
        }
      }
    });
  };

  const sanitizeId = (id: string) => id.replace(/\s+/g, '-').toLowerCase();

  const handleDayToggle = (dayValue: number) => {
    if (selectedDays.includes(dayValue)) {
      setSelectedDays(selectedDays.filter(d => d !== dayValue));
    } else {
      if (selectedDays.length < daysPerWeek) {
        setSelectedDays([...selectedDays, dayValue].sort((a, b) => a - b));
      }
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep((currentStep + 1) as Step);
    } else {
      // Final step - submit all data
      onComplete({
        experienceLevel,
        unitPreference,
        equipment,
        availability: {
          daysPerWeek,
          minutesPerSession,
          selectedDays,
        },
      });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step);
    } else if (onBack) {
      onBack();
    }
  };

  const canProceed = () => {
    if (currentStep === 1) return !!experienceLevel;
    if (currentStep === 2) return !!unitPreference;
    if (currentStep === 3) return equipment.length > 0;
    if (currentStep === 4) return selectedDays.length === daysPerWeek;
    return false;
  };

  const progress = (currentStep / 4) * 100;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        {(currentStep > 1 || onBack) && (
          <div className="mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        )}

        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">Step {currentStep} of 4</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step 1: Experience Level */}
        {currentStep === 1 && (
          <Card className="p-8">
            <h2 className="text-3xl font-bold mb-3">What's your experience level?</h2>
            <p className="text-muted-foreground mb-8">This helps us create the right program for you</p>
            
            <RadioGroup
              value={experienceLevel}
              onValueChange={(value) => setExperienceLevel(value)}
              className="space-y-4"
            >
              <Label
                htmlFor="beginner"
                className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover-elevate"
                data-testid="option-beginner"
              >
                <RadioGroupItem value="beginner" id="beginner" />
                <div>
                  <div className="font-semibold">Beginner</div>
                  <div className="text-sm text-muted-foreground">Less than 1 year</div>
                </div>
              </Label>

              <Label
                htmlFor="intermediate"
                className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover-elevate"
                data-testid="option-intermediate"
              >
                <RadioGroupItem value="intermediate" id="intermediate" />
                <div>
                  <div className="font-semibold">Intermediate</div>
                  <div className="text-sm text-muted-foreground">1-3 years</div>
                </div>
              </Label>

              <Label
                htmlFor="advanced"
                className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover-elevate"
                data-testid="option-advanced"
              >
                <RadioGroupItem value="advanced" id="advanced" />
                <div>
                  <div className="font-semibold">Advanced</div>
                  <div className="text-sm text-muted-foreground">4+ years</div>
                </div>
              </Label>

              <Label
                htmlFor="unknown"
                className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover-elevate"
                data-testid="option-unknown"
              >
                <RadioGroupItem value="unknown" id="unknown" />
                <div>
                  <div className="font-semibold">I Don't Know</div>
                  <div className="text-sm text-muted-foreground">We'll help you figure it out</div>
                </div>
              </Label>
            </RadioGroup>
          </Card>
        )}

        {/* Step 2: Unit Preference */}
        {currentStep === 2 && (
          <Card className="p-8">
            <h2 className="text-3xl font-bold mb-3">Unit Preference</h2>
            <p className="text-muted-foreground mb-8">Choose your preferred measurement system</p>
            
            <RadioGroup
              value={unitPreference}
              onValueChange={(value) => setUnitPreference(value)}
              className="space-y-4"
            >
              <Label
                htmlFor="imperial"
                className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover-elevate"
                data-testid="option-imperial"
              >
                <RadioGroupItem value="imperial" id="imperial" />
                <div>
                  <div className="font-semibold">Imperial (lbs, ft, in)</div>
                  <div className="text-sm text-muted-foreground">Pounds, feet, inches</div>
                </div>
              </Label>

              <Label
                htmlFor="metric"
                className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover-elevate"
                data-testid="option-metric"
              >
                <RadioGroupItem value="metric" id="metric" />
                <div>
                  <div className="font-semibold">Metric (kg, cm)</div>
                  <div className="text-sm text-muted-foreground">Kilograms, centimeters</div>
                </div>
              </Label>
            </RadioGroup>
          </Card>
        )}

        {/* Step 3: Equipment Selection */}
        {currentStep === 3 && (
          <Card className="p-8">
            <h2 className="text-3xl font-bold mb-3">What equipment do you have?</h2>
            <p className="text-muted-foreground mb-8">Select all that apply. Don't worry if you have none!</p>
            
            <div className="space-y-8">
              {equipmentCategories.map((category) => (
                <div key={category.category}>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                    {category.category}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      const isChecked = equipment.includes(item.id);
                      const domId = sanitizeId(item.id);
                      
                      return (
                        <Label
                          key={item.id}
                          htmlFor={domId}
                          className={`flex flex-col items-center gap-2 border rounded-lg p-4 cursor-pointer hover-elevate ${
                            isChecked ? "border-primary bg-primary/10" : ""
                          }`}
                          data-testid={`option-${domId}`}
                        >
                          <Checkbox
                            id={domId}
                            checked={isChecked}
                            onCheckedChange={() => handleEquipmentToggle(item.id)}
                            className="sr-only"
                          />
                          <Icon className={`h-6 w-6 ${isChecked ? "text-primary" : "text-muted-foreground"}`} />
                          <span className={`text-xs font-medium text-center ${isChecked ? "text-primary" : ""}`}>
                            {item.label}
                          </span>
                        </Label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Step 4: Workout Schedule */}
        {currentStep === 4 && (
          <Card className="p-8">
            <h2 className="text-3xl font-bold mb-3">Workout Schedule</h2>
            <p className="text-muted-foreground mb-8">How often can you train?</p>
            
            <div className="space-y-8">
              <div>
                <Label className="text-base font-semibold mb-3 block">Days per week</Label>
                <RadioGroup
                  value={String(daysPerWeek)}
                  onValueChange={(value) => {
                    setDaysPerWeek(Number(value));
                    setSelectedDays([]);
                  }}
                  className="grid grid-cols-3 gap-3"
                >
                  {[3, 4, 5, 6, 7].map((days) => (
                    <Label
                      key={days}
                      htmlFor={`days-${days}`}
                      className="flex items-center justify-center border rounded-lg p-3 cursor-pointer hover-elevate"
                      data-testid={`option-days-${days}`}
                    >
                      <RadioGroupItem value={String(days)} id={`days-${days}`} className="sr-only" />
                      <div className="font-semibold">{days} days</div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">
                  Which days of the week? ({selectedDays.length}/{daysPerWeek} selected)
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 1, label: "Monday" },
                    { value: 2, label: "Tuesday" },
                    { value: 3, label: "Wednesday" },
                    { value: 4, label: "Thursday" },
                    { value: 5, label: "Friday" },
                    { value: 6, label: "Saturday" },
                    { value: 7, label: "Sunday" },
                  ].map((day) => {
                    const isSelected = selectedDays.includes(day.value);
                    const isDisabled = !isSelected && selectedDays.length >= daysPerWeek;
                    
                    return (
                      <Label
                        key={day.value}
                        htmlFor={`day-${day.value}`}
                        className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer ${
                          isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover-elevate'
                        }`}
                        data-testid={`option-day-${day.label.toLowerCase()}`}
                      >
                        <Checkbox
                          id={`day-${day.value}`}
                          checked={isSelected}
                          disabled={isDisabled}
                          onCheckedChange={() => handleDayToggle(day.value)}
                          data-testid={`checkbox-${day.label.toLowerCase()}`}
                        />
                        <div className="font-medium">{day.label}</div>
                      </Label>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">
                  Session duration
                </Label>
                <RadioGroup
                  value={String(minutesPerSession)}
                  onValueChange={(value) => setMinutesPerSession(Number(value))}
                  className="grid grid-cols-2 gap-4"
                >
                  {[20, 30, 45, 60].map((mins) => (
                    <Label
                      key={mins}
                      htmlFor={`duration-${mins}`}
                      className="flex items-center justify-center border rounded-lg p-4 cursor-pointer hover-elevate"
                      data-testid={`option-duration-${mins}`}
                    >
                      <RadioGroupItem value={String(mins)} id={`duration-${mins}`} className="sr-only" />
                      <div className="text-center">
                        <div className="font-semibold">{mins} min</div>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            </div>
          </Card>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            size="lg"
            onClick={handleNext}
            disabled={!canProceed()}
            data-testid={currentStep === 4 ? "button-complete" : "button-next"}
          >
            {currentStep === 4 ? "Complete" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
