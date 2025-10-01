import { Button } from "@/components/ui/button";
import { Dumbbell } from "lucide-react";
import heroImage from "@assets/stock_images/person_exercising_wo_b21d5a6e.jpg";

interface WelcomePageProps {
  onGetStarted: () => void;
}

export default function WelcomePage({ onGetStarted }: WelcomePageProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70" />
      
      <div className="relative z-10 text-center px-6 max-w-4xl">
        <div className="flex justify-center mb-6">
          <div className="bg-primary/20 p-4 rounded-full">
            <Dumbbell className="h-16 w-16 text-primary" />
          </div>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
          FitForge
        </h1>
        <p className="text-xl md:text-2xl text-white/90 mb-8">
          Your personalized fitness journey starts here
        </p>
        <p className="text-lg text-white/80 mb-12 max-w-2xl mx-auto">
          Get custom workout programs tailored to your fitness level, available equipment, and goals. Track your progress and achieve results with AI-powered recommendations.
        </p>
        
        <Button
          size="lg"
          onClick={onGetStarted}
          className="text-lg px-8 py-6 h-auto"
          data-testid="button-get-started"
        >
          Get Started
        </Button>
      </div>
    </div>
  );
}
