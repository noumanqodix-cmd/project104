import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dumbbell, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

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

    console.log("🟦 Form submitted with:", { email, password, confirmPassword });

    if (password !== confirmPassword) {
      console.warn("⚠️ Password mismatch");
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      console.warn("⚠️ Weak password (less than 6 chars)");
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      console.log("➡️ Signing up user via Supabase Auth...");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      console.log("🟩 Auth Response:", { data, error });

      if (error) {
        console.error("❌ Supabase Auth Error:", error.message);
        setError(error.message);
        return;
      }

      if (data.user) {
        console.log("✅ User created successfully:", data.user);

        console.log("➡️ Inserting user into custom table 'user_signups'...");
        const { error: insertError } = await supabase
          .from("user_signups")
          .insert([
            {
              id: data.user.id, // same as Supabase Auth user UUID
              email: data.user.email,
              password_hash: password, // ⚠️ raw password for now
              verified: false,
            },
          ]);

        if (insertError) {
          console.error("❌ Database insert error:", insertError.message);
        } else {
          console.log("🟢 User inserted successfully into user_signups");
        }

        alert("Registration successful! Please check your email to verify your account.");
      } else {
        console.warn("⚠️ No user returned in Supabase response");
      }
    } catch (err) {
      console.error("🔥 Signup process failed:", err);
      setError("Network error. Please try again.");
    } finally {
      console.log("🟨 Signup process finished");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-8 max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="bg-primary/20 p-3 rounded-full">
            <Dumbbell className="h-8 w-8 text-primary" />
          </div>
        </div>

        <h2 className="text-3xl font-bold text-center mb-2">Create Your Account</h2>
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
  );
};

export default Register;
