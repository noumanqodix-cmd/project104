import type { Express, Request, Response } from "express";
import * as bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, emailOtp } from "@shared/schema";
import { sendEmail } from "./email";

// ==========================================
// CUSTOM AUTHENTICATION ROUTES
// ==========================================

const SALT_ROUNDS = 10;

// Registers authentication routes (currently register + verify OTP flow)
export const registerAppRoutes = (app: Express) => {
  // POST /api/auth/register - initiate user registration with OTP
  // Requires: firstName, lastName, email, password
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      console.log("[REGISTER] Received registration request");
      const { firstName, lastName, email, password } = req.body;
      console.log("[REGISTER] Body params:", {
        firstName,
        lastName,
        email: email ? "present" : "missing",
        password: password ? "present" : "missing",
      });

      // Validate required fields
      if (!firstName || !lastName || !email || !password) {
        console.log("[REGISTER] Validation failed: Missing required fields");
        return res.status(400).json({
          error:
            "Missing required fields. Please provide firstName, lastName, email, and password",
        });
      }
      console.log("[REGISTER] Validation passed: Required fields present");

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.log("[REGISTER] Validation failed: Invalid email format");
        return res.status(400).json({
          error: "Invalid email format",
        });
      }
      console.log("[REGISTER] Validation passed: Email format is valid");

      // Validate password strength (minimum 6 characters)
      if (password.length < 6) {
        console.log("[REGISTER] Validation failed: Password too short");
        return res.status(400).json({
          error: "Password must be at least 6 characters long",
        });
      }
      console.log(
        "[REGISTER] Validation passed: Password length is sufficient"
      );

      // Check if user already exists
      console.log(
        `[REGISTER] Checking for existing user with email: ${email.toLowerCase()}`
      );
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser.length > 0) {
        const user = existingUser[0];
        if (
          user.verificationStatus === "verified" ||
          user.verificationStatus === "restricted"
        ) {
          console.log(
            `[REGISTER] Conflict: Existing user status is ${user.verificationStatus}`
          );
          const message =
            user.verificationStatus === "verified"
              ? "User is already verified. Please log in."
              : "User account is restricted. Please contact support.";
          return res.status(409).json({ error: message });
        }
        // If pending, continue to resend OTP
        console.log(
          "[REGISTER] User exists with pending status, resending OTP"
        );
      } else {
        // save user to the users table with status pending
        await db.insert(users).values({
          firstName,
          lastName,
          email: email.toLowerCase(),
          password: await bcrypt.hash(password, SALT_ROUNDS),
          verificationStatus: "pending",
        });

        // Set user verification status to pending
        console.log("[REGISTER] User record created with pending verification");
      }

      // Generate 4-digit OTP
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      console.log(`[REGISTER] Generated OTP: ${otp}`);

      // Set OTP expiry (10 minutes from now)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      console.log(`[REGISTER] OTP expires at: ${expiresAt.toISOString()}`);

      // Upsert OTP in database
      console.log(`[REGISTER] Upserting OTP for ${email.toLowerCase()}`);
      await db
        .insert(emailOtp)
        .values({
          email: email.toLowerCase(),
          otp,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: emailOtp.email,
          set: {
            otp,
            expiresAt,
            isUsed: 0,
            createdAt: new Date(),
          },
        });
      console.log("[REGISTER] OTP stored successfully in the database");

      // Send OTP email
      try {
        await sendEmail({
          to: email.toLowerCase(),
          subject: "Your OTP Code ✔",
          text: `Your OTP code is: ${otp}`,
          html: `<b>Your OTP code is: ${otp}</b>`,
        });
      } catch (emailError) {
        console.error("[REGISTER] Failed to send OTP email:", emailError);
        return res.status(500).json({
          error: "Failed to send verification email. Please try again.",
        });
      }

      console.log("[REGISTER] Sending success response");

      res.status(200).json({
        message:
          "OTP sent to your email. Please verify to complete registration.",
        email: email.toLowerCase(),
      });
    } catch (error) {
      console.error("[REGISTER] Registration initiation error:", error);
      res.status(500).json({
        error: "Failed to initiate registration. Please try again.",
      });
    }
  });

  // POST /api/auth/verify-otp - Verify OTP and complete registration
  app.post("/api/auth/verify-otp", async (req: Request, res: Response) => {
    try {
      const { email, otp } = req.body;

      console.log(`Email ${email} and OTP ${otp} are required`)

      // Validate required fields
      if (!email ) {
        return res.status(400).json({
          error: `Email is required`,
        });
      } else if (!otp) {
        return res.status(400).json({
          error: `OTP is required`,
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: "Invalid email format",
        });
      }

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser.length === 0) {
        return res.status(400).json({
          error: "User not found. Please register first.",
        });
      }

      const user = existingUser[0];
      if (user.verificationStatus !== "pending") {
        const message =
          user.verificationStatus === "verified"
            ? "User is already verified. Please log in."
            : "User account is restricted. Please contact support.";
        return res.status(400).json({ error: message });
      }

      // Find the OTP record
      const otpRecord = await db
        .select()
        .from(emailOtp)
        .where(eq(emailOtp.email, email.toLowerCase()))
        .limit(1);

      if (otpRecord.length === 0) {
        return res.status(400).json({
          error: "No OTP found for this email. Please request a new one.",
        });
      }

      const otpData = otpRecord[0];

      // Check if OTP is expired (10 minutes)
      if (new Date() > new Date(otpData.expiresAt)) {
        return res.status(400).json({
          error: "OTP has expired. Please request a new one.",
        });
      }

      // Check if OTP has already been used
      if (otpData.isUsed) {
        return res.status(400).json({
          error: "OTP has already been used. Please request a new one.",
        });
      }

      // Verify OTP
      if (otpData.otp !== otp) {
        return res.status(400).json({
          error: "Invalid OTP. Please check and try again.",
        });
      }

      // update the user verification status to verified
      const updatedUsers = await db
        .update(users)
        .set({ verificationStatus: "verified" })
        .where(eq(users.email, email.toLowerCase()))
        .returning({ id: users.id });
      console.log(
        `[OTP-VERIFY] Updated user verification status for ${email.toLowerCase()}`
      );

      if (updatedUsers.length === 0) {
        throw new Error("Failed to update user verification status");
      }

      // Mark OTP as used
      await db
        .update(emailOtp)
        .set({ isUsed: 1 })
        .where(eq(emailOtp.id, otpData.id));

      res.status(201).json({
        message: "Registration completed successfully",
        user: { email: email.toLowerCase(), verificationStatus: "verified" },
      });
    } catch (error) {
      console.error("OTP verification error:", error);
      res.status(500).json({
        error: "Failed to verify OTP. Please try again.",
      });
    }
  });
};

// ==========================================
// CUSTOM ONBOARDING ROUTES
// ==========================================

export const onBoardingRoutes = (app: Express) => {
  const handleOnboarding = async (
    req: Request & { user?: { id?: string } } & {
      body?: { userId?: string };
    },
    res: Response
  ) => {
    try {
      console.log("[ONBOARDING] Request received", { path: req.path });

      const bodyUserId = (req.body as { userId?: string } | undefined)?.userId;
      const userId = req.user?.id ?? bodyUserId;
      if (!userId) {
        console.log("[ONBOARDING] Unauthorized request - missing user id");
        return res
          .status(401)
          .json({ error: "Unauthorized. Please log in." });
      }

      const providedFields = Object.keys(req.body ?? {});
      console.log("[ONBOARDING] Incoming payload overview", {
        userId,
        providedFieldCount: providedFields.length,
      });
      providedFields.forEach((fieldKey) => {
        const fieldValue = (req.body as Record<string, unknown>)[fieldKey];
        console.log(`[ONBOARDING] Field ${fieldKey}:`, fieldValue);
      });

      const {
        userId: _discardedUserId,
        height,
        weight,
        dateOfBirth,
        gender,
        nutritionGoal,
        targetCalories,
        selectedDays,
        daysPerWeek,
      } = req.body ?? {};

      const updatePayload: Record<string, unknown> = {};

      if (height !== undefined) updatePayload.height = height;
      if (weight !== undefined) updatePayload.weight = weight;
      if (gender !== undefined) updatePayload.gender = gender;
      if (nutritionGoal !== undefined)
        updatePayload.nutritionGoal = nutritionGoal;
      if (targetCalories !== undefined)
        updatePayload.targetCalories = targetCalories;
      if (selectedDays !== undefined)
        updatePayload.selectedDays = selectedDays;
      if (daysPerWeek !== undefined) updatePayload.daysPerWeek = daysPerWeek;

      if (dateOfBirth !== undefined) {
        const parsedDate = new Date(dateOfBirth);
        if (Number.isNaN(parsedDate.getTime())) {
          return res
            .status(400)
            .json({ error: "Invalid dateOfBirth format." });
        }
        updatePayload.dateOfBirth = parsedDate;
      }

      // Convert selectedDays strings to integers if provided
      if (updatePayload.selectedDays && Array.isArray(updatePayload.selectedDays)) {
        const dayMapping: Record<string, number> = {
          'monday': 1,
          'tuesday': 2,
          'wednesday': 3,
          'thursday': 4,
          'friday': 5,
          'saturday': 6,
          'sunday': 7
        };

        updatePayload.selectedDays = updatePayload.selectedDays.map((day: any) => {
          if (typeof day === 'string') {
            const lowerDay = day.toLowerCase();
            const dayNumber = dayMapping[lowerDay];
            if (!dayNumber) {
              throw new Error(`Invalid day name: ${day}. Must be monday, tuesday, wednesday, thursday, friday, saturday, or sunday.`);
            }
            return dayNumber;
          }
          return day; // Assume it's already a number
        });
      }

      const updateFieldKeys = Object.keys(updatePayload);
      if (updateFieldKeys.length === 0) {
        console.log("[ONBOARDING] No valid fields to update", {
          userId,
        });
        return res
          .status(400)
          .json({ error: "No onboarding fields provided." });
      }

      console.log("[ONBOARDING] Prepared update payload overview", {
        userId,
        updateFieldCount: updateFieldKeys.length,
      });
      updateFieldKeys.forEach((fieldKey) => {
        console.log(
          `[ONBOARDING] Updating ${fieldKey} ->`,
          updatePayload[fieldKey]
        );
      });

      const updatedUsers = await db
        .update(users)
        .set(updatePayload)
        .where(eq(users.id, userId))
        .returning({ id: users.id });

      if (updatedUsers.length === 0) {
        return res.status(404).json({ error: "User not found." });
      }

      console.log("[ONBOARDING] User onboarding data updated successfully", {
        userId,
        fieldsUpdated: Object.keys(updatePayload),
      });

      res.status(200).json({ message: "Onboarding completed successfully" });
    } catch (error) {
      console.error("[ONBOARDING] Error completing onboarding:", error);
      res.status(500).json({
        error: "Failed to complete onboarding. Please try again.",
      });
    }
  };

  // Support both legacy and new endpoint paths
  app.post("/api/onboarding", handleOnboarding);
  app.post("/api/auth/onboarding", handleOnboarding);
  
  // Test endpoint to verify route is registered
  app.get("/api/onboarding/test", (_req, res) => {
    console.log("[ONBOARDING] Test endpoint hit");
    res.json({ message: "Onboarding routes are registered!" });
  });
};
