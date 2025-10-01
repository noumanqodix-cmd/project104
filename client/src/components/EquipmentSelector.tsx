import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dumbbell, Box, Anchor, Cable, Grid3x3 } from "lucide-react";

interface EquipmentSelectorProps {
  onComplete: (equipment: string[]) => void;
}

const equipmentOptions = [
  { id: "dumbbells", label: "Dumbbells", icon: Dumbbell },
  { id: "kettlebell", label: "Kettlebell", icon: Box },
  { id: "barbell", label: "Barbell", icon: Anchor },
  { id: "bands", label: "Resistance Bands", icon: Cable },
  { id: "rack", label: "Squat Rack", icon: Grid3x3 },
  { id: "cable", label: "Cable Machine", icon: Cable },
  { id: "pullupbar", label: "Pull-up Bar", icon: Grid3x3 },
  { id: "medicineball", label: "Medicine Balls", icon: Box },
];

export default function EquipmentSelector({ onComplete }: EquipmentSelectorProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleEquipment = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-8 max-w-4xl w-full">
        <h2 className="text-3xl font-bold mb-3">What equipment do you have?</h2>
        <p className="text-muted-foreground mb-8">
          Select all that apply. Don't worry if you have none!
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {equipmentOptions.map((equipment) => {
            const Icon = equipment.icon;
            const isSelected = selected.includes(equipment.id);
            
            return (
              <Label
                key={equipment.id}
                htmlFor={equipment.id}
                className={`flex flex-col items-center gap-3 border rounded-lg p-6 cursor-pointer hover-elevate ${
                  isSelected ? "border-primary bg-primary/10" : ""
                }`}
                data-testid={`option-${equipment.id}`}
              >
                <Checkbox
                  id={equipment.id}
                  checked={isSelected}
                  onCheckedChange={() => toggleEquipment(equipment.id)}
                  className="sr-only"
                />
                <Icon className={`h-8 w-8 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-medium text-center ${isSelected ? "text-primary" : ""}`}>
                  {equipment.label}
                </span>
              </Label>
            );
          })}
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={() => onComplete(selected)}
          data-testid="button-continue"
        >
          Continue
        </Button>
      </Card>
    </div>
  );
}
