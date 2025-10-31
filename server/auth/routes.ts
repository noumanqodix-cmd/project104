import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import {
  fitnessAssessments,
  exercises,
  programExercises,
  programWorkouts,
  workoutSessions,
  equipment,
  users,
  workoutPrograms,
  workoutSets,
} from "@shared/schema";
import { eq } from "drizzle-orm";
// Authentication removed - no longer using protective routes
import {
  generateWorkoutProgram,
  suggestExerciseSwap,
  generateProgressionRecommendation,
} from "./ai-service";
import {
  generateComprehensiveExerciseLibrary,
  generateMasterExerciseDatabase,
  generateExercisesForEquipment,
} from "./ai-exercise-generator";
import {
  insertFitnessAssessmentSchema,
  insertWorkoutSessionSchema,
  patchWorkoutSessionSchema,
  insertWorkoutSetSchema,
  type FitnessAssessment,
  type ProgramWorkout,
  type Exercise,
} from "@shared/schema";
import {
  determineIntensityFromProgramType,
  calculateCaloriesBurned,
  poundsToKg,
} from "./calorie-calculator";
import { z } from "zod";
import { calculateAge } from "@shared/utils";
import {
  parseLocalDate,
  formatLocalDate,
  isSameCalendarDay,
  isBeforeCalendarDay,
  isAfterCalendarDay,
} from "@shared/dateUtils";
import type { SupabaseClient } from "@supabase/supabase-js";



// ==========================================
// CUSTOM AUTHENTICATION ROUTES
// ==========================================

// POST /api/auth/register - create a new user
// Requires: firstName, lastName, email, password
import bcrypt from "bcrypt";

// At the top of your file with other imports
const SALT_ROUNDS = 783;

// POST /api/auth/register - create a new user
app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        error: "Missing required fields. Please provide firstName, lastName, email, and password"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email format"
      });
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long"
      });
    }

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(409).json({
        error: "User with this email already exists"
      });
    }

    // Hash the password with bcrypt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create new user in database
    const [newUser] = await db
      .insert(users)
      .values({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
      })
      .returning();

    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      message: "User registered successfully",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      error: "Failed to register user. Please try again."
    });
  }
});

// POST /api/auth/login - login existing user
app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required"
      });
    }

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    // Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: "Login successful",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "Failed to login. Please try again."
    });
  }
});