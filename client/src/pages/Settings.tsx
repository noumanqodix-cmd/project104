import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Target, 
  Zap, 
  CreditCard, 
  LogOut, 
  HelpCircle, 
  Mail,
  Phone,
  ChevronLeft,
  Crown,
  AlertTriangle
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const unitPreference = localStorage.getItem('unitPreference') || 'imperial';

  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [helpTicket, setHelpTicket] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("maintain");

  useEffect(() => {
    if (user) {
      setEmail(user.username || "");
      setPhone(user.phone || "");
      setSelectedGoal(user.nutritionGoal || "maintain");
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/user/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    localStorage.clear();
    setLocation("/");
  };

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      username: email,
      phone: phone || null,
    });
  };

  const handleSaveGoal = () => {
    updateProfileMutation.mutate({
      nutritionGoal: selectedGoal,
    });
  };

  const handleSubmitTicket = () => {
    if (!helpTicket.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message for your help ticket.",
        variant: "destructive",
      });
      return;
    }
    
    console.log("Submitting help ticket:", helpTicket);
    toast({
      title: "Ticket submitted",
      description: "We'll get back to you within 24-48 hours.",
    });
    setHelpTicket("");
  };

  const handleCancelSubscription = () => {
    updateProfileMutation.mutate({
      subscriptionTier: "free",
    });
  };

  const handleUpgradeToPaid = () => {
    toast({
      title: "Upgrade to Premium",
      description: "Stripe checkout integration coming soon!",
    });
  };

  const isPaidUser = user?.subscriptionTier === "paid";
  const weightUnit = unitPreference === 'imperial' ? 'lbs' : 'kg';
  const heightUnit = unitPreference === 'imperial' ? 'in' : 'cm';

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/home">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your account and preferences</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Profile & Contact</CardTitle>
            </div>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                data-testid="input-phone"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weight</Label>
                <p className="text-lg font-semibold" data-testid="text-weight">
                  {user?.weight ? `${Math.round(user.weight * (unitPreference === 'imperial' ? 2.20462 : 1))} ${weightUnit}` : '-'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Height</Label>
                <p className="text-lg font-semibold" data-testid="text-height">
                  {user?.height ? `${Math.round(user.height * (unitPreference === 'imperial' ? 0.393701 : 1))} ${heightUnit}` : '-'}
                </p>
              </div>
            </div>
            <Button 
              onClick={handleSaveProfile}
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-profile"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <CardTitle>Fitness Goals</CardTitle>
            </div>
            <CardDescription>Update your nutrition and fitness objectives</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal">Primary Goal</Label>
              <Select value={selectedGoal} onValueChange={setSelectedGoal}>
                <SelectTrigger id="goal" data-testid="select-goal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lose">Lose Weight</SelectItem>
                  <SelectItem value="maintain">Maintain Weight</SelectItem>
                  <SelectItem value="gain">Gain Muscle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Daily Calorie Target</Label>
              <p className="text-lg font-semibold" data-testid="text-calories">
                {user?.targetCalories || '-'} calories
              </p>
            </div>
            <Button 
              onClick={handleSaveGoal}
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-goal"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Update Goal"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              <CardTitle>App Integrations</CardTitle>
            </div>
            <CardDescription>Connect third-party apps and services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Workout reminders and updates</p>
                </div>
              </div>
              <Button variant="outline" size="sm" data-testid="button-email-integration">
                Configure
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">SMS Notifications</p>
                  <p className="text-sm text-muted-foreground">Text message reminders</p>
                </div>
              </div>
              <Button variant="outline" size="sm" data-testid="button-sms-integration">
                Configure
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              <CardTitle>Help & Support</CardTitle>
            </div>
            <CardDescription>Submit a ticket for assistance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="help-ticket">Describe your issue</Label>
              <Textarea
                id="help-ticket"
                value={helpTicket}
                onChange={(e) => setHelpTicket(e.target.value)}
                placeholder="Tell us what you need help with..."
                rows={4}
                data-testid="textarea-help-ticket"
              />
            </div>
            <Button 
              onClick={handleSubmitTicket}
              data-testid="button-submit-ticket"
            >
              Submit Ticket
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <CardTitle>Subscription</CardTitle>
            </div>
            <CardDescription>
              {isPaidUser ? "Premium Plan - Ad-free experience" : "Free Plan - With advertisements"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                {isPaidUser ? (
                  <Crown className="h-6 w-6 text-primary" />
                ) : (
                  <Zap className="h-6 w-6 text-muted-foreground" />
                )}
                <div>
                  <p className="font-semibold">{isPaidUser ? "Premium" : "Free"}</p>
                  <p className="text-sm text-muted-foreground">
                    {isPaidUser ? "$5/month or $48/year" : "With advertisement support"}
                  </p>
                </div>
              </div>
              {isPaidUser ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" data-testid="button-cancel-subscription">
                      Cancel Subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Premium Subscription?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You'll lose access to premium features and return to the free plan with ads. You can resubscribe anytime.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Premium</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancelSubscription}>
                        Cancel Subscription
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button onClick={handleUpgradeToPaid} data-testid="button-upgrade-premium">
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Premium
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle>Danger Zone</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Separator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" data-testid="button-logout">
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Logout of your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You'll need to log in again to access your workouts and progress.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout}>
                    Logout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
