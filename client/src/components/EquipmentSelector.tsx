import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { getEquipmentIcon, formatEquipmentLabel, formatCategoryName } from "@/lib/equipmentIcons";
import type { Equipment } from "@shared/schema";

interface EquipmentSelectorProps {
  onComplete: (equipment: string[]) => void;
}

interface EquipmentCategory {
  category: string;
  items: Array<{ id: string; label: string; icon: any }>;
}

export default function EquipmentSelector({ onComplete }: EquipmentSelectorProps) {
  const [selected, setSelected] = useState<string[]>([]);

  // Fetch equipment from API
  const { data: equipmentData, isLoading } = useQuery<Equipment[]>({
    queryKey: ['/api/equipment'],
  });

  // Transform API data into component format
  const equipmentCategories = useMemo((): EquipmentCategory[] => {
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

  const toggleEquipment = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const sanitizeId = (id: string) => id.replace(/\s+/g, '-').toLowerCase();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-8 max-w-6xl w-full">
          <h2 className="text-3xl font-bold mb-3">What equipment do you have?</h2>
          <p className="text-muted-foreground mb-8">Loading equipment options...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-8 max-w-6xl w-full">
        <h2 className="text-3xl font-bold mb-3"  >What equipment do you have?</h2>
        <p className="text-muted-foreground mb-8">
          Select all that apply. Don't worry if you have none
        </p>

        <div  className="space-y-8 mb-8">
          {equipmentCategories.map((category) => (
            <div key={category.category}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                {category.category}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {category.items.map((equipment) => {
                  const Icon = equipment.icon;
                  const isSelected = selected.includes(equipment.id);
                  const domId = sanitizeId(equipment.id);
                  
                  return (
                    <Label
                      key={equipment.id}
                      htmlFor={domId}
                      className={`flex flex-col items-center gap-3 border rounded-lg p-6 cursor-pointer hover-elevate ${
                        isSelected ? "border-primary bg-primary/10" : ""
                      }`}
                      data-testid={`option-${domId}`}
                    >
                      <Checkbox
                        id={domId}
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
            </div>
          ))}
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
