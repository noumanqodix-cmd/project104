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
  const [experienceLevel, setExperienceLevel] = useState<string>("");

  const handleNext = () => {
    if (experienceLevel) {
      onComplete({ experienceLevel } as QuestionnaireData);
    }
  };

  const canProceed = () => {
    return !!experienceLevel;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        {onBack && (
          <div className="mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        )}

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
