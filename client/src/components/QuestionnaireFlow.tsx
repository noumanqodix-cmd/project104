import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

interface QuestionnaireFlowProps {
  onComplete: (data: QuestionnaireData) => void;
  onBack?: () => void;
}

export interface QuestionnaireData {
  experienceLevel?: string;
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

export default function QuestionnaireFlow({ onComplete, onBack }: QuestionnaireFlowProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Partial<QuestionnaireData>>({
    equipment: [],
  });

  const totalSteps = data.experienceLevel === "unknown" ? 5 : 4;
  const progress = (step / totalSteps) * 100;

  const handleNext = () => {
    if (step === 1 && data.experienceLevel === "unknown") {
      setStep(2);
    } else if (step === 1) {
      setStep(3);
    } else if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onComplete(data as QuestionnaireData);
    }
  };

  const handleBack = () => {
    if (step === 1 && onBack) {
      onBack();
    } else if (step === 3 && data.experienceLevel === "unknown") {
      setStep(2);
    } else if (step > 1) {
      setStep(step - 1);
    }
  };

  const canProceed = () => {
    if (step === 1) return !!data.experienceLevel;
    if (step === 3) return !!data.nutrition;
    if (step === 4) return data.equipment && data.equipment.length > 0;
    if (step === totalSteps) return !!data.availability;
    return true;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <Progress value={progress} className="h-2" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Step {step} of {totalSteps}
          </p>
        </div>

        {step === 1 && (
          <Card className="p-8">
            <h2 className="text-3xl font-bold mb-3">What's your experience level?</h2>
            <p className="text-muted-foreground mb-8">This helps us create the right program for you</p>
            
            <RadioGroup
              value={data.experienceLevel}
              onValueChange={(value) => setData({ ...data, experienceLevel: value })}
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

        <div className="mt-6 flex justify-end">
          <Button
            size="lg"
            onClick={handleNext}
            disabled={!canProceed()}
            data-testid="button-next"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
