import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";

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
                  <h3 className="font-semibold mb-1">Zone 2 or HIIT Cardio</h3>
                  <p className="text-sm text-muted-foreground">
                    Goal-based cardio to support your nutrition targets without interfering with strength gains
                  </p>
                </div>
              </div>
            </Card>
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
