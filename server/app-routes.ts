import type { Express, Request, Response } from "express";
import * as bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { users, emailOtp, sessionTokens } from "@shared/schema";
import { sendEmail } from "./email";
import multer from "multer";
import { randomBytes } from "crypto";

// Configure multer for form-data parsing

// =========================================
// VARIABLES DECLARATION
// =========================================

const upload = multer();

const SALT_ROUNDS = 10;

const VERIFICATION_STATUS_MESSAGES = {
  verified: "User is already verified. Please log in.",
  pending: "User verification is pending. Please check your email for OTP.",
  restricted: "User account is restricted. Please contact support.",
  deleted: "User account has been deleted.",
};

type VerificationStatus = keyof typeof VERIFICATION_STATUS_MESSAGES;

// ==========================================
// CUSTOM AUTH ROUTES
// ==========================================

export const authRoutes = (app: Express) => {
  // POST /api/auth/register - initiate user registration with OTP
  // Requires: firstName, lastName, email, password
  app.post(
    "/api/auth/register",
    upload.none(),
    async (req: Request, res: Response) => {
      try {
        const { firstName, lastName, email, password } = req.body;

        // Validate required fields
        const missingFields: string[] = [];
        if (!firstName) missingFields.push("firstName");
        if (!lastName) missingFields.push("lastName");
        if (!email) missingFields.push("email");
        if (!password) missingFields.push("password");

        if (missingFields.length > 0) {
          console.log("[REGISTER] Validation failed: Missing required fields");

          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Please fill all required fields",
            },
            data: {
              receivedFields: req.body,
              missingFields,
            },
          });
        }

        console.log("[REGISTER] Validation passed: Required fields present");

        // =================== Validate email format ================================
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          console.log("[REGISTER] Validation failed: Invalid email format");
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Invalid email format",
            },
            data: {
              email: email,
              invalidFormat: ["email"],
            },
          });
        }

        console.log("[REGISTER] Validation passed: Email format is valid");

        // Validate password strength (minimum 6 characters)
        if (password.length < 6) {
          console.log("[REGISTER] Validation failed: Password too short");
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Password must be at least 6 characters long",
            },
            data: {
              password: password,
              invalidFields: ["password"],
            },
          });
        }
        console.log(
          "[REGISTER] Validation passed: Password length is sufficient"
        );

        // =================== Check if user already exists ================================
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
            user.verificationStatus === "pending"
          ) {
            console.log(
              `[REGISTER] Conflict: Existing user status is ${user.verificationStatus}`
            );
            const status = user.verificationStatus as VerificationStatus;
            const message =
              VERIFICATION_STATUS_MESSAGES[status] ||
              "verificationStatus is not detectable.";
            return res.status(409).json({
              status: {
                remark: "user_already_exists",
                status: "error",
                message,
              },
              data: {
                email: email.toLowerCase(),
                verificationStatus: user.verificationStatus,
              },
            });
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

        // ======================== Generate 4-digit OTP ==========================

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

        // ========================== Send OTP email =============================

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
            status: {
              remark: "otp_send_failed",
              status: "error",
              message: "Failed to send OTP to email. Please try again.",
            },
          });
        }

        console.log("[REGISTER] Sending success response");

        res.status(200).json({
          status: {
            remark: "otp_sent",
            status: "success",
            message:
              "OTP sent to your email. Please verify to complete registration.",
          },
          data: {
            email: email.toLowerCase(),
            otp,
          },
        });
      } catch (error) {
        console.error("[REGISTER] Registration initiation error:", error);
        res.status(500).json({
          status: {
            remark: "registration_failed",
            status: "error",
            message: "Failed to initiate registration. Please try again.",
          },
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
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Email is required",
            },
            data: {
              missingFields: ["email"],
            },
          });
        } else if (!otp) {
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "OTP is required",
            },
            data: {
              missingFields: ["otp"],
            },
          });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Invalid email format",
            },
            data: {
              invalidFormat: ["email"],
            },
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
            status: {
              remark: "user_not_found",
              status: "error",
              message: "User not found. Please register first.",
            },
            data: {
              email: email.toLowerCase(),
            },
          });
        }

        const user = existingUser[0];
        if (user.verificationStatus !== "pending") {
          const status = user.verificationStatus as VerificationStatus;
          const message =
            VERIFICATION_STATUS_MESSAGES[status] ||
            "Unknown verification status.";
          return res.status(400).json({
            status: {
              remark: "invalid_verification_status",
              status: "error",
              message,
            },
            data: {
              email: email.toLowerCase(),
              verificationStatus: user.verificationStatus,
            },
          });
        }

        // Find the OTP record
        const otpRecord = await db
          .select()
          .from(emailOtp)
          .where(eq(emailOtp.email, email.toLowerCase()))
          .limit(1);

        if (otpRecord.length === 0) {
          return res.status(400).json({
            status: {
              remark: "otp_not_found",
              status: "error",
              message: "No OTP found for this email. Please request a new one.",
            },
            data: {
              email: email.toLowerCase(),
            },
          });
        }

        const otpData = otpRecord[0];

        // Check if OTP is expired (10 minutes)
        if (new Date() > new Date(otpData.expiresAt)) {
          return res.status(400).json({
            status: {
              remark: "otp_expired",
              status: "error",
              message: "OTP has expired. Please request a new one.",
            },
            data: {
              email: email.toLowerCase(),
            },
          });
        }

        // Check if OTP has already been used
        if (otpData.isUsed) {
          return res.status(400).json({
            status: {
              remark: "otp_used",
              status: "error",
              message: "OTP has already been used. Please request a new one.",
            },
            data: {
              email: email.toLowerCase(),
            },
          });
        }

        // convert otp to Number
        const numericOtp = Number(otp);
        const numberDataOTP = Number(otpData.otp);

        // Verify OTP
        if (numberDataOTP !== numericOtp) {
          return res.status(400).json({
            status: {
              remark: "invalid_otp",
              status: "error",
              message: "Invalid OTP. Please check and try again.",
            },
            data: {
              email: email.toLowerCase(),
            },
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

        // Generate JWT token and session for the newly verified user
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new Error("JWT_SECRET is not defined in environment variables");
        }
        const token = jwt.sign({ userId: updatedUsers[0].id }, jwtSecret, {
          expiresIn: "1d",
        });
        console.log(
          `[OTP-VERIFY] JWT token generated for user: ${updatedUsers[0].id}`
        );

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
            userId: updatedUsers[0].id,
            email: updatedUsers[0].email!,
          })
          .onConflictDoUpdate({
            target: sessionTokens.userId, // Conflict on userId (one session per user)
            set: {
              token, // Update with new token
              isTokenExpired: 0, // Reset to active
              expiresAt, // Update expiration
              email: updatedUsers[0].email!, // Update email if changed
              updatedAt: new Date(), // Update timestamp
            },
          });
        console.log(
          `[OTP-VERIFY] Token stored/updated in session_tokens table for user: ${updatedUsers[0].id}`
        );

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
          status: {
            remark: "user_verification_completed",
            status: "success",
            message: "User verification completed successfully",
          },
          data: {
            // user: exportedUser,
            token,
            // session: {
            //   expiresAt: expiresAt.getTime(),
            //   isTokenExpired: false,
            // },
          },
        });
      } catch (error) {
        console.error("OTP verification error:", error);
        res.status(500).json({
          status: {
            remark: "verification_failed",
            status: "error",
            message: "Failed to verify OTP. Please try again.",
          },
        });
      }
    }
  );

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
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Email and password are required.",
            },
            data: {
              missingFields: ["email", "password"].filter(
                (field) => !req.body[field]
              ),
            },
          });
        }

        console.log("[LOGIN] Validation passed: Required fields present");

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          console.log("[LOGIN] Validation failed: Invalid email format");
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Invalid email format.",
            },
            data: {
              invalidFormat: ["email"],
            },
          });
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
          return res.status(401).json({
            status: {
              remark: "invalid_credentials",
              status: "error",
              message: "Invalid email or password.",
            },
          });
        }

        console.log(`[LOGIN] User found, verifying password`);

        const user = existingUser[0];

        // Check verification status
        if (user.verificationStatus === "pending") {
          return res.status(403).json({
            status: {
              remark: "user_not_verified",
              status: "error",
              message: "User is not verified. Please verify your account.",
            },
            data: {
              email: email.toLowerCase(),
              verificationStatus: user.verificationStatus,
            },
          });
        }

        if (user.verificationStatus !== "verified") {
          const status = user.verificationStatus as VerificationStatus;
          const message =
            VERIFICATION_STATUS_MESSAGES[status] ||
            "Account status is invalid.";
          return res.status(403).json({
            status: {
              remark: "account_status_invalid",
              status: "error",
              message,
            },
            data: {
              email: email.toLowerCase(),
              verificationStatus: user.verificationStatus,
            },
          });
        }

        // Verify password
        if (!user.password) {
          console.log(`[LOGIN] User password is null for user: ${user.id}`);
          return res.status(401).json({
            status: {
              remark: "invalid_credentials",
              status: "error",
              message: "Invalid email or password.",
            },
          });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
          console.log(
            `[LOGIN] Password verification failed for user: ${user.id}`
          );
          return res.status(401).json({
            status: {
              remark: "invalid_credentials",
              status: "error",
              message: "Invalid email or password.",
            },
          });
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

        res.status(200).json({
          status: {
            remark: "login_successful",
            status: "success",
            message: "Login successful",
          },
          data: {
            token,
            session: {
              expiresAt: expiresAt.getTime(),
              isTokenExpired: false,
            },
          },
        });
      } catch (error) {
        console.error("[LOGIN] Error logging in:", error);
        res.status(500).json({
          status: {
            remark: "login_failed",
            status: "error",
            message: "Failed to log in. Please try again.",
          },
        });
      }
    }
  );
};

// ==========================================
// OTP VERIFICATION
// =========================================

export const otpRoutes = (app: Express) => {
  // POST /api/otp/resend - Resend OTP to email
  app.post(
    "/api/otp/resend",
    upload.none(),
    async (req: Request, res: Response) => {
      try {
        const { email } = req.body;
        console.log(
          "[OTP-RESEND] Received resend OTP request for email:",
          email
        );
        // Validate email
        if (!email) {
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Email is required.",
            },
            data: {
              missingFields: ["email"],
            },
          });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Invalid email format.",
            },
            data: {
              invalidFormat: ["email"],
            },
          });
        }
        // Check if user exists and is pending verification
        const existingUser = await db

          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);
        if (existingUser.length === 0) {
          return res.status(404).json({
            status: {
              remark: "user_not_found",
              status: "error",
              message: "User not found. Please register first.",
            },
            data: {
              email: email.toLowerCase(),
            },
          });
        }
        const user = existingUser[0];
        if (user.verificationStatus !== "pending") {
          return res.status(400).json({
            status: {
              remark: "invalid_verification_status",
              status: "error",
              message: "User is already verified",
            },
            data: {
              email: email.toLowerCase(),
              verificationStatus: user.verificationStatus,
            },
          });
        }
        // Generate new 4 digit OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        console.log(`[OTP-RESEND] Generated new OTP: ${otp}`);
        // Set OTP expiry (10 minutes from now)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);
        console.log(`[OTP-RESEND] OTP expires at: ${expiresAt.toISOString()}`);
        // Upsert OTP in database
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
        console.log("[OTP-RESEND] OTP stored successfully in the database");
        // Send OTP email
        try {
          await sendEmail({
            to: email.toLowerCase(),
            subject: "Your OTP Code ✔",
            text: `Your OTP code is: ${otp}`,
            html: `<b>Your OTP code is: ${otp}</b>`,
          });
        } catch (emailError) {
          console.error("[OTP-RESEND] Failed to send OTP email:", emailError);
          return res.status(500).json({
            status: {
              remark: "otp_send_failed",
              status: "error",
              message: "Failed to send OTP to email. Please try again.",
            },
          });
        }
        console.log("[OTP-RESEND] Sending success response");
        res.status(200).json({
          status: {
            remark: "otp_resent",
            status: "success",
            message:
              "OTP resent to your email. Please verify to complete registration.",
          },
          data: {
            email: email.toLowerCase(),
            otp,
          },
        });
      } catch (error) {
        console.error("[OTP-RESEND] Error resending OTP:", error);
        res.status(500).json({
          status: {
            remark: "otp_resend_failed",
            status: "error",
            message: "Failed to resend OTP. Please try again.",
          },
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

        // Validate session token
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
          return res.status(401).json({
            status: {
              remark: "unauthorized",
              status: "error",
              message: "Unauthorized. Token is required.",
            },
          });
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new Error("JWT_SECRET is not defined in environment variables");
        }

        // Verify and decode JWT token
        let decoded: { userId: string; exp?: number; iat?: number };
        try {
          decoded = jwt.verify(token, jwtSecret) as {
            userId: string;
            exp?: number;
            iat?: number;
          };
        } catch (jwtError: any) {
          if (jwtError.name === 'TokenExpiredError') {
            return res.status(401).json({
              status: {
                remark: "token_expired",
                status: "error",
                message: "Your session has expired. Please log in again.",
              },
            });
          }
          // For other JWT errors (invalid signature, malformed token, etc.)
          return res.status(401).json({
            status: {
              remark: "invalid_token",
              status: "error",
              message: "Invalid authentication token.",
            },
          });
        }

        const userId = decoded.userId;

        // Check JWT expiration
        const isExpired = Date.now() >= (decoded.exp || 0) * 1000;
        if (isExpired) {
          return res.status(401).json({
            status: {
              remark: "session_expired",
              status: "error",
              message: "Session has expired",
            },
          });
        }

        // Check database token status
        const tokenRecord = await db
          .select()
          .from(sessionTokens)
          .where(eq(sessionTokens.token, token))
          .limit(1);

        if (tokenRecord.length === 0 || tokenRecord[0].isTokenExpired) {
          return res.status(401).json({
            status: {
              remark: "invalid_session",
              status: "error",
              message: "Invalid or expired session",
            },
          });
        }

        console.log("[ONBOARDING] Processing onboarding for userId:", userId);

        const {
          height,
          weight,
          dateOfBirth,
          gender,
          nutritionGoal,
          targetCalories,
          selectedDays,
          daysPerWeek,
        } = req.body;

        const updatePayload: Record<string, unknown> = {};

        // Validate and set height
        if (height !== undefined) {
          const numHeight = Number(height);
          if (isNaN(numHeight) || numHeight <= 0) {
            return res.status(400).json({
              status: {
                remark: "validation_failed",
                status: "error",
                message: "Height must be a positive number.",
              },
              data: {
                invalidFields: ["height"],
              },
            });
          }
          updatePayload.height = numHeight;
        }

        // Validate and set weight
        if (weight !== undefined) {
          const numWeight = Number(weight);
          if (isNaN(numWeight) || numWeight <= 0) {
            return res.status(400).json({
              status: {
                remark: "validation_failed",
                status: "error",
                message: "Weight must be a positive number.",
              },
              data: {
                invalidFields: ["weight"],
              },
            });
          }
          updatePayload.weight = numWeight;
        }

        if (dateOfBirth !== undefined) {
          const parsedDate = new Date(dateOfBirth);
          if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({
              status: {
                remark: "validation_failed",
                status: "error",
                message: "Invalid dateOfBirth format.",
              },
              data: {
                invalidFields: ["dateOfBirth"],
              },
            });
          }
          updatePayload.dateOfBirth = parsedDate;
        }
        if (gender !== undefined) updatePayload.gender = gender;
        if (nutritionGoal !== undefined)
          updatePayload.nutritionGoal = nutritionGoal;
        if (targetCalories !== undefined)
          updatePayload.targetCalories = targetCalories;
        if (selectedDays !== undefined) {
          let parsedSelectedDays: number[] = [];

          if (Array.isArray(selectedDays)) {
            parsedSelectedDays = selectedDays;
          } else if (typeof selectedDays === "string") {
            // Try to parse as JSON array first
            try {
              const parsed = JSON.parse(selectedDays);
              if (Array.isArray(parsed)) {
                parsedSelectedDays = parsed;
              } else {
                // If not JSON array, try comma-separated string
                parsedSelectedDays = selectedDays
                  .split(",")
                  .map((s) => parseInt(s.trim()))
                  .filter((n) => !isNaN(n));
              }
            } catch {
              // If JSON parse fails, try comma-separated string
              parsedSelectedDays = selectedDays
                .split(",")
                .map((s) => parseInt(s.trim()))
                .filter((n) => !isNaN(n));
            }
          }

          if (parsedSelectedDays.length > 0) {
            // Convert numbers to strings since database expects text array
            updatePayload.selectedDates = parsedSelectedDays.map((day) =>
              day.toString()
            );
          } else {
            return res.status(400).json({
              status: {
                remark: "validation_failed",
                status: "error",
                message:
                  "selectedDays must be an array of numbers or a valid string representation.",
              },
              data: {
                invalidFields: ["selectedDays"],
                receivedValue: selectedDays,
                receivedType: typeof selectedDays,
              },
            });
          }
        }
        if (daysPerWeek !== undefined) updatePayload.daysPerWeek = daysPerWeek;

        // Update user by userId from authenticated session token
        const updatedUsers = await db
          .update(users)
          .set(updatePayload)
          .where(eq(users.id, userId))
          .returning({ id: users.id });

        if (updatedUsers.length === 0) {
          return res.status(404).json({
            status: {
              remark: "user_not_found",
              status: "error",
              message: "User not found.",
            },
            data: {
              userId,
              updatedUsers,
            },
          });
        }

        console.log("[ONBOARDING] User onboarding data updated successfully", {
          userId,
          fieldsUpdated: Object.keys(updatePayload),
        });

        res.status(200).json({
          status: {
            remark: "onboarding_completed",
            status: "success",
            message: "Onboarding completed successfully",
          },
          data: {
            userId,
            fieldsUpdated: Object.keys(updatePayload),
          },
        });
      } catch (error) {
        console.error("[ONBOARDING] Error completing onboarding:", error);
        res.status(500).json({
          status: {
            remark: "onboarding_failed",
            status: "error",
            message: "Failed to complete onboarding. Please try again.",
          },
        });
      }
    }
  );
};

// ===========================================
// USER ROUTES
// ==========================================

export const userRoutes = (app: Express) => {
  // ==========================================
  // LOGOUT ROUTE
  // ==========================================
  app.get("/api/logout", async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({
          status: {
            remark: "unauthorized",
            status: "error",
            message: "Unauthorized",
          },
        });
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
        return res.status(404).json({
          status: {
            remark: "session_not_found",
            status: "error",
            message: "Session not found",
          },
        });
      }

      console.log("[LOGOUT] Token successfully expired in database");
      res.status(200).json({
        status: {
          remark: "logout_successful",
          status: "success",
          message: "Logout successful",
        },
      });
    } catch (error) {
      console.error("[LOGOUT] Error logging out:", error);
      res.status(500).json({
        status: {
          remark: "logout_failed",
          status: "error",
          message: "Failed to log out. Please try again.",
        },
      });
    }
  });

  // ===========================================
  // DELETE USER ROUTE
  // ===========================================
  app.delete("/api/user", async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({
          status: {
            remark: "unauthorized",
            status: "error",
            message: "Unauthorized",
          },
        });
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET is not defined in environment variables");
      }

      let decoded: { userId: string; exp?: number; iat?: number };
      try {
        decoded = jwt.verify(token, jwtSecret) as {
          userId: string;
          exp?: number;
          iat?: number;
        };
      } catch (jwtError: any) {
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({
            status: {
              remark: "token_expired",
              status: "error",
              message: "Your session has expired. Please log in again.",
            },
          });
        }
        // For other JWT errors (invalid signature, malformed token, etc.)
        return res.status(401).json({
          status: {
            remark: "invalid_token",
            status: "error",
            message: "Invalid authentication token.",
          },
        });
      }

      const userId = decoded.userId;

      // Check if token is expired
      const isExpired = Date.now() >= (decoded.exp || 0) * 1000;
      if (isExpired) {
        return res.status(401).json({
          status: {
            remark: "auth_token_expired",
            status: "error",
            message: "Auth Token has expired",
          },
        });
      }

      // Check if token exists and is not already expired in database
      const tokenRecord = await db
        .select()
        .from(sessionTokens)
        .where(eq(sessionTokens.token, token))
        .limit(1);

      if (tokenRecord.length === 0) {
        return res.status(401).json({
          status: {
            remark: "invalid_session",
            status: "error",
            message: "Invalid session",
          },
        });
      }

      const dbToken = tokenRecord[0];
      if (dbToken.isTokenExpired) {
        return res.status(401).json({
          status: {
            remark: "auth_token_expired",
            status: "error",
            message: "Auth Token has expired",
          },
        });
      }

      // Check if user exists and is not already deleted
      const userRecord = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (userRecord.length === 0) {
        return res.status(404).json({
          status: {
            remark: "user_not_found",
            status: "error",
            message: "User not found",
          },
        });
      }

      const user = userRecord[0];
      if (user.verificationStatus === "deleted") {
        return res.status(400).json({
          status: {
            remark: "user_already_deleted",
            status: "error",
            message: "User already deleted",
          },
        });
      }

      // Start transaction-like operations (expire all user sessions)
      await db
        .update(sessionTokens)
        .set({
          isTokenExpired: 1,
          updatedAt: new Date(),
        })
        .where(eq(sessionTokens.userId, userId));

      // Mark user account as deleted and email to userid_delete_email ( userid + delete as prefix )
      const updateResult = await db
        .update(users)
        .set({
          verificationStatus: "deleted",
          email: `${userId}_delete_${user.email}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      if (updateResult.rowCount === 0) {
        console.log("[DELETE-USER] Failed to mark user as deleted");
        return res.status(500).json({
          status: {
            remark: "delete_failed",
            status: "error",
            message: "Failed to delete user",
          },
        });
      }

      console.log(
        "[DELETE-USER] User marked as deleted and all sessions expired"
      );
      res.status(200).json({
        status: {
          remark: "user_deleted",
          status: "success",
          message: "User deleted successfully",
        },
        data: {
          updateResult,
        },
      });
    } catch (error) {
      console.error("[DELETE-USER] Error deleting user:", error);
      res.status(500).json({
        status: {
          remark: "delete_user_failed",
          status: "error",
          message: "Failed to delete user.",
        },
      });
    }
  });

  // ===========================================
  // GET USER
  // ===========================================
  app.get("/api/user", async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({
          status: {
            remark: "unauthorized",
            status: "error",
            message: "Unauthorized",
          },
        });
      }
      console.log("[USER] Received user request");

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error("JWT_SECRET is not defined in environment variables");
      }

      let decoded: { userId: string; exp?: number; iat?: number };
      try {
        decoded = jwt.verify(token, jwtSecret) as {
          userId: string;
          exp?: number;
          iat?: number;
        };
      } catch (jwtError: any) {
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({
            status: {
              remark: "token_expired",
              status: "error",
              message: "Your session has expired. Please log in again.",
            },
          });
        }
        // For other JWT errors (invalid signature, malformed token, etc.)
        return res.status(401).json({
          status: {
            remark: "invalid_token",
            status: "error",
            message: "Invalid authentication token.",
          },
        });
      }

      const userId = decoded.userId;
      console.log(`[USER] Decoded userId: ${userId}`);

      // Check JWT expiration
      const isExpired = Date.now() >= (decoded.exp || 0) * 1000;
      if (isExpired) {
        return res.status(401).json({
          status: {
            remark: "session_expired",
            status: "error",
            message: "Session has expired",
          },
        });
      }

      // Check database token status
      const tokenRecord = await db
        .select()
        .from(sessionTokens)
        .where(eq(sessionTokens.token, token))
        .limit(1);

      if (tokenRecord.length === 0 || tokenRecord[0].isTokenExpired) {
        return res.status(401).json({
          status: {
            remark: "invalid_session",
            status: "error",
            message: "Invalid session",
          },
        });
      }

      // Fetch user data from database
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length === 0) {
        return res.status(404).json({
          status: {
            remark: "user_not_found",
            status: "error",
            message: "User not found",
          },
        });
      }

      const dbUser = user[0];
      console.log(`[USER] User found: ${dbUser.id}`);

      // Return safe user data only (exclude sensitive information)
      const userData = {
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
        status: {
          remark: "user_retrieved",
          status: "success",
          message: "User retrieved successfully",
        },
        data: {
          user: userData,
        },
      });
    } catch (error) {
      console.error("[USER] Error fetching user:", error);
      res.status(500).json({
        status: {
          remark: "user_fetch_failed",
          status: "error",
          message: "Failed to fetch user.",
        },
      });
    }
  });

  // ============================================
  // PUT USER - UPDATE USER DETAILS
  // ============================================
  app.put("/api/user", upload.none(), async (req: Request, res: Response) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({
          status: {
            remark: "unauthorized",
            status: "error",
            message: "Unauthorized",
          },
        });
      }
      console.log("[USER-UPDATE] Received user update request");
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
      console.log(`[USER-UPDATE] Decoded userId: ${userId}`);
      // Check JWT expiration
      const isExpired = Date.now() >= (decoded.exp || 0) * 1000;
      if (isExpired) {
        return res.status(401).json({
          status: {
            remark: "session_expired",
            status: "error",
            message: "Session has expired",
          },
        });
      }
      // Check database token status
      const tokenRecord = await db
        .select()
        .from(sessionTokens)
        .where(eq(sessionTokens.token, token))
        .limit(1);
      if (tokenRecord.length === 0 || tokenRecord[0].isTokenExpired) {
        return res.status(401).json({
          status: {
            remark: "invalid_session",
            status: "error",
            message: "Invalid session",
          },
        });
      }
      console.log("[USER-UPDATE] Valid session confirmed");
      const { firstName, lastName, profile_image_url } = req.body;

      
    

    } catch (error) {
      console.error("[USER-UPDATE] Error updating user:", error);
      res.status(500).json({
        status: {
          remark: "user_update_failed",
          status: "error",
          message: "Failed to update user.",
        },
      });
    }
  });

  // ==========================================
  // FORGOT PASSWORD
  // =========================================
  app.post(
    "/api/request-otp",
    upload.none(),
    async (req: Request, res: Response) => {
      try {
        const { email } = req.body;

        console.log(`Email ${email} is required`);
        // Validate required fields
        if (!email) {
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Email is required",
            },
          });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Invalid email format",
            },
          });
        }

        // Check if user exists
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);

        if (existingUser.length === 0) {
          return res.status(404).json({
            status: {
              remark: "user_not_found",
              status: "error",
              message: "User not found with the provided email.",
            },
          });
        }

        // Generate a 4-digit password reset OTP
        const resetToken = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

        // Store the reset token in the email_otp table (upsert - replace any existing OTP for this email)
        await db
          .insert(emailOtp)
          .values({
            email: email.toLowerCase(),
            otp: resetToken,
            expiresAt,
          })
          .onConflictDoUpdate({
            target: emailOtp.email,
            set: {
              otp: resetToken,
              expiresAt,
              isUsed: 0, // Reset to unused
              createdAt: new Date(),
            },
          });

        // Send password reset email
        await sendEmail({
          to: email,
          subject: "Password Reset",
          text: `Your Password Reset Token is: ${resetToken}. It will expire in 1 hour.`,
          html: `<b>Your Password Reset Token is: ${resetToken}</b><br>It will expire in 1 hour.`,
        });

        console.log(
          `[FORGOT-PASSWORD] Password reset token sent to: ${email.toLowerCase()}`
        );

        res.status(200).json({
          status: {
            remark: "password_reset_email_sent",
            status: "success",
            message: "Password reset email sent successfully.",
          },
          data: {
            email: email.toLowerCase(),
            OTP: resetToken,
            expiresAt: expiresAt.getTime(),
          },
        });
      } catch (error) {
        console.error("[FORGOT-PASSWORD] Error processing request:", error);
        res.status(500).json({
          status: {
            remark: "forgot_password_failed",
            status: "error",
            message: "Failed to process forgot password request.",
          },
        });
      }
    }
  );

  // ===========================================
  // VERIFY OTP FOR PASSWORD RESET
  // ==========================================

  app.post(
    "/api/verify-reset-otp",
    upload.none(),
    async (req: Request, res: Response) => {
      try {
        const { email, otp } = req.body;
        console.log("[VERIFY-RESET-OTP] Received OTP verification request");

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new Error("JWT_SECRET is not defined in environment variables");
        }

        // Validate required fields
        if (!email || !otp) {
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Email and OTP are required.",
            },
          });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Invalid email format.",
            },
          });
        }

        // Fetch the password reset token record
        const tokenRecord = await db
          .select()
          .from(emailOtp)
          .where(
            and(
              eq(emailOtp.email, email.toLowerCase()),
              eq(emailOtp.otp, otp),
              eq(emailOtp.isUsed, 0)
            )
          )
          .limit(1);

        if (tokenRecord.length === 0) {
          return res.status(404).json({
            status: {
              remark: "token_not_found",
              status: "error",
              message: "Invalid or expired reset token.",
            },
          });
        }

        const resetToken = tokenRecord[0];

        // Check if token is expired
        if (new Date() > new Date(resetToken.expiresAt)) {
          return res.status(400).json({
            status: {
              remark: "token_expired",
              status: "error",
              message: "Reset token has expired. Please request a new one.",
            },
          });
        }

        // Verify that the user exists with this email
        const userRecord = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);

        if (userRecord.length === 0) {
          return res.status(404).json({
            status: {
              remark: "user_not_found",
              status: "error",
              message: "User not found.",
            },
          });
        }

        // create token and send to user
        console.log("[VERIFY-RESET-OTP] OTP verified successfully");

        // Create password reset token and send to user
        const passwordResetToken = jwt.sign({ email: email.toLowerCase() }, jwtSecret, {
          expiresIn: "15m", // Token valid for 15 minutes
        });

        // Token is valid, proceed with password reset permission
        res.status(200).json({
          status: {
            remark: "reset_token_verified",
            status: "success",
            message:
              "OTP verified successfully. You can now set a new password.",
          },
          data: {
            email: email.toLowerCase(),
            tokenValid: true,
            resetToken: passwordResetToken,
          },
        });
      } catch (error) {
        console.error("[VERIFY-RESET-OTP] Error processing request:", error);
        res.status(500).json({
          status: {
            remark: "verify_reset_token_failed",
            status: "error",
            message: "Failed to process OTP verification request.",
          },
        });
      }
    }
  );

  // ==========================================
  // RESET PASSWORD
  // =========================================

  app.put(
    "/api/reset-password",
    upload.none(),
    async (req: Request, res: Response) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Reset token is required in Authorization header.",
            },
          });
        }

        const token = authHeader.substring(7);
        const { newPassword } = req.body;
        console.log("[RESET-PASSWORD] Received password reset request");

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new Error("JWT_SECRET is not defined in environment variables");
        }

        // Validate required fields
        if (!newPassword) {
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "New password is required.",
            },
          });
        }

        // Validate password strength (minimum 6 characters)
        if (newPassword.length < 6) {
          return res.status(400).json({
            status: {
              remark: "validation_failed",
              status: "error",
              message: "Password must be at least 6 characters long.",
            },
          });
        }

        // Verify the JWT token
        let decoded: { email: string; exp?: number; iat?: number };
        try {
          decoded = jwt.verify(token, jwtSecret) as { email: string; exp?: number; iat?: number };
        } catch (jwtError: any) {
          if (jwtError.name === 'TokenExpiredError') {
            return res.status(401).json({
              status: {
                remark: "token_expired",
                status: "error",
                message: "Reset token has expired. Please request a new one.",
              },
            });
          }
          return res.status(401).json({
            status: {
              remark: "invalid_token",
              status: "error",
              message: "Invalid reset token.",
            },
          });
        }

        const email = decoded.email;

        // Fetch the password reset OTP record for this email
        const tokenRecord = await db
          .select()
          .from(emailOtp)
          .where(and(eq(emailOtp.email, email), eq(emailOtp.isUsed, 0)))
          .limit(1);

        if (tokenRecord.length === 0) {
          return res.status(404).json({
            status: {
              remark: "token_not_found",
              status: "error",
              message: "No valid reset token found for this email.",
            },
          });
        }

        const resetToken = tokenRecord[0];

        // Check if OTP is expired (though JWT is also checked)
        if (new Date() > new Date(resetToken.expiresAt)) {
          return res.status(400).json({
            status: {
              remark: "token_expired",
              status: "error",
              message: "Reset token has expired. Please request a new one.",
            },
          });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update user's password in the database
        const updateResult = await db
          .update(users)
          .set({
            password: hashedPassword,
            updatedAt: new Date(),
          })
          .where(eq(users.email, resetToken.email));

        if (updateResult.rowCount === 0) {
          return res.status(500).json({
            status: {
              remark: "password_update_failed",
              status: "error",
              message: "Failed to update password. Please try again.",
            },
          });
        }

        // Mark the reset token as used
        await db
          .update(emailOtp)
          .set({
            isUsed: 1,
          })
          .where(eq(emailOtp.id, resetToken.id));

        console.log(
          `[RESET-PASSWORD] Password reset successfully for email: ${resetToken.email}`
        );

        // Send success response
        return res.status(200).json({
          status: {
            remark: "password_reset_successful",
            status: "success",
            message: "Password has been reset successfully.",
          },
        });
      } catch (error) {
        console.error("[RESET-PASSWORD] Error processing request:", error);
        res.status(500).json({
          status: {
            remark: "reset_password_failed",
            status: "error",
            message: "Failed to process password reset request.",
          },
        });
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

      let decoded: { userId: string; exp?: number; iat?: number };
      try {
        decoded = jwt.verify(token, jwtSecret) as {
          userId: string;
          exp?: number;
          iat?: number;
        };
      } catch (jwtError: any) {
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({
            status: {
              remark: "token_expired",
              status: "error",
              message: "Your session has expired. Please log in again.",
            },
          });
        }
        // For other JWT errors (invalid signature, malformed token, etc.)
        return res.status(401).json({
          status: {
            remark: "invalid_token",
            status: "error",
            message: "Invalid authentication token.",
          },
        });
      }

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
