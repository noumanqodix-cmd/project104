import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  AlertTriangle,
  Dumbbell,
  RefreshCw,
  Settings as SettingsIcon,
  Loader2
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { formatLocalDate, getTodayLocal } from "@shared/dateUtils";
import { calculateAge } from "@shared/utils";
import ThemeToggle from "@/components/ThemeToggle";
import { toggleEquipment as toggleEquipmentUtil } from "@/lib/equipmentUtils";

export default function Settings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: user } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const unitPreference = user?.unitPreference || 'imperial';

  const [helpTicket, setHelpTicket] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("maintain");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [workoutDuration, setWorkoutDuration] = useState(60);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [showProgramUpdateDialog, setShowProgramUpdateDialog] = useState(false);
  const [showGenerationModal, setShowGenerationModal] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<'generating' | 'success' | 'error'>('generating');
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [selectedUnitPreference, setSelectedUnitPreference] = useState<string>("imperial");
  
  // Track original values to detect program-affecting changes
  const [originalEquipment, setOriginalEquipment] = useState<string[]>([]);
  const [originalDaysPerWeek, setOriginalDaysPerWeek] = useState(3);
  const [originalWorkoutDuration, setOriginalWorkoutDuration] = useState(60);
  const [originalGoal, setOriginalGoal] = useState("maintain");

  useEffect(() => {
    if (user) {
      setSelectedGoal(user.nutritionGoal || "maintain");
      setSelectedEquipment(user.equipment || []);
      setDaysPerWeek(user.daysPerWeek || 3);
      setWorkoutDuration(user.workoutDuration || 60);
      setSelectedDays(user.selectedDays || []);
      setSelectedUnitPreference(user.unitPreference || "imperial");
      
      // Set original values for change detection
      setOriginalEquipment(user.equipment || []);
      setOriginalDaysPerWeek(user.daysPerWeek || 3);
      setOriginalWorkoutDuration(user.workoutDuration || 60);
      setOriginalGoal(user.nutritionGoal || "maintain");
      
      const isMetric = unitPreference === 'metric';
      if (user.height) {
        const displayHeight = Math.round(user.height * (isMetric ? 1 : 0.393701));
        setHeight(displayHeight.toString());
      }
      if (user.weight) {
        const displayWeight = Math.round(user.weight * (isMetric ? 1 : 2.20462));
        setWeight(displayWeight.toString());
      }
    }
  }, [user, unitPreference]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", "/api/user/profile", data);
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

  // Separate mutation for program settings - no success toast (dialog provides feedback)
  const updateProgramSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", "/api/user/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update program settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    // Properly logout from Replit Auth session
    window.location.href = "/api/logout";
  };

  const handleSavePhysicalStats = () => {
    const heightVal = parseFloat(height);
    const weightVal = parseFloat(weight);

    if (!heightVal || !weightVal) {
      toast({
        title: "Error",
        description: "Please enter valid height and weight values.",
        variant: "destructive",
      });
      return;
    }

    const isMetric = unitPreference === 'metric';
    let heightInCm = heightVal;
    let weightInKg = weightVal;

    if (!isMetric) {
      heightInCm = heightVal * 2.54;
      weightInKg = weightVal * 0.453592;
    }

    updateProfileMutation.mutate({
      height: heightInCm,
      weight: weightInKg,
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

  const handleSaveWorkoutPreferences = () => {
    if (selectedEquipment.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one equipment type.",
        variant: "destructive",
      });
      return;
    }

    if (selectedDays.length !== daysPerWeek) {
      toast({
        title: "Error",
        description: `Please select exactly ${daysPerWeek} workout days.`,
        variant: "destructive",
      });
      return;
    }

    // Detect if program-affecting settings changed (copy arrays before sorting to avoid mutation)
    const equipmentChanged = JSON.stringify([...selectedEquipment].sort()) !== JSON.stringify([...originalEquipment].sort());
    const daysChanged = daysPerWeek !== originalDaysPerWeek;
    const durationChanged = workoutDuration !== originalWorkoutDuration;
    const goalChanged = selectedGoal !== originalGoal;
    
    const programAffectingChanges = equipmentChanged || daysChanged || durationChanged || goalChanged;
    
    if (programAffectingChanges) {
      // Show dialog asking if user wants new program or just update settings
      setShowProgramUpdateDialog(true);
    } else {
      // No program-affecting changes, just save
      updateProgramSettingsMutation.mutate({
        nutritionGoal: selectedGoal,
        equipment: selectedEquipment,
        daysPerWeek,
        workoutDuration,
        selectedDays,
      });
    }
  };
  
  const handleKeepCurrentProgram = async () => {
    try {
      // Save preferences and wait for completion
      await updateProgramSettingsMutation.mutateAsync({
        nutritionGoal: selectedGoal,
        equipment: selectedEquipment,
        daysPerWeek,
        workoutDuration,
        selectedDays,
      });
      
      setShowProgramUpdateDialog(false);
      
      // Update original values only after successful save
      setOriginalGoal(selectedGoal);
      setOriginalEquipment(selectedEquipment);
      setOriginalDaysPerWeek(daysPerWeek);
      setOriginalWorkoutDuration(workoutDuration);
    } catch (error) {
      // If save fails, keep dialog open so user can retry
      console.error("Failed to save preferences:", error);
    }
  };
  
  const handleGenerateNewProgram = async () => {
    try {
      // Save preferences first and wait for completion
      await updateProgramSettingsMutation.mutateAsync({
        nutritionGoal: selectedGoal,
        equipment: selectedEquipment,
        daysPerWeek,
        workoutDuration,
        selectedDays,
      });
      
      // Then generate new program with updated settings
      setShowProgramUpdateDialog(false);
      setShowGenerationModal(true);
      setGenerationStatus('generating');
      generateNewProgramMutation.mutate();
      
      // Update original values
      setOriginalGoal(selectedGoal);
      setOriginalEquipment(selectedEquipment);
      setOriginalDaysPerWeek(daysPerWeek);
      setOriginalWorkoutDuration(workoutDuration);
    } catch (error) {
      // If profile update fails, don't proceed with program generation
      setShowProgramUpdateDialog(false);
      console.error("Failed to save preferences:", error);
    }
  };

  const toggleEquipment = (equipment: string) => {
    setSelectedEquipment(prev => toggleEquipmentUtil(prev, equipment));
  };

  const handleDayToggle = (dayValue: number) => {
    if (selectedDays.includes(dayValue)) {
      setSelectedDays(selectedDays.filter(d => d !== dayValue));
    } else {
      if (selectedDays.length < daysPerWeek) {
        setSelectedDays([...selectedDays, dayValue].sort((a, b) => a - b));
      }
    }
  };

  const sanitizeId = (id: string) => id.replace(/\s+/g, '-').toLowerCase();

  const generateNewProgramMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/programs/regenerate", {
        startDate: formatLocalDate(getTodayLocal()),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/programs/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workout-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/program-workouts"] });
      setGenerationStatus('success');
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to generate new program. Please try again.";
      setGenerationStatus('error');
    },
  });

  const handleCloseGenerationModal = () => {
    setShowGenerationModal(false);
  };

  const updateUnitPreferenceMutation = useMutation({
    mutationFn: async (newUnit: string) => {
      return await apiRequest("PUT", "/api/user/unit-preference", { unitPreference: newUnit });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Unit preference updated",
        description: "All measurements have been converted to the new unit system.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update unit preference. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveUnitPreference = () => {
    if (selectedUnitPreference !== unitPreference) {
      updateUnitPreferenceMutation.mutate(selectedUnitPreference);
    }
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
              <CardTitle>Account Information</CardTitle>
            </div>
            <CardDescription>Your Replit Auth profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.profileImageUrl} alt={user?.firstName || 'User'} />
                <AvatarFallback>
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-xl font-semibold" data-testid="text-full-name">
                  {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email || '-'}
                </p>
                <p className="text-sm text-muted-foreground" data-testid="text-email">
                  {user?.email || '-'}
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Account managed by Replit Auth</p>
                <p className="text-sm text-muted-foreground">Profile details are synced from your Replit account</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="w-full"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log Out
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              <CardTitle>App Preferences</CardTitle>
            </div>
            <CardDescription>Customize your app experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unit-preference">Unit Preference</Label>
              <Select value={selectedUnitPreference} onValueChange={setSelectedUnitPreference}>
                <SelectTrigger id="unit-preference" data-testid="select-unit-preference">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imperial">Imperial (lbs, in)</SelectItem>
                  <SelectItem value="metric">Metric (kg, cm)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Changing this will convert all your existing measurements to the new unit system
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Theme</Label>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Color Mode</p>
                  <p className="text-sm text-muted-foreground">Toggle between light and dark theme</p>
                </div>
                <ThemeToggle />
              </div>
            </div>

            <Button 
              onClick={handleSaveUnitPreference}
              disabled={updateUnitPreferenceMutation.isPending || selectedUnitPreference === unitPreference}
              data-testid="button-save-preferences"
            >
              {updateUnitPreferenceMutation.isPending ? "Saving..." : "Save Preferences"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <CardTitle>Physical Stats</CardTitle>
            </div>
            <CardDescription>Update your body measurements</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="height">Height ({heightUnit})</Label>
                <Input
                  id="height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder={unitPreference === 'imperial' ? '70' : '178'}
                  data-testid="input-height"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight ({weightUnit})</Label>
                <Input
                  id="weight"
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder={unitPreference === 'imperial' ? '180' : '82'}
                  data-testid="input-weight"
                />
              </div>
              <div className="space-y-2">
                <Label>Age</Label>
                <p className="text-lg font-semibold" data-testid="text-age">
                  {user?.dateOfBirth ? `${calculateAge(new Date(user.dateOfBirth))} years` : 'Not set'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Age is calculated from your date of birth (set during onboarding)
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>BMR (Basal Metabolic Rate)</Label>
              <p className="text-lg font-semibold" data-testid="text-bmr">
                {user?.bmr || '-'} calories/day
              </p>
              <p className="text-sm text-muted-foreground">
                Automatically recalculated when you update your stats
              </p>
            </div>
            <div className="space-y-2">
              <Label>Heart Rate Training Zones</Label>
              {user?.dateOfBirth ? (() => {
                const userAge = calculateAge(new Date(user.dateOfBirth));
                if (!userAge) {
                  return <p className="text-muted-foreground">Date of birth invalid</p>;
                }
                const maxHR = 220 - userAge;
                return (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold" data-testid="text-max-hr">
                      Maximum HR: {maxHR} bpm
                    </p>
                    <div className="grid grid-cols-1 gap-1 text-sm">
                      <p data-testid="text-hr-zone1">
                        Zone 1 (50-60%): {Math.round(maxHR * 0.50)}-{Math.round(maxHR * 0.60)} bpm - Warm-up
                      </p>
                      <p data-testid="text-hr-zone2">
                        Zone 2 (60-70%): {Math.round(maxHR * 0.60)}-{Math.round(maxHR * 0.70)} bpm - Fat Burning
                      </p>
                      <p data-testid="text-hr-zone3">
                        Zone 3 (70-80%): {Math.round(maxHR * 0.70)}-{Math.round(maxHR * 0.80)} bpm - Aerobic
                      </p>
                      <p data-testid="text-hr-zone4">
                        Zone 4 (80-90%): {Math.round(maxHR * 0.80)}-{Math.round(maxHR * 0.90)} bpm - Anaerobic
                      </p>
                      <p data-testid="text-hr-zone5">
                        Zone 5 (90-100%): {Math.round(maxHR * 0.90)}-{maxHR} bpm - Peak
                      </p>
                    </div>
                  </div>
                );
              })() : (
                <p className="text-muted-foreground">Date of birth not set</p>
              )}
            </div>
            <Button 
              onClick={handleSavePhysicalStats}
              disabled={updateProfileMutation.isPending}
              className="w-full"
              data-testid="button-save-physical-stats"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Update Physical Stats"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5" />
              <CardTitle>Program Settings</CardTitle>
            </div>
            <CardDescription>Configure your workout program and fitness goals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="goal">Nutrition Goal</Label>
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
              
              {/* Goal-specific descriptions */}
              {selectedGoal === "gain" && (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm font-medium text-primary">Muscle Gain Focus</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Prioritizes lifting volume with minimal cardio (5.5min HIIT only). Cardio included only when you have 3+ secondary exercises.
                  </p>
                </div>
              )}
              
              {selectedGoal === "maintain" && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Balanced Training</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Balanced strength and cardio mix (7.5min alternating HIIT/Steady-State). Cardio included when you have 2+ secondary exercises.
                  </p>
                </div>
              )}
              
              {selectedGoal === "lose" && (
                <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Fat Loss Focus</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Maximizes calorie burn with varied cardio (9min rotating through 4 types). Cardio included when you have 1+ secondary exercise.
                  </p>
                </div>
              )}
              
              <div className="space-y-1">
                <Label className="text-sm">Daily Calorie Target</Label>
                <p className="text-base font-semibold" data-testid="text-calories">
                  {user?.targetCalories || '-'} calories
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Available Equipment</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "bodyweight", label: "Bodyweight Only" },
                  { value: "dumbbells", label: "Dumbbells" },
                  { value: "kettlebell", label: "Kettlebell" },
                  { value: "barbell", label: "Barbell" },
                  { value: "resistance bands", label: "Resistance Bands" },
                  { value: "cable machine", label: "Cable Machine" },
                  { value: "pull-up bar", label: "Pull-up Bar" },
                  { value: "trx", label: "TRX" },
                  { value: "medicine ball", label: "Medicine Ball" },
                  { value: "box", label: "Box/Bench" },
                  { value: "jump rope", label: "Jump Rope" },
                  { value: "rower", label: "Rower" },
                  { value: "bike", label: "Bike" },
                  { value: "treadmill", label: "Treadmill" },
                  { value: "elliptical", label: "Elliptical" },
                  { value: "assault bike", label: "Assault Bike" },
                  { value: "stair climber", label: "Stair Climber" },
                ].map((eq) => {
                  const domId = sanitizeId(eq.value);
                  return (
                    <div key={eq.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={domId}
                        checked={selectedEquipment.includes(eq.value)}
                        onCheckedChange={() => toggleEquipment(eq.value)}
                        data-testid={`checkbox-equipment-${domId}`}
                      />
                      <Label htmlFor={domId} className="text-sm font-normal cursor-pointer">
                        {eq.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="days-per-week">Days Per Week</Label>
                <Select value={daysPerWeek.toString()} onValueChange={(val) => {
                  setDaysPerWeek(parseInt(val));
                  setSelectedDays([]); // Reset selected days when changing days per week
                }}>
                  <SelectTrigger id="days-per-week" data-testid="select-days-per-week">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 days</SelectItem>
                    <SelectItem value="4">4 days</SelectItem>
                    <SelectItem value="5">5 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workout-duration">Workout Duration</Label>
                <Select value={workoutDuration.toString()} onValueChange={(val) => setWorkoutDuration(parseInt(val))}>
                  <SelectTrigger id="workout-duration" data-testid="select-workout-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">
                Select your {daysPerWeek} workout days
              </Label>
              <p className="text-sm text-muted-foreground">
                Choose which days of the week you want to work out ({selectedDays.length}/{daysPerWeek} selected)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 1, label: "Monday" },
                  { value: 2, label: "Tuesday" },
                  { value: 3, label: "Wednesday" },
                  { value: 4, label: "Thursday" },
                  { value: 5, label: "Friday" },
                  { value: 6, label: "Saturday" },
                  { value: 7, label: "Sunday" },
                ].map((day) => {
                  const isSelected = selectedDays.includes(day.value);
                  const isDisabled = !isSelected && selectedDays.length >= daysPerWeek;
                  
                  return (
                    <Label
                      key={day.value}
                      htmlFor={`settings-day-${day.value}`}
                      className={`flex items-center space-x-3 border rounded-lg p-3 cursor-pointer ${
                        isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover-elevate'
                      }`}
                      data-testid={`option-day-${day.value}`}
                    >
                      <Checkbox
                        id={`settings-day-${day.value}`}
                        checked={isSelected}
                        onCheckedChange={() => handleDayToggle(day.value)}
                        disabled={isDisabled}
                        data-testid={`checkbox-day-${day.value}`}
                      />
                      <span className="font-medium text-sm">{day.label}</span>
                    </Label>
                  );
                })}
              </div>
            </div>

            <Button 
              onClick={handleSaveWorkoutPreferences}
              disabled={updateProgramSettingsMutation.isPending}
              className="w-full"
              data-testid="button-save-program-settings"
            >
              {updateProgramSettingsMutation.isPending ? "Saving..." : "Update Program Settings"}
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
      </div>

      {/* Program Generation Modal */}
      <Dialog open={showGenerationModal} onOpenChange={(open) => {
        if (!open && generationStatus !== 'generating') {
          handleCloseGenerationModal();
        }
      }}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-program-generation">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {generationStatus === 'generating' && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating Your Program
                </>
              )}
              {generationStatus === 'success' && (
                <>
                  <Dumbbell className="h-5 w-5 text-green-500" />
                  Program Generated Successfully!
                </>
              )}
              {generationStatus === 'error' && (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Generation Failed
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {generationStatus === 'generating' && (
                <>
                  <div className="space-y-4 py-4">
                    <p>Our AI is creating your personalized workout program...</p>
                    <p className="text-sm text-muted-foreground">This may take a few moments. Please wait.</p>
                  </div>
                </>
              )}
              {generationStatus === 'success' && (
                <div className="space-y-4 py-4">
                  <p>Your new workout program has been created and is ready to use!</p>
                  <Button 
                    onClick={handleCloseGenerationModal}
                    className="w-full"
                    data-testid="button-generation-ok"
                  >
                    OK
                  </Button>
                </div>
              )}
              {generationStatus === 'error' && (
                <div className="space-y-4 py-4">
                  <p className="text-destructive">Failed to generate your program. Please try again.</p>
                  <Button 
                    onClick={handleCloseGenerationModal}
                    variant="outline"
                    className="w-full"
                    data-testid="button-generation-close"
                  >
                    Close
                  </Button>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Program Update Dialog */}
      <AlertDialog open={showProgramUpdateDialog} onOpenChange={setShowProgramUpdateDialog}>
        <AlertDialogContent data-testid="dialog-program-update">
          <AlertDialogHeader>
            <AlertDialogTitle>Your Settings Have Changed</AlertDialogTitle>
            <AlertDialogDescription>
              You've updated your equipment, workout days, or workout duration. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-3 py-4">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Generate New Program</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Create a fresh workout program with your new settings. Your current program will be saved to history.
              </p>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Keep Current Program</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Just update your preferences. New equipment will be available for exercise swaps in your current program.
              </p>
            </div>
          </div>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel data-testid="button-keep-program">
              <span onClick={handleKeepCurrentProgram}>Keep Current Program</span>
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleGenerateNewProgram}
              disabled={generateNewProgramMutation.isPending}
              data-testid="button-generate-new-program"
            >
              {generateNewProgramMutation.isPending ? "Generating..." : "Generate New Program"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
