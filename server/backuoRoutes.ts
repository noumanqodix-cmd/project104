// ==============================================================
// SCRATCH
// ==============================================================

// Registers authentication routes (currently register + verify OTP flow)
// export const registerAppRoutes = (app: Express) => {
//   // POST /api/auth/register - initiate user registration with OTP
//   // Requires: firstName, lastName, email, password
//   app.post(
//     "/api/auth/register",
//     upload.none(),
//     async (req: Request, res: Response) => {
//       try {
//         const { firstName, lastName, email, password } = req.body;

//         // Validate required fields
//         const missingFields: string[] = [];
//         if (!firstName) missingFields.push("firstName");
//         if (!lastName) missingFields.push("lastName");
//         if (!email) missingFields.push("email");
//         if (!password) missingFields.push("password");

//         if (missingFields.length > 0) {
//           console.log("[REGISTER] Validation failed: Missing required fields");

//           return res.status(400).json({
//             status: {
//               remark: "validation_failed",
//               status: "error",
//               message: "Please fill all required fields",
//             },
//             data: {
//               receivedFields: req.body,
//               missingFields,
//             },
//           });
//         }

//         console.log("[REGISTER] Validation passed: Required fields present");

//         // =================== Validate email format ================================
//         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//         if (!emailRegex.test(email)) {
//           console.log("[REGISTER] Validation failed: Invalid email format");
//           return res.status(400).json({
//             status: {
//               remark: "validation_failed",
//               status: "error",
//               message: "Invalid email format",
//             },
//             data: {
//               email: email,
//               invalidFormat: ["email"],
//             },
//           });
//         }

//         console.log("[REGISTER] Validation passed: Email format is valid");

//         // Validate password strength (minimum 6 characters)
//         if (password.length < 6) {
//           console.log("[REGISTER] Validation failed: Password too short");
//           return res.status(400).json({
//             status: {
//               remark: "validation_failed",
//               status: "error",
//               message: "Password must be at least 6 characters long",
//             },
//             data: {
//               password: password,
//               invalidFields: ["password"],
//             },
//           });
//         }
//         console.log(
//           "[REGISTER] Validation passed: Password length is sufficient"
//         );

//         // =================== Check if user already exists ================================
//         console.log(
//           `[REGISTER] Checking for existing user with email: ${email.toLowerCase()}`
//         );
//         const existingUser = await db
//           .select()
//           .from(users)
//           .where(eq(users.email, email.toLowerCase()))
//           .limit(1);

//         if (existingUser.length > 0) {
//           const user = existingUser[0];
//           if (
//             user.verificationStatus === "verified" ||
//             user.verificationStatus === "pending"
//           ) {
//             console.log(
//               `[REGISTER] Conflict: Existing user status is ${user.verificationStatus}`
//             );
//             const status = user.verificationStatus as VerificationStatus;
//             const message =
//               VERIFICATION_STATUS_MESSAGES[status] ||
//               "verificationStatus is not detectable.";
//             return res.status(409).json({
//               status: {
//                 remark: "user_already_exists",
//                 status: "error",
//                 message,
//               },
//               data: {
//                 email: email.toLowerCase(),
//                 verificationStatus: user.verificationStatus,
//               },
//             });
//           }
//           // If pending, continue to resend OTP
//           console.log(
//             "[REGISTER] User exists with pending status, resending OTP"
//           );
//         } else {
//           // save user to the users table with status pending
//           await db.insert(users).values({
//             firstName,
//             lastName,
//             email: email.toLowerCase(),
//             password: await bcrypt.hash(password, SALT_ROUNDS),
//             verificationStatus: "pending",
//           });

//           // Set user verification status to pending
//           console.log(
//             "[REGISTER] User record created with pending verification"
//           );
//         }

//         // ======================== Generate 4-digit OTP ==========================

//         const otp = Math.floor(1000 + Math.random() * 9000).toString();
//         console.log(`[REGISTER] Generated OTP: ${otp}`);

//         // Set OTP expiry (10 minutes from now)
//         const expiresAt = new Date();
//         expiresAt.setMinutes(expiresAt.getMinutes() + 10);
//         console.log(`[REGISTER] OTP expires at: ${expiresAt.toISOString()}`);

//         // Upsert OTP in database
//         console.log(`[REGISTER] Upserting OTP for ${email.toLowerCase()}`);
//         await db
//           .insert(emailOtp)
//           .values({
//             email: email.toLowerCase(),
//             otp,
//             expiresAt,
//           })
//           .onConflictDoUpdate({
//             target: emailOtp.email,
//             set: {
//               otp,
//               expiresAt,
//               isUsed: 0,
//               createdAt: new Date(),
//             },
//           });
//         console.log("[REGISTER] OTP stored successfully in the database");

//         // ========================== Send OTP email =============================

//         try {
//           await sendEmail({
//             to: email.toLowerCase(),
//             subject: "Your OTP Code ✔",
//             text: `Your OTP code is: ${otp}`,
//             html: `<b>Your OTP code is: ${otp}</b>`,
//           });
//         } catch (emailError) {
//           console.error("[REGISTER] Failed to send OTP email:", emailError);
//           return res.status(500).json({
//             status: {
//               remark: "otp_send_failed",
//               status: "error",
//               message: "Failed to send OTP to email. Please try again.",
//             },
//           });
//         }

//         console.log("[REGISTER] Sending success response");

//         res.status(200).json({
//           status: {
//             remark: "otp_sent",
//             status: "success",
//             message:
//               "OTP sent to your email. Please verify to complete registration.",
//           },
//           data: {
//             email: email.toLowerCase(),
//             otp,
//           },
//         });
//       } catch (error) {
//         console.error("[REGISTER] Registration initiation error:", error);
//         res.status(500).json({
//           status: {
//             remark: "registration_failed",
//             status: "error",
//             message: "Failed to initiate registration. Please try again.",
//           },
//         });
//       }
//     }
//   );

//   // POST /api/auth/verify-otp - Verify OTP and complete registration
//   app.post(
//     "/api/auth/verify-otp",
//     upload.none(),
//     async (req: Request, res: Response) => {
//       try {
//         const { email, otp } = req.body;

//         console.log(`Email ${email} and OTP ${otp} are required`);

//         // Validate required fields
//         if (!email) {
//           return res.status(400).json({
//             status: {
//               remark: "validation_failed",
//               status: "error",
//               message: "Email is required",
//             },
//             data: {
//               missingFields: ["email"],
//             },
//           });
//         } else if (!otp) {
//           return res.status(400).json({
//             status: {
//               remark: "validation_failed",
//               status: "error",
//               message: "OTP is required",
//             },
//             data: {
//               missingFields: ["otp"],
//             },
//           });
//         }

//         // Validate email format
//         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//         if (!emailRegex.test(email)) {
//           return res.status(400).json({
//             status: {
//               remark: "validation_failed",
//               status: "error",
//               message: "Invalid email format",
//             },
//             data: {
//               invalidFormat: ["email"],
//             },
//           });
//         }

//         // Check if user already exists
//         const existingUser = await db
//           .select()
//           .from(users)
//           .where(eq(users.email, email.toLowerCase()))
//           .limit(1);

//         if (existingUser.length === 0) {
//           return res.status(400).json({
//             status: {
//               remark: "user_not_found",
//               status: "error",
//               message: "User not found. Please register first.",
//             },
//             data: {
//               email: email.toLowerCase(),
//             },
//           });
//         }

//         const user = existingUser[0];
//         if (user.verificationStatus !== "pending") {
//           const status = user.verificationStatus as VerificationStatus;
//           const message =
//             VERIFICATION_STATUS_MESSAGES[status] ||
//             "Unknown verification status.";
//           return res.status(400).json({
//             status: {
//               remark: "invalid_verification_status",
//               status: "error",
//               message,
//             },
//             data: {
//               email: email.toLowerCase(),
//               verificationStatus: user.verificationStatus,
//             },
//           });
//         }

//         // Find the OTP record
//         const otpRecord = await db
//           .select()
//           .from(emailOtp)
//           .where(eq(emailOtp.email, email.toLowerCase()))
//           .limit(1);

//         if (otpRecord.length === 0) {
//           return res.status(400).json({
//             status: {
//               remark: "otp_not_found",
//               status: "error",
//               message: "No OTP found for this email. Please request a new one.",
//             },
//             data: {
//               email: email.toLowerCase(),
//             },
//           });
//         }

//         const otpData = otpRecord[0];

//         // Check if OTP is expired (10 minutes)
//         if (new Date() > new Date(otpData.expiresAt)) {
//           return res.status(400).json({
//             status: {
//               remark: "otp_expired",
//               status: "error",
//               message: "OTP has expired. Please request a new one.",
//             },
//             data: {
//               email: email.toLowerCase(),
//             },
//           });
//         }

//         // Check if OTP has already been used
//         if (otpData.isUsed) {
//           return res.status(400).json({
//             status: {
//               remark: "otp_used",
//               status: "error",
//               message: "OTP has already been used. Please request a new one.",
//             },
//             data: {
//               email: email.toLowerCase(),
//             },
//           });
//         }

//         // convert otp to Number
//         const numericOtp = Number(otp);
//         const numberDataOTP = Number(otpData.otp);

//         // Verify OTP
//         if (numberDataOTP !== numericOtp) {
//           return res.status(400).json({
//             status: {
//               remark: "invalid_otp",
//               status: "error",
//               message: "Invalid OTP. Please check and try again.",
//             },
//             data: {
//               email: email.toLowerCase(),
//             },
//           });
//         }

//         // update the user verification status to verified
//         const updatedUsers = await db
//           .update(users)
//           .set({ verificationStatus: "verified" })
//           .where(eq(users.email, email.toLowerCase()))
//           .returning();
//         console.log(
//           `[OTP-VERIFY] Updated user verification status for ${email.toLowerCase()}`
//         );

//         if (updatedUsers.length === 0) {
//           throw new Error("Failed to update user verification status");
//         }

//         // Mark OTP as used
//         await db
//           .update(emailOtp)
//           .set({ isUsed: 1 })
//           .where(eq(emailOtp.id, otpData.id));

//         // Generate JWT token and session for the newly verified user
//         const jwtSecret = process.env.JWT_SECRET;
//         if (!jwtSecret) {
//           throw new Error("JWT_SECRET is not defined in environment variables");
//         }
//         const token = jwt.sign({ userId: updatedUsers[0].id }, jwtSecret, {
//           expiresIn: "1d",
//         });
//         console.log(
//           `[OTP-VERIFY] JWT token generated for user: ${updatedUsers[0].id}`
//         );

//         // Calculate expiration date (1 day from now)
//         const expiresAt = new Date();
//         expiresAt.setDate(expiresAt.getDate() + 1);

//         // Store/Update token in session_tokens table (upsert - update existing or create new)
//         await db
//           .insert(sessionTokens)
//           .values({
//             token,
//             isTokenExpired: 0, // false - new active token
//             expiresAt,
//             userId: updatedUsers[0].id,
//             email: updatedUsers[0].email!,
//           })
//           .onConflictDoUpdate({
//             target: sessionTokens.userId, // Conflict on userId (one session per user)
//             set: {
//               token, // Update with new token
//               isTokenExpired: 0, // Reset to active
//               expiresAt, // Update expiration
//               email: updatedUsers[0].email!, // Update email if changed
//               updatedAt: new Date(), // Update timestamp
//             },
//           });
//         console.log(
//           `[OTP-VERIFY] Token stored/updated in session_tokens table for user: ${updatedUsers[0].id}`
//         );

//         // Remove password from response
//         const userData = updatedUsers[0];
//         const { password: _, ...userWithoutPassword } = userData;

//         // Export only specific fields
//         const exportedUser = {
//           id: userWithoutPassword.id,
//           email: userWithoutPassword.email,
//           firstName: userWithoutPassword.firstName,
//           lastName: userWithoutPassword.lastName,
//         };

//         console.log(exportedUser, "userData");

//         res.status(201).json({
//           status: {
//             remark: "registration_completed",
//             status: "success",
//             message: "Registration completed successfully",
//           },
//           data: {
//             user: exportedUser,
//             token,
//             session: {
//               expiresAt: expiresAt.toISOString(),
//               isTokenExpired: false,
//             },
//           },
//         });
//       } catch (error) {
//         console.error("OTP verification error:", error);
//         res.status(500).json({
//           status: {
//             remark: "verification_failed",
//             status: "error",
//             message: "Failed to verify OTP. Please try again.",
//           },
//         });
//       }
//     }
//   );
// };

// ===========================================
// CUSTOM LOGIN ROUTES
// ============================================
// description : login user and create token for session management and
// session in database for management of user login sessions

// export const loginAppRoutes = (app: Express) => {
//   // POST /api/auth/login - Authenticate user with email and password
//   app.post(
//     "/api/auth/login",
//     upload.none(),
//     async (req: Request, res: Response) => {
//       try {
//         console.log("[LOGIN] Received login request");
//         const { email, password } = req.body;
//         console.log("[LOGIN] Body params:", {
//           email: email ? "present" : "missing",
//           password: password ? "present" : "missing",
//         });

//         // Validate required fields
//         if (!email || !password) {
//           console.log("[LOGIN] Validation failed: Missing required fields");
//           return res.status(400).json({
//             status: {
//               remark: "validation_failed",
//               status: "error",
//               message: "Email and password are required.",
//             },
//             data: {
//               missingFields: ["email", "password"].filter(field => !req.body[field]),
//             },
//           });
//         }

//         console.log("[LOGIN] Validation passed: Required fields present");

//         // Validate email format
//         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//         if (!emailRegex.test(email)) {
//           console.log("[LOGIN] Validation failed: Invalid email format");
//           return res.status(400).json({
//             status: {
//               remark: "validation_failed",
//               status: "error",
//               message: "Invalid email format.",
//             },
//             data: {
//               invalidFormat: ["email"],
//             },
//           });
//         }

//         console.log("[LOGIN] Validation passed: Email format is valid");

//         // Find user by email
//         console.log(
//           `[LOGIN] Looking up user with email: ${email.toLowerCase()}`
//         );

//         const existingUser = await db
//           .select()
//           .from(users)
//           .where(eq(users.email, email.toLowerCase()))
//           .limit(1);

//         if (existingUser.length === 0) {
//           console.log(
//             `[LOGIN] User not found with email: ${email.toLowerCase()}`
//           );
//           return res.status(401).json({
//             status: {
//               remark: "invalid_credentials",
//               status: "error",
//               message: "Invalid email or password.",
//             },
//           });
//         }
//         console.log(`[LOGIN] User found, verifying password`);

//         const user = existingUser[0];

//         // Verify password
//         if (!user.password) {
//           console.log(`[LOGIN] User password is null for user: ${user.id}`);
//           return res.status(401).json({
//             status: {
//               remark: "invalid_credentials",
//               status: "error",
//               message: "Invalid email or password.",
//             },
//           });
//         }
//         const passwordMatch = await bcrypt.compare(password, user.password);
//         if (!passwordMatch) {
//           console.log(
//             `[LOGIN] Password verification failed for user: ${user.id}`
//           );
//           return res.status(401).json({
//             status: {
//               remark: "invalid_credentials",
//               status: "error",
//               message: "Invalid email or password.",
//             },
//           });
//         }

//         console.log(
//           `[LOGIN] Password verification successful for user: ${user.id}`
//         );

//         // Generate JWT token and session
//         const jwtSecret = process.env.JWT_SECRET;
//         if (!jwtSecret) {
//           throw new Error("JWT_SECRET is not defined in environment variables");
//         }
//         const token = jwt.sign({ userId: user.id }, jwtSecret, {
//           expiresIn: "1d",
//         });
//         console.log(`[LOGIN] JWT token generated for user: ${user.id}`);

//         // Calculate expiration date (1 day from now)
//         const expiresAt = new Date();
//         expiresAt.setDate(expiresAt.getDate() + 1);

//         // Store/Update token in session_tokens table (upsert - update existing or create new)
//         await db
//           .insert(sessionTokens)
//           .values({
//             token,
//             isTokenExpired: 0, // false - new active token
//             expiresAt,
//             userId: user.id,
//             email: user.email!,
//           })
//           .onConflictDoUpdate({
//             target: sessionTokens.userId, // Conflict on userId (one session per user)
//             set: {
//               token, // Update with new token
//               isTokenExpired: 0, // Reset to active
//               expiresAt, // Update expiration
//               email: user.email!, // Update email if changed
//               updatedAt: new Date(), // Update timestamp
//             },
//           });
//         console.log(
//           `[LOGIN] Token stored/updated in session_tokens table for user: ${user.id}`
//         );

//         res.status(200).json({
//           status: {
//             remark: "login_successful",
//             status: "success",
//             message: "Login successful",
//           },
//           data: {
//             token,
//             session: {
//               expiresAt: expiresAt.toISOString(),
//               isTokenExpired: false,
//             },
//           },
//         });
//       } catch (error) {
//         console.error("[LOGIN] Error logging in:", error);
//         res.status(500).json({
//           status: {
//             remark: "login_failed",
//             status: "error",
//             message: "Failed to log in. Please try again.",
//           },
//         });
//       }
//     }
//   );
// };