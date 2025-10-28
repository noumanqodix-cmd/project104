import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Dumbbell, SkipForward } from "lucide-react";

interface TestTypeSelectorProps {
  onSelect: (testType: "bodyweight" | "weights" | "skip") => void;
  onBack: () => void;
}

export default function TestTypeSelector({ onSelect, onBack }: TestTypeSelectorProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-2 md:p-8 max-w-full md:max-w-4xl w-full">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">Choose Your Fitness Test</h2>
          <p className="text-muted-foreground">
            Select the test type that best matches your training style
          </p>
        </div>

        <div className="grid md:grid-cols-3 grid-cols-1 gap-6">
          <Card 
            className="p-6"
            data-testid="card-bodyweight-test"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Bodyweight Test</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Test your endurance and basic strength
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Push-ups</li>
                  <li>• Pull-ups</li>
                  <li>• Air Squats</li>
                  <li>• Mile Run</li>
                </ul>
              </div>
              <Button 
                size="lg"
                className="w-full"
                onClick={() => onSelect("bodyweight")}
                data-testid="button-select-bodyweight"
              >
                Select Bodyweight Test
              </Button>
            </div>
          </Card>

          <Card 
            className="p-6"
            data-testid="card-weights-test"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Dumbbell className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Weights Test</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Test your max strength with compound lifts
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Squat (1RM)</li>
                  <li>• Deadlift (1RM)</li>
                  <li>• Bench Press (1RM)</li>
                  <li>• Overhead Press (1RM)</li>
                  <li>• Barbell Row (1RM)</li>
                </ul>
              </div>
              <Button 
                size="lg"
                className="w-full"
                onClick={() => onSelect("weights")}
                data-testid="button-select-weights"
              >
                Select Weights Test
              </Button>
            </div>
          </Card>

          <Card 
            className="p-6"
            data-testid="card-skip-test"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <SkipForward className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Skip Test</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start with conservative recommendations
                </p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Based on experience level</li>
                  <li>• Conservative starting weights</li>
                  <li>• Can test later</li>
                </ul>
              </div>
              <Button 
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => onSelect("skip")}
                data-testid="button-skip-test"
              >
                Skip Fitness Test
              </Button>
            </div>
          </Card>
        </div>
      </Card>
    </div>
  );
}
