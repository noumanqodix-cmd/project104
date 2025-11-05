import type { Express, Request, Response } from "express";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { users, emailOtp } from "@shared/schema";
import { sendEmail } from "./email";
import multer from "multer";

// Configure multer for form-data parsing
const upload = multer();

// ==========================================
// CUSTOM AUTHENTICATION ROUTES
// ==========================================

const SALT_ROUNDS = 10;

// Registers authentication routes (currently register + verify OTP flow)
export const registerAppRoutes = (app: Express) => {
  // POST /api/auth/register - initiate user registration with OTP
  // Requires: firstName, lastName, email, password
  app.post(
    "/api/auth/register",
    upload.none(),
    async (req: Request, res: Response) => {
      try {
        console.log("[REGISTER] Received registration request");
        const { firstName, lastName, email, password } = req.body;
        const data = req.body;
        console.log("[REGISTER] Body:", data);
        // console.log("[REGISTER] Body params:", {
        //   firstName,
        //   lastName,
        //   email: email ? "present" : "missing",
        //   password: password ? "present" : "missing",
        // });

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
          console.log(
            "[REGISTER] User record created with pending verification"
          );
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
    }
  );

  // POST /api/auth/verify-otp - Verify OTP and complete registration
  app.post(
    "/api/auth/verify-otp",
    upload.none(),
    async (req: Request, res: Response) => {
      try {
        const { email, otp } = req.body;

        console.log(`Email ${email} and OTP ${otp} are required`);

        // Validate required fields
        if (!email) {
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

        // convert otp to Number
        const numericOtp = Number(otp);
        const numberDataOTP = Number(otpData.otp);

        // Verify OTP
        if (numberDataOTP !== numericOtp) {
          return res.status(400).json({
            error: "Invalid OTP. Please check and try again.",
          });
        }

        // update the user verification status to verified
        const updatedUsers = await db
          .update(users)
          .set({ verificationStatus: "verified" })
          .where(eq(users.email, email.toLowerCase()))
          .returning();
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

        // Remove password from response
        const userData = updatedUsers[0];
        const { password: _, ...userWithoutPassword } = userData;

        // Export only specific fields
        const exportedUser = {
          id: userWithoutPassword.id,
          email: userWithoutPassword.email,
          firstName: userWithoutPassword.firstName,
          lastName: userWithoutPassword.lastName,
        };

        console.log(exportedUser, "userData");

        res.status(201).json({
          message: "Registration completed successfully",
          userData: exportedUser,
          status: { verificationStatus: "verified" },
        });
      } catch (error) {
        console.error("OTP verification error:", error);
        res.status(500).json({
          error: "Failed to verify OTP. Please try again.",
        });
      }
    }
  );
};

// ==========================================
// CUSTOM ONBOARDING ROUTES
// ==========================================

export const onBoardingRoutes = (app: Express) => {

  app.post(
    "/api/onboarding",
    upload.none(),
    async (req: Request, res: Response) => {
      try {
        console.log("[ONBOARDING] Request received", { path: req.path });

        const data = req.body;
        console.log("[ONBOARDING] Body:", data);

        const {
          userId,
          height,
          weight,
          dateOfBirth
        } = req.body;

        // Validate required userId
        if (!userId) {
          return res.status(400).json({ error: "userId is required." });
        }

        console.log("[ONBOARDING] Processing onboarding for userId:", userId);

        const updatePayload: Record<string, unknown> = {};

        if (height !== undefined) updatePayload.height = height;
        if (weight !== undefined) updatePayload.weight = weight;
        if (dateOfBirth !== undefined) {
          const parsedDate = new Date(dateOfBirth);
          if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({ error: "Invalid dateOfBirth format." });
          }
          updatePayload.dateOfBirth = parsedDate;
        }

        // Update user by userId (no authentication required since token comes after onboarding)
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
    }
  );

};

// ===========================================
// CUSTOM LOGIN ROUTES
// ============================================

export const loginAppRoutes = (app: Express) => {
  // POST /api/auth/login - Authenticate user with email and password
  app.post(
    "/api/auth/login",
    upload.none(),
    async (req: Request, res: Response) => {
      try {
        console.log("[LOGIN] Received login request");
        const { email, password } = req.body;
        console.log("[LOGIN] Body params:", {
          email: email ? "present" : "missing",
          password: password ? "present" : "missing",
        });

        // Validate required fields
        if (!email || !password) {
          console.log("[LOGIN] Validation failed: Missing required fields");
          return res
            .status(400)
            .json({ error: "Email and password are required." });
        }

        console.log("[LOGIN] Validation passed: Required fields present");

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          console.log("[LOGIN] Validation failed: Invalid email format");
          return res.status(400).json({ error: "Invalid email format." });
        }

        console.log("[LOGIN] Validation passed: Email format is valid");

        // Find user by email
        console.log(
          `[LOGIN] Looking up user with email: ${email.toLowerCase()}`
        );

        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);

        if (existingUser.length === 0) {
          console.log(
            `[LOGIN] User not found with email: ${email.toLowerCase()}`
          );
          return res.status(401).json({ error: "Invalid email or password." });
        }
        console.log(`[LOGIN] User found, verifying password`);

        const user = existingUser[0];

        // Verify password
        if (!user.password) {
          console.log(`[LOGIN] User password is null for user: ${user.id}`);
          return res.status(401).json({ error: "Invalid email or password." });
        }
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
          console.log(
            `[LOGIN] Password verification failed for user: ${user.id}`
          );
          return res.status(401).json({ error: "Invalid email or password." });
        }

        console.log(
          `[LOGIN] Password verification successful for user: ${user.id}`
        );

        // Generate JWT token for session management and save session in database
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new Error("JWT_SECRET is not defined in environment variables");
        }
        const token = jwt.sign({ userId: user.id }, jwtSecret, {
          expiresIn: "1d", // Token valid for 1 day
        });
        console.log(`[LOGIN] JWT token generated for user: ${user.id}`);

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        res.status(200).json({
          message: "Login successful",
          token,
          userData: userWithoutPassword,
        });
      
      } catch (error) {
        console.error("[LOGIN] Error logging in:", error);
        res.status(500).json({ error: "Failed to log in. Please try again." });
      }
    }
  );
};

// ==========================================
// GET USER SESSION DATA ROUTE
// ==========================================

export const getUserSessionData = (app: Express) => {
  app.get("/api/auth/session", async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET is not defined in environment variables");
      }

      const decoded = jwt.verify(token, jwtSecret) as { userId: string };
      const userId = decoded.userId;

      // Fetch user data from database
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      // Remove password from user data
      const { password: _, ...userWithoutPassword } = user[0];

      res.status(200).json({
        message: "Session data retrieved successfully",
        user: userWithoutPassword,
      });
    } catch (error) {
      console.error("[SESSION] Error retrieving session data:", error);
      res.status(500).json({ error: "Failed to retrieve session data." });
    }
  });
};