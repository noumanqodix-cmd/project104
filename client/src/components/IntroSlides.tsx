import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Check, X, Sparkles, Crown } from "lucide-react";

interface IntroSlidesProps {
  onComplete: () => void;
}

export default function IntroSlides({ onComplete }: IntroSlidesProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Why FitForge is Different",
      content: (
        <div className="space-y-6">
          <p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto">
            Most fitness apps use random workouts that create imbalances and increase injury risk. 
            FitForge is built on exercise science principles that actually work.
          </p>
          
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 gap-4">
              {/* Header Row */}
              <div className="grid grid-cols-3 gap-4 pb-2 border-b-2">
                <div></div>
                <div className="text-center font-bold text-primary">FitForge</div>
                <div className="text-center font-medium text-muted-foreground">Other Apps</div>
              </div>

              {/* Exercise Programming */}
              <Card className="grid grid-cols-3 gap-4 items-center p-4">
                <div className="font-semibold">Exercise Programming</div>
                <div className="flex items-center justify-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-sm">Science-backed CNS ordering</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <X className="h-5 w-5 text-destructive" />
                  <span className="text-sm">Random exercises</span>
                </div>
              </Card>

              {/* Movement Patterns */}
              <Card className="grid grid-cols-3 gap-4 items-center p-4">
                <div className="font-semibold">Movement Patterns</div>
                <div className="flex items-center justify-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-sm">10 functional patterns</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <X className="h-5 w-5 text-destructive" />
                  <span className="text-sm">Isolated muscles only</span>
                </div>
              </Card>

              {/* Real-World Application */}
              <Card className="grid grid-cols-3 gap-4 items-center p-4">
                <div className="font-semibold">Real-World Strength</div>
                <div className="flex items-center justify-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-sm">Functional movements</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <X className="h-5 w-5 text-destructive" />
                  <span className="text-sm">Gym-only performance</span>
                </div>
              </Card>

              {/* Injury Prevention */}
              <Card className="grid grid-cols-3 gap-4 items-center p-4">
                <div className="font-semibold">Injury Prevention</div>
                <div className="flex items-center justify-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-sm">Balanced development</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <X className="h-5 w-5 text-destructive" />
                  <span className="text-sm">Muscle imbalances</span>
                </div>
              </Card>

              {/* Progressive Overload */}
              <Card className="grid grid-cols-3 gap-4 items-center p-4">
                <div className="font-semibold">Progressive Overload</div>
                <div className="flex items-center justify-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-sm">Smart progression</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <X className="h-5 w-5 text-destructive" />
                  <span className="text-sm">Same weights forever</span>
                </div>
              </Card>

              {/* Training Periodization */}
              <Card className="grid grid-cols-3 gap-4 items-center p-4">
                <div className="font-semibold">Training Structure</div>
                <div className="flex items-center justify-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-sm">CNS-based ordering</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <X className="h-5 w-5 text-destructive" />
                  <span className="text-sm">No structured plan</span>
                </div>
              </Card>
            </div>
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 max-w-3xl mx-auto">
            <p className="text-sm text-center">
              <strong>The Result:</strong> FitForge builds functional strength that transfers to real life—lifting groceries, 
              playing with kids, and preventing injuries—while other apps create gym-only gains that don't translate to everyday movement.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Choose Your Experience",
      content: (
        <div className="space-y-6">
          <p className="text-lg text-muted-foreground text-center max-w-3xl mx-auto">
            Start free with all core features. Upgrade to Premium when you're ready for unlimited flexibility.
          </p>
          
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
            {/* Free Tier */}
            <Card className="p-6 border-2">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
                <h3 className="text-2xl font-bold">Free</h3>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Science-backed CNS ordering</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">10 functional movement patterns</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Smart equipment swapping</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Partial workout resume</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Automatic workout rescheduling</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Monthly fitness test (1 per month)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Monthly program generation (1 per month)</span>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-sm text-center font-medium">Perfect for getting started</p>
              </div>
            </Card>

            {/* Premium Tier */}
            <Card className="p-6 border-2 border-primary relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold">
                POPULAR
              </div>
              
              <div className="flex items-center gap-2 mb-4">
                <Crown className="h-6 w-6 text-primary" />
                <h3 className="text-2xl font-bold">Premium</h3>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm"><strong>Everything in Free</strong></span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm"><strong>Unlimited</strong> fitness tests</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm"><strong>Unlimited</strong> program generation</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Advanced reporting & analytics</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Skip or shorten rest (ad-free experience)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Progress or regress fitness test levels</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Create your own custom programs</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Add your own custom exercises</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Favorite or hide exercises</span>
                </div>
              </div>

              <div className="bg-primary text-primary-foreground rounded-lg p-3">
                <p className="text-sm text-center font-medium">For power users who want full control</p>
              </div>
            </Card>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            All users start with Free. Upgrade anytime from your account settings.
          </p>
        </div>
      ),
    },
    {
      title: "Science-Backed Training",
      content: (
        <div className="space-y-6 max-w-3xl mx-auto">
          <p className="text-lg text-muted-foreground text-center">
            Every workout follows professional CNS ordering for optimal performance and recovery
          </p>
          
          <div className="space-y-3">
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Dynamic Warmup</h3>
                  <p className="text-sm text-muted-foreground">
                    Workout-specific movements to activate muscles and prepare your nervous system
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">2</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Power Exercises</h3>
                  <p className="text-sm text-muted-foreground">
                    Explosive movements when your nervous system is fresh for maximum output
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">3</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Compound Movements</h3>
                  <p className="text-sm text-muted-foreground">
                    Multi-joint exercises that build functional strength across multiple muscle groups
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">4</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Isolation & Core</h3>
                  <p className="text-sm text-muted-foreground">
                    Target specific muscles and anti-movement patterns for injury prevention
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">5</span>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Advanced Cardio Training</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Cardio matched to your nervous system's recovery state—not just random treadmill work
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                    <li>• <strong>HIIT</strong> - Explosive intervals for VO₂ max and power</li>
                    <li>• <strong>Power Intervals</strong> - Lactate threshold training</li>
                    <li>• <strong>Tempo Circuits</strong> - Aerobic endurance in the sweet spot</li>
                    <li>• <strong>Functional Circuits</strong> - Dynamic movement capacity</li>
                    <li>• <strong>Zone 2 Steady State</strong> - Fat metabolism and recovery</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>

          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <p className="text-sm text-center">
              <strong>Why it works:</strong> Traditional cardio drains your CNS, degrades muscle, and slows recovery. 
              Our method aligns cardio intensity with your nervous system state—so every session builds performance instead of breaking it down.
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Let's Build Your Program",
      content: (
        <div className="space-y-6 max-w-2xl mx-auto text-center">
          <p className="text-lg text-muted-foreground">
            Ready to experience science-backed training designed for real-world strength?
          </p>
          
          <div className="space-y-4">
            <Card className="p-6">
              <h3 className="font-semibold mb-2">What We'll Cover:</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Your fitness experience and available equipment</li>
                <li>• Body metrics and nutrition goals</li>
                <li>• Optional fitness assessment to personalize your program</li>
                <li>• Schedule selection for your workout cycle</li>
              </ul>
            </Card>

            <p className="text-sm text-muted-foreground">
              Takes about 5 minutes to complete
            </p>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-4">{slides[currentSlide].title}</h1>
          <div className="flex justify-center gap-2 mb-6">
            {slides.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide ? "w-8 bg-primary" : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mb-8">{slides[currentSlide].content}</div>

        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={handlePrevious}
            disabled={currentSlide === 0}
            data-testid="button-previous-slide"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          <Button
            onClick={handleNext}
            size="lg"
            data-testid="button-next-slide"
          >
            {currentSlide === slides.length - 1 ? (
              "Start Assessment"
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
