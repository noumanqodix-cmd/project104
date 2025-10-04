import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface SubscriptionSelectorProps {
  onSelect: (tier: string, billingPeriod?: string) => void;
}

export default function SubscriptionSelector({ onSelect }: SubscriptionSelectorProps) {
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  const handleContinue = () => {
    if (selectedTier === "free") {
      onSelect("free");
    } else if (selectedTier === "paid") {
      onSelect("paid", billingPeriod);
    }
  };

  const canProceed = selectedTier !== "";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold mb-3">Choose Your Plan</h2>
          <p className="text-muted-foreground text-lg">
            Start with free or unlock premium features
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card
            className={`p-6 cursor-pointer hover-elevate ${
              selectedTier === "free" ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setSelectedTier("free")}
            data-testid="card-free-tier"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-6 w-6 text-primary" />
                <h3 className="text-2xl font-bold">Free</h3>
              </div>
              <RadioGroupItem
                value="free"
                checked={selectedTier === "free"}
                data-testid="radio-free"
              />
            </div>

            <div className="mb-6">
              <p className="text-4xl font-bold mb-2">$0</p>
              <p className="text-muted-foreground">Forever free</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Personalized workout programs</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Real-time workout tracking</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Exercise swap suggestions</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Progress analytics</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Nutrition tracking</span>
              </div>
              <div className="pt-3 border-t">
                <div className="flex items-start gap-2 text-muted-foreground">
                  <span className="text-sm font-medium">Ads during rest timers</span>
                </div>
              </div>
            </div>
          </Card>

          <Card
            className={`p-6 cursor-pointer hover-elevate relative overflow-hidden ${
              selectedTier === "paid" ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => setSelectedTier("paid")}
            data-testid="card-paid-tier"
          >
            <Badge className="absolute top-4 right-4" data-testid="badge-popular">
              Popular
            </Badge>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crown className="h-6 w-6 text-primary" />
                <h3 className="text-2xl font-bold">Premium</h3>
              </div>
              <RadioGroupItem
                value="paid"
                checked={selectedTier === "paid"}
                data-testid="radio-paid"
              />
            </div>

            {selectedTier === "paid" && (
              <RadioGroup
                value={billingPeriod}
                onValueChange={(value) => setBillingPeriod(value as "monthly" | "yearly")}
                className="mb-6"
              >
                <Label
                  htmlFor="monthly"
                  className="flex items-center justify-between border rounded-lg p-3 cursor-pointer hover-elevate"
                  data-testid="option-monthly"
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="monthly" id="monthly" />
                    <div>
                      <div className="font-semibold">Monthly</div>
                      <div className="text-sm text-muted-foreground">Billed monthly</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">$5</div>
                    <div className="text-xs text-muted-foreground">/month</div>
                  </div>
                </Label>

                <Label
                  htmlFor="yearly"
                  className="flex items-center justify-between border rounded-lg p-3 cursor-pointer hover-elevate relative"
                  data-testid="option-yearly"
                >
                  <Badge className="absolute -top-2 -right-2" variant="default" data-testid="badge-save">
                    Save 20%
                  </Badge>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="yearly" id="yearly" />
                    <div>
                      <div className="font-semibold">Yearly</div>
                      <div className="text-sm text-muted-foreground">Billed annually</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">$48</div>
                    <div className="text-xs text-muted-foreground">/year</div>
                  </div>
                </Label>
              </RadioGroup>
            )}

            {selectedTier !== "paid" && (
              <div className="mb-6">
                <p className="text-4xl font-bold mb-2">$5</p>
                <p className="text-muted-foreground">per month or $48/year</p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm font-semibold">Everything in Free</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm font-semibold">Ad-free experience</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Priority support</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-sm">Early access to new features</span>
              </div>
            </div>
          </Card>
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={handleContinue}
          disabled={!canProceed}
          data-testid="button-continue"
        >
          Continue with {selectedTier === "free" ? "Free" : "Premium"} Plan
        </Button>
      </div>
    </div>
  );
}
