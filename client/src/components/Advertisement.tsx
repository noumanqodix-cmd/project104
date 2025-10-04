import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, X } from "lucide-react";

interface AdvertisementProps {
  onDismiss?: () => void;
  allowDismiss?: boolean;
}

export default function Advertisement({ onDismiss, allowDismiss = true }: AdvertisementProps) {
  const [dismissCountdown, setDismissCountdown] = useState(3);
  const [canDismiss, setCanDismiss] = useState(false);

  useEffect(() => {
    if (!allowDismiss) return;

    const timer = setInterval(() => {
      setDismissCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanDismiss(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [allowDismiss]);

  return (
    <Card className="border-2 border-primary bg-gradient-to-br from-primary/5 to-background">
      <CardContent className="p-6 relative">
        {canDismiss && onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={onDismiss}
            data-testid="button-close-ad"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="bg-primary/20 p-4 rounded-full">
            <Zap className="h-12 w-12 text-primary" />
          </div>

          <div>
            <h3 className="text-2xl font-bold mb-2">
              Tired of Ads?
            </h3>
            <p className="text-muted-foreground mb-4">
              Upgrade to Premium for an ad-free experience, priority support, and exclusive features
            </p>
          </div>

          <div className="space-y-2 w-full">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-3xl font-bold">$5</span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <p className="text-sm text-muted-foreground">or $36/year (save 40%)</p>
          </div>

          <Button 
            size="lg" 
            className="w-full max-w-xs"
            onClick={() => window.location.href = "/settings"}
            data-testid="button-upgrade-premium"
          >
            <Zap className="h-4 w-4 mr-2" />
            Upgrade to Premium
          </Button>

          {!canDismiss && allowDismiss && (
            <p className="text-xs text-muted-foreground">
              You can close this in {dismissCountdown} seconds
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
