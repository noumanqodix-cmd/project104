import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";

interface AvailabilityFormProps {
  onComplete: (data: AvailabilityData) => void;
}

export interface AvailabilityData {
  daysPerWeek: number;
  minutesPerSession: number;
  selectedDays: number[];
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

export default function AvailabilityForm({ onComplete }: AvailabilityFormProps) {
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [minutesPerSession, setMinutesPerSession] = useState<number | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  const handleDayToggle = (dayValue: number) => {
    if (!daysPerWeek) return;
    
    if (selectedDays.includes(dayValue)) {
      setSelectedDays(selectedDays.filter(d => d !== dayValue));
    } else {
      if (selectedDays.length < daysPerWeek) {
        setSelectedDays([...selectedDays, dayValue].sort((a, b) => a - b));
      }
    }
  };

  const handleSubmit = () => {
    if (daysPerWeek && minutesPerSession && selectedDays.length === daysPerWeek) {
      onComplete({ daysPerWeek, minutesPerSession, selectedDays });
    }
  };

  const canProceed = daysPerWeek && minutesPerSession && selectedDays.length === daysPerWeek;

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

          {daysPerWeek && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Select your {daysPerWeek} workout days
              </Label>
              <p className="text-sm text-muted-foreground mb-3">
                Choose which days of the week you want to work out ({selectedDays.length}/{daysPerWeek} selected)
              </p>
              <div className="space-y-2">
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = selectedDays.includes(day.value);
                  const isDisabled = !isSelected && selectedDays.length >= daysPerWeek;
                  
                  return (
                    <Label
                      key={day.value}
                      htmlFor={`day-${day.value}`}
                      className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer ${
                        isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover-elevate'
                      }`}
                      data-testid={`option-day-${day.value}`}
                    >
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={isSelected}
                        onCheckedChange={() => handleDayToggle(day.value)}
                        disabled={isDisabled}
                        data-testid={`checkbox-day-${day.value}`}
                      />
                      <span className="font-medium">{day.label}</span>
                    </Label>
                  );
                })}
              </div>
            </div>
          )}

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
