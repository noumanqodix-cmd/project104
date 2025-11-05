import type { Express, Request, Response } from "express";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { users, emailOtp, sessionTokens } from "@shared/schema";
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

        // Extract userId from JWT token (secure)
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

        // Check JWT expiration
        const isExpired = Date.now() >= (decoded.exp || 0) * 1000;
        if (isExpired) {
          return res.status(401).json({ error: "Session has expired" });
        }

        // Check database token status
        const tokenRecord = await db
          .select()
          .from(sessionTokens)
          .where(eq(sessionTokens.token, token))
          .limit(1);

        if (tokenRecord.length === 0 || tokenRecord[0].isTokenExpired) {
          return res.status(401).json({ error: "Invalid session" });
        }

        const data = req.body;
        console.log("[ONBOARDING] Body:", data);

        const { height, weight, dateOfBirth } = req.body;

        console.log("[ONBOARDING] Processing onboarding for userId:", userId);

        const updatePayload: Record<string, unknown> = {};

        if (height !== undefined) updatePayload.height = height;
        if (weight !== undefined) updatePayload.weight = weight;
        if (dateOfBirth !== undefined) {
          const parsedDate = new Date(dateOfBirth);
          if (Number.isNaN(parsedDate.getTime())) {
            return res
              .status(400)
              .json({ error: "Invalid dateOfBirth format." });
          }
          updatePayload.dateOfBirth = parsedDate;
        }

        // Update user by userId from JWT token (secure)
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
// description : login user and create token for session management and
// session in database for management of user login sessions

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

        // Generate JWT token and session
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new Error("JWT_SECRET is not defined in environment variables");
        }
        const token = jwt.sign({ userId: user.id }, jwtSecret, {
          expiresIn: "1d",
        });
        console.log(`[LOGIN] JWT token generated for user: ${user.id}`);

        // Calculate expiration date (1 day from now)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 1);

        // Store/Update token in session_tokens table (upsert - update existing or create new)
        await db
          .insert(sessionTokens)
          .values({
            token,
            isTokenExpired: 0, // false - new active token
            expiresAt,
            userId: user.id,
            email: user.email!,
          })
          .onConflictDoUpdate({
            target: sessionTokens.userId, // Conflict on userId (one session per user)
            set: {
              token, // Update with new token
              isTokenExpired: 0, // Reset to active
              expiresAt, // Update expiration
              email: user.email!, // Update email if changed
              updatedAt: new Date(), // Update timestamp
            },
          });
        console.log(
          `[LOGIN] Token stored/updated in session_tokens table for user: ${user.id}`
        );

        // Remove password from user data
        const { password: _, ...userWithoutPassword } = user;
        res.status(200).json({
          message: "Login successful",
          token,
          user: userWithoutPassword,
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

      const decoded = jwt.verify(token, jwtSecret) as {
        userId: string;
        exp?: number;
        iat?: number;
      };
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

      // Check if token exists in database (handles logout/deletion)
      const tokenRecord = await db
        .select()
        .from(sessionTokens)
        .where(eq(sessionTokens.token, token))
        .limit(1);

      if (tokenRecord.length === 0) {
        // Token was deleted (logout) or never existed
        return res.status(401).json({ error: "Invalid session" });
      }

      const dbToken = tokenRecord[0];

      // Check if token was manually expired in database
      if (dbToken.isTokenExpired) {
        return res.status(401).json({ error: "Session has expired" });
      }

      // isExpired Boolean (JWT expiration check)
      const isExpired = Date.now() >= (decoded.exp || 0) * 1000;

      // Update token status in database if JWT expired
      if (isExpired) {
        await db
          .update(sessionTokens)
          .set({
            isTokenExpired: 1, // 1 = true
            updatedAt: new Date(),
          })
          .where(eq(sessionTokens.token, token));
        return res.status(401).json({ error: "Session has expired" });
      }

      // Return a minimal public user shape (do NOT expose full user record)
      const dbUser = user[0];
      const responseUser = {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        verificationStatus: dbUser.verificationStatus,
        // Normalize DB stored flag (0/1) to boolean for the client
        isTokenExpired: !!dbToken.isTokenExpired,
      };

      res.status(200).json({
        message: "Session data retrieved successfully",
        user: responseUser,
      });
    } catch (error) {
      console.error("[SESSION] Error retrieving session data:", error);
      res.status(500).json({ error: "Failed to retrieve session data." });
    }
  });
};

// ==========================================
// LOGOUT ROUTE
// ==========================================

export const logoutAppRoutes = (app: Express) => {
  app.get("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Update token to expired in database (soft delete)
      const updateResult = await db
        .update(sessionTokens)
        .set({
          isTokenExpired: 1,
          updatedAt: new Date(),
        })
        .where(eq(sessionTokens.token, token));

      if (updateResult.rowCount === 0) {
        console.log("[LOGOUT] Token not found in database");
        return res.status(404).json({ error: "Session not found" });
      }

      console.log("[LOGOUT] Token successfully expired in database");
      res.status(200).json({ message: "Logout successful" });
    } catch (error) {
      console.error("[LOGOUT] Error logging out:", error);
      res.status(500).json({ error: "Failed to log out. Please try again." });
    }
  });
};

// ===========================================
// DELETE ACCOUNT ROUTE
// ===========================================

export const deleteAccountRoutes = (app: Express) => {
  app.get("/api/auth/delete-account", async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET is not defined in environment variables");
      }

      const decoded = jwt.verify(token, jwtSecret) as {
        userId: string;
        exp?: number;
        iat?: number;
      };
      const userId = decoded.userId;

      // Check if token is expired
      const isExpired = Date.now() >= (decoded.exp || 0) * 1000;
      if (isExpired) {
        return res.status(401).json({ error: "Session has expired" });
      }

      // Check if token exists and is not already expired in database
      const tokenRecord = await db
        .select()
        .from(sessionTokens)
        .where(eq(sessionTokens.token, token))
        .limit(1);

      if (tokenRecord.length === 0) {
        return res.status(401).json({ error: "Invalid session" });
      }

      const dbToken = tokenRecord[0];
      if (dbToken.isTokenExpired) {
        return res.status(401).json({ error: "Session has expired" });
      }

      // Check if user exists and is not already deleted
      const userRecord = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userRecord.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = userRecord[0];
      if (user.verificationStatus === "deleted") {
        return res.status(400).json({ error: "Account already deleted" });
      }

      // Start transaction-like operations (expire all user sessions)
      await db
        .update(sessionTokens)
        .set({
          isTokenExpired: 1,
          updatedAt: new Date(),
        })
        .where(eq(sessionTokens.userId, userId));

      // Mark user account as deleted
      const updateResult = await db
        .update(users)
        .set({
          verificationStatus: "deleted",
          email: null,
          password: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      if (updateResult.rowCount === 0) {
        console.log("[DELETE-ACCOUNT] Failed to mark user as deleted");
        return res.status(500).json({ error: "Failed to delete account" });
      }

      console.log("[DELETE-ACCOUNT] User account marked as deleted and all sessions expired");
      res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("[DELETE-ACCOUNT] Error deleting account:", error);
      res.status(500).json({ error: "Failed to delete account." });
    }
  });
};

// ===========================================
// GET PROFILE
// ===========================================

export const getProfileRoutes = (app: Express) => {
  app.get("/api/profile", async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      console.log("[PROFILE] Received profile request");

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET is not defined in environment variables");
      }

      const decoded = jwt.verify(token, jwtSecret) as {
        userId: string;
        exp?: number;
        iat?: number;
      };
      const userId = decoded.userId;
      console.log(`[PROFILE] Decoded userId: ${userId}`);

      // Check JWT expiration
      const isExpired = Date.now() >= (decoded.exp || 0) * 1000;
      if (isExpired) {
        return res.status(401).json({ error: "Session has expired" });
      }

      // Check database token status
      const tokenRecord = await db
        .select()
        .from(sessionTokens)
        .where(eq(sessionTokens.token, token))
        .limit(1);

      if (tokenRecord.length === 0 || tokenRecord[0].isTokenExpired) {
        return res.status(401).json({ error: "Invalid session" });
      }

      // Fetch user data from database
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const dbUser = user[0];
      console.log(`[PROFILE] User found: ${dbUser.id}`);

      // Return safe profile data only (exclude sensitive information)
      const profileData = {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        verificationStatus: dbUser.verificationStatus,
        height: dbUser.height,
        weight: dbUser.weight,
        dateOfBirth: dbUser.dateOfBirth,
        unitPreference: dbUser.unitPreference,
        equipment: dbUser.equipment,
        subscriptionTier: dbUser.subscriptionTier,
        nutritionGoal: dbUser.nutritionGoal,
        fitnessLevel: dbUser.fitnessLevel,
        daysPerWeek: dbUser.daysPerWeek,
        targetCalories: dbUser.targetCalories,
        bmr: dbUser.bmr,
        selectedDates: dbUser.selectedDates,
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
      };

      res.status(200).json({
        message: "Profile retrieved successfully",
        profile: profileData
      });
    } catch (error) {
      console.error("[PROFILE] Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile." });
    }
  });
};