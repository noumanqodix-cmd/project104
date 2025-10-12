import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toggleEquipment } from "@/lib/equipmentUtils";
import { useQuery } from "@tanstack/react-query";
import { getEquipmentIcon, formatEquipmentLabel, formatCategoryName } from "@/lib/equipmentIcons";
import type { Equipment } from "@shared/schema";
import { ArrowLeft, Check } from "lucide-react";

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
  };
}

type Step = 1 | 2 | 3;

export default function QuestionnaireFlow({ onComplete, onBack }: QuestionnaireFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [experienceLevel, setExperienceLevel] = useState<string>("");
  const [unitPreference, setUnitPreference] = useState<string>("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(3);
  const [minutesPerSession, setMinutesPerSession] = useState<number>(45);

  // Fetch equipment from API
  const { data: equipmentData } = useQuery<Equipment[]>({
    queryKey: ['/api/equipment'],
  });

  // Transform API data into component format
  const equipmentCategories = useMemo(() => {
    if (!equipmentData) return [];

    // Group equipment by category
    const grouped = equipmentData.reduce((acc, item) => {
      const category = item.category || 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push({
        id: item.name,
        label: formatEquipmentLabel(item.name),
        icon: getEquipmentIcon(item.name)
      });
      return acc;
    }, {} as Record<string, Array<{ id: string; label: string; icon: any }>>);

    // Convert to array format with proper ordering
    const categoryOrder = ['bodyweight', 'weights', 'cardio', 'other'];
    return categoryOrder
      .filter(cat => grouped[cat] && grouped[cat].length > 0)
      .map(cat => ({
        category: formatCategoryName(cat),
        items: grouped[cat]
      }));
  }, [equipmentData]);

  const handleEquipmentToggle = (equipmentId: string) => {
    setEquipment(prev => toggleEquipment(prev, equipmentId));
  };

  const sanitizeId = (id: string) => id.replace(/\s+/g, '-').toLowerCase();

  const handleNext = () => {
    if (currentStep < 3) {
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
    return false;
  };

  const progress = (currentStep / 3) * 100;

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
            <span className="text-sm text-muted-foreground">Step {currentStep} of 3</span>
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

        <div className="mt-6 flex justify-end">
          <Button
            size="lg"
            onClick={handleNext}
            disabled={!canProceed()}
            data-testid={currentStep === 3 ? "button-complete" : "button-next"}
          >
            {currentStep === 3 ? "Complete" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
