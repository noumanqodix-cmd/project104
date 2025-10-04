import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RestTimerOverlayProps {
  duration: number;
  onComplete: (rir?: number) => void;
  onSkip: () => void;
  showAds?: boolean;
}

export default function RestTimerOverlay({ duration, onComplete, onSkip, showAds = false }: RestTimerOverlayProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [rir, setRir] = useState("");
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          playBeep();
          vibrate();
          setTimeout(() => onComplete(rir ? parseInt(rir) : undefined), 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onComplete, rir]);

  const playBeep = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = 800;
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  };

  const vibrate = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  };

  const progress = ((duration - timeLeft) / duration) * 100;
  const scale = timeLeft <= 3 ? 1 + (3 - timeLeft) * 0.1 : 1;

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="relative inline-block mb-8">
          <svg className="w-64 h-64 transform -rotate-90">
            <circle
              cx="128"
              cy="128"
              r="120"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
            />
            <circle
              cx="128"
              cy="128"
              r="120"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 120}`}
              strokeDashoffset={`${2 * Math.PI * 120 * (1 - progress / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <div 
            className="absolute inset-0 flex items-center justify-center transition-transform duration-200"
            style={{ transform: `scale(${scale})` }}
          >
            <div>
              <p className="text-8xl font-mono font-bold" data-testid="text-rest-timer">
                {timeLeft}
              </p>
              <p className="text-xl text-muted-foreground mt-2">seconds</p>
            </div>
          </div>
        </div>

        <p className="text-2xl font-semibold mb-6">Rest Time</p>

        <div className="max-w-xs mx-auto mb-6">
          <Label htmlFor="rir-input" className="text-base mb-2 block">
            How many more reps could you have done with perfect form?
          </Label>
          <Input
            id="rir-input"
            type="number"
            value={rir}
            onChange={(e) => setRir(e.target.value)}
            placeholder="Enter RIR"
            className="text-center text-xl h-12"
            min="0"
            data-testid="input-rir"
          />
          <p className="text-sm text-muted-foreground mt-2" data-testid="text-rir-helper">
            RIR (Reps in Reserve): How many more reps you could have done with perfect form
          </p>
        </div>

        <Button
          variant="outline"
          size="lg"
          onClick={onSkip}
          data-testid="button-skip-rest"
        >
          Skip Rest
        </Button>

        {showAds && (
          <div className="mt-8 p-4 border border-primary/30 rounded-lg bg-primary/5 max-w-md mx-auto" data-testid="ad-banner">
            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Advertisement</p>
              <div className="p-6 bg-muted/50 rounded-md">
                <p className="text-sm font-semibold mb-1">Premium Protein Powder</p>
                <p className="text-xs text-muted-foreground">Fuel your gains with the best protein on the market</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Upgrade to Premium for an ad-free experience
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
