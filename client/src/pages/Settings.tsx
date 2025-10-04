import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Mail, 
  RefreshCw, 
  Plug, 
  MessageSquare, 
  CreditCard, 
  LogOut,
  ChevronRight,
  ArrowLeft,
  Zap,
  Check
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { User as UserType, Subscription } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: user } = useQuery<UserType>({ queryKey: ["/api/auth/user"] });
  const { data: subscription } = useQuery<Subscription>({ queryKey: ["/api/subscription"] });

  const isPaidUser = subscription && subscription.tier === 'paid' && subscription.isActive;

  const upgradeMutation = useMutation({
    mutationFn: async (billingCycle: 'monthly' | 'yearly') => {
      await apiRequest("POST", "/api/subscription", {
        tier: 'paid',
        billingCycle,
        isActive: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({
        title: "Subscription Updated",
        description: "You've been upgraded to Premium! Enjoy your ad-free experience.",
      });
    },
  });

  const downgradeMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/subscription", {
        tier: 'free',
        billingCycle: null,
        isActive: 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({
        title: "Subscription Cancelled",
        description: "You've been switched to the Free plan.",
      });
    },
  });

  const menuItems = [
    {
      title: "Profile & Contact",
      description: "View and update your personal information",
      icon: User,
      action: () => toast({
        title: "Profile Management",
        description: "Profile editing coming soon!",
      }),
      testId: "button-profile",
    },
    {
      title: "Retake Assessment",
      description: "Update your fitness goals and preferences",
      icon: RefreshCw,
      action: () => toast({
        title: "Retake Assessment",
        description: "Assessment flow coming soon! You can manually update your goals in the Body page.",
      }),
      testId: "button-reassessment",
    },
    {
      title: "Integrations",
      description: "Connect with Apple Health, Google Fit, and more",
      icon: Plug,
      action: () => toast({
        title: "Integrations",
        description: "Third-party integrations coming soon! Stay tuned for Apple Health and Google Fit support.",
      }),
      testId: "button-integrations",
    },
    {
      title: "Help & Support",
      description: "Get help or submit feedback",
      icon: MessageSquare,
      action: () => toast({
        title: "Help & Support",
        description: "Support system coming soon! For now, please reach out to support@example.com",
      }),
      testId: "button-support",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/home">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account and preferences</p>
          </div>
        </div>

        {user && (
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Logged in as {user.email || "User"}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {user.profileImageUrl && (
                  <img 
                    src={user.profileImageUrl} 
                    alt="Profile" 
                    className="w-16 h-16 rounded-full object-cover"
                  />
                )}
                <div>
                  <p className="font-semibold">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              {isPaidUser ? "Premium Plan" : "Free Plan"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isPaidUser ? (
              <>
                <div className="flex items-center gap-2 text-green-500">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Premium Active</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enjoying ad-free workouts, priority support, and exclusive features
                </p>
                <p className="text-sm text-muted-foreground">
                  Billing: {subscription?.billingCycle === 'yearly' ? '$36/year' : '$5/month'}
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => downgradeMutation.mutate()}
                  disabled={downgradeMutation.isPending}
                  data-testid="button-cancel-subscription"
                >
                  Cancel Subscription
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Upgrade to Premium for an ad-free experience and exclusive features
                </p>
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={() => upgradeMutation.mutate('monthly')}
                    disabled={upgradeMutation.isPending}
                    data-testid="button-upgrade-monthly"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Upgrade - $5/month
                  </Button>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => upgradeMutation.mutate('yearly')}
                    disabled={upgradeMutation.isPending}
                    data-testid="button-upgrade-yearly"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Upgrade - $36/year (save 40%)
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="hover-elevate cursor-pointer" onClick={item.action}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold" data-testid={item.testId}>{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

      </div>
    </div>
  );
}
