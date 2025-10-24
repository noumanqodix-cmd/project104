import { Home, Calendar, Activity, TrendingUp } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function BottomNavigation() {
  const [location] = useLocation();

  const tabs = [
    { path: "/home", label: "Home", icon: Home, testId: "nav-home" },
    { path: "/history", label: "Calendar", icon: Calendar, testId: "nav-calendar" },
    { path: "/fitness-test", label: "Test", icon: TrendingUp, testId: "nav-fitness-test" },
    { path: "/body", label: "Body", icon: Activity, testId: "nav-body" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = location === tab.path;
          const Icon = tab.icon;
          
          return (
            <Link key={tab.path} href={tab.path}>
              <button
                data-testid={tab.testId}
                className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover-elevate"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
