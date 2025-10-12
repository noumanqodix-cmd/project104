import { useState, useEffect } from "react";
import { Check, ArrowLeft } from "lucide-react";
import { format, addDays } from "date-fns";
import { Button } from "@/components/ui/button";

interface DayPickerProps {
  daysPerWeek: number; // 3, 4, or 5
  onDatesSelected: (dates: string[]) => void;
  initialSelectedDates?: string[];
  onBack?: () => void;
  onConfirm?: () => void;  // Optional confirm button for onboarding flow
}

export function DayPicker({ daysPerWeek, onDatesSelected, initialSelectedDates, onBack, onConfirm }: DayPickerProps) {
  const [selectedDates, setSelectedDates] = useState<string[]>(initialSelectedDates || []);

  // Sync with initialSelectedDates when it changes (e.g., from async data load)
  // Only runs when initialSelectedDates is defined to avoid infinite loops
  useEffect(() => {
    if (initialSelectedDates && initialSelectedDates.length > 0) {
      setSelectedDates(initialSelectedDates);
      onDatesSelected(initialSelectedDates);
    }
  }, [initialSelectedDates?.join(',')]); // Use join to create stable dependency

  // Generate next 7 days from today
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    return {
      date,
      dateString: format(date, 'yyyy-MM-dd'),
      dayOfWeek: format(date, 'EEE'),
      dayOfMonth: format(date, 'd'),
      monthName: format(date, 'MMM'),
    };
  });

  const toggleDate = (dateString: string) => {
    if (selectedDates.includes(dateString)) {
      const newDates = selectedDates.filter(d => d !== dateString);
      setSelectedDates(newDates);
      onDatesSelected(newDates);
    } else {
      if (selectedDates.length < daysPerWeek) {
        const newDates = [...selectedDates, dateString];
        setSelectedDates(newDates);
        onDatesSelected(newDates);
      }
    }
  };

  const isDateSelected = (dateString: string) => selectedDates.includes(dateString);
  const hasCorrectNumber = selectedDates.length === daysPerWeek;
  const canAddMore = selectedDates.length < daysPerWeek;

  return (
    <div className="space-y-4">
      {onBack && (
        <div className="mb-4">
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
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold" data-testid="text-day-picker-title">
          Select Your Workout Days
        </h3>
        <p className="text-sm text-muted-foreground" data-testid="text-day-picker-description">
          Choose {daysPerWeek} days from the next 7 days for your workouts
        </p>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {next7Days.map((day) => {
          const isSelected = isDateSelected(day.dateString);
          const canSelect = canAddMore || isSelected;

          return (
            <button
              key={day.dateString}
              onClick={() => canSelect && toggleDate(day.dateString)}
              disabled={!canSelect}
              data-testid={`button-day-${day.dateString}`}
              className={`
                relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all
                ${isSelected 
                  ? 'border-primary bg-primary text-primary-foreground' 
                  : canSelect
                    ? 'border-muted hover-elevate active-elevate-2 cursor-pointer'
                    : 'border-muted bg-muted/50 opacity-50 cursor-not-allowed'
                }
              `}
            >
              <span className="text-xs font-medium" data-testid={`text-day-of-week-${day.dateString}`}>
                {day.dayOfWeek}
              </span>
              <span className="text-2xl font-bold my-1" data-testid={`text-day-of-month-${day.dateString}`}>
                {day.dayOfMonth}
              </span>
              <span className="text-xs" data-testid={`text-month-${day.dateString}`}>
                {day.monthName}
              </span>
              {isSelected && (
                <div className="absolute top-1 right-1">
                  <Check className="w-4 h-4" data-testid={`icon-selected-${day.dateString}`} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm" data-testid="text-selection-status">
          {selectedDates.length} of {daysPerWeek} days selected
        </p>
        {hasCorrectNumber && !onConfirm && (
          <p className="text-sm text-green-600 dark:text-green-400 font-medium" data-testid="text-selection-complete">
            ✓ Selection complete
          </p>
        )}
      </div>

      {onConfirm && (
        <div className="flex justify-end pt-4">
          <Button
            size="lg"
            onClick={onConfirm}
            disabled={!hasCorrectNumber}
            data-testid="button-confirm-dates"
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
