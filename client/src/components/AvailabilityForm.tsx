import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface AvailabilityFormProps {
  onComplete: (data: AvailabilityData) => void;
}

export interface AvailabilityData {
  daysPerWeek: number;
  minutesPerSession: number;
}

export default function AvailabilityForm({ onComplete }: AvailabilityFormProps) {
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [minutesPerSession, setMinutesPerSession] = useState<number | null>(null);

  const handleSubmit = () => {
    if (daysPerWeek && minutesPerSession) {
      onComplete({ daysPerWeek, minutesPerSession });
    }
  };

  const canProceed = daysPerWeek && minutesPerSession;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-8 max-w-2xl w-full">
        <h2 className="text-3xl font-bold mb-3">How much time can you commit?</h2>
        <p className="text-muted-foreground mb-8">
          We'll create a program that fits your schedule
        </p>

        <div className="space-y-8">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Days per week</Label>
            <RadioGroup
              value={daysPerWeek?.toString()}
              onValueChange={(v) => setDaysPerWeek(parseInt(v))}
            >
              {[3, 4, 5, 6, 7].map((days) => (
                <Label
                  key={days}
                  htmlFor={`days-${days}`}
                  className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover-elevate"
                  data-testid={`option-days-${days}`}
                >
                  <RadioGroupItem value={days.toString()} id={`days-${days}`} />
                  <span className="font-medium">{days} days</span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold">Minutes per workout</Label>
            <RadioGroup
              value={minutesPerSession?.toString()}
              onValueChange={(v) => setMinutesPerSession(parseInt(v))}
            >
              {[30, 45, 60, 90].map((minutes) => (
                <Label
                  key={minutes}
                  htmlFor={`minutes-${minutes}`}
                  className="flex items-center space-x-3 border rounded-lg p-4 cursor-pointer hover-elevate"
                  data-testid={`option-minutes-${minutes}`}
                >
                  <RadioGroupItem value={minutes.toString()} id={`minutes-${minutes}`} />
                  <span className="font-medium">{minutes} minutes</span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={!canProceed}
            data-testid="button-finish"
          >
            Create My Program
          </Button>
        </div>
      </Card>
    </div>
  );
}
