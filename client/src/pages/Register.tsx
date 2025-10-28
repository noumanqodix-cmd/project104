import React, { useState } from "react";
// ...existing code...
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dumbbell, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast, ToastContainer } from "react-toastify";

const Register = () => {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      console.log("🔎 Checking if user already exists...");

      // Check in your custom `user_signups` table
      const { data: existingUser, error: checkError } = await supabase
        .from("user_signups")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (checkError) {
        console.error("⚠️ Error checking existing user:", checkError);
      }

      if (existingUser) {
        toast.error("A user with this email already exists. Please sign in.");
        setIsLoading(false);
        return;
      }

      console.log("➡️ Registering new user in Supabase Auth...");

      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        console.error("❌ Auth Error:", error.message);
        if (error.message.toLowerCase().includes("already registered")) {
          toast.error("A user with this email already exists. Please sign in.");
        } else {
          setError(error.message);
        }
        setIsLoading(false);
        return;
      }

      if (data?.user) {
        console.log("✅ New user created:", data.user);

        // Optional: Insert record in your table
        const { error: insertError } = await supabase
          .from("user_signups")
          .insert([
            {
              id: data.user.id,
              email: data.user.email,
              password_hash: password, // ⚠️ Avoid in production
              verified: false,
            },
          ]);

        if (insertError) console.error("❌ Insert error:", insertError);

        toast.success(
          "Registration Successful! Please check your email to verify your account."
        );
      }

      // reset fields on success
      setEmail("");
      setPassword("");
      setConfirmPassword("");

    } catch (err) {
      console.error("🔥 Unexpected Error:", err);
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-8 max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="bg-primary/20 p-3 rounded-full">
              <Dumbbell className="h-8 w-8 text-primary" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-center mb-2">
            Create Your Account
          </h2>
          <p className="text-muted-foreground text-center mb-8">
            Get started with your personalized fitness journey
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                minLength={6}
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm your password"
                minLength={6}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setLocation("/login")}
                className="text-primary hover:underline"
              >
                Sign in
              </button>
            </p>
          </div>
        </Card>
      </div>

      {/* ToastContainer for react-toastify */}
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </>
  );
};

export default Register;
