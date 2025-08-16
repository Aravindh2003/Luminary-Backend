import { prisma } from "../config/database.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../middleware/auth.js";
import emailService from "../services/emailService.js";
import brevoEmailService from "../services/brevoEmailService.js";
// import fileService from '../services/fileService.js'; // Temporarily disabled
import crypto from "crypto";
import bcrypt from "bcryptjs";
import logger from "../utils/logger.js";

// Parent Registration - matches frontend RegisterParent workflow with email verification
export const registerParent = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: { email, role: "PARENT" },
  });

  // Also check other roles for diagnostics
  const existingAnyRoles = await prisma.user.findMany({
    where: { email },
    select: { role: true },
  });
  if (existingAnyRoles.length > 0) {
    const roles = existingAnyRoles.map((r) => r.role).join(", ");
    logger.info(`[RegisterParent] Email already present for roles: ${roles}`);
  }

  if (existingUser) {
    throw new ApiError(409, "User with this email already exists");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user (not verified initially)
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: "PARENT",
        isVerified: false, // Will be verified via email code
        emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
        preferences: {},
      },
    });
  } catch (e) {
    if (
      e?.code === "P2002" &&
      Array.isArray(e?.meta?.target) &&
      e.meta.target.includes("email")
    ) {
      const roles = (
        await prisma.user.findMany({ where: { email }, select: { role: true } })
      )
        .map((r) => r.role)
        .join(", ");
      logger.error(
        "[RegisterParent] Duplicate email constraint hit. Existing roles:",
        { email, roles }
      );
      throw new ApiError(409, `Email already used by role(s): ${roles}`);
    }
    throw e;
  }

  // Send email verification code using Brevo
  try {
    await brevoEmailService.sendVerificationCode(email, firstName, "parent");
    logger.info(`Email verification code sent to parent: ${user.email}`);
  } catch (error) {
    logger.error("Failed to send verification email:", error);
    // Don't fail registration if email fails, user can request code later
  }

  res.status(201).json(
    new ApiResponse(
      201,
      {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isVerified: user.isVerified,
        },
        requiresVerification: true,
      },
      "Parent registered successfully! Please check your email for verification code."
    )
  );
});

// Coach Registration - matches exact frontend RegisterCoach workflow with email verification
export const registerCoach = asyncHandler(async (req, res) => {
  const {
    email,
    password,
    firstName,
    lastName,
    phone,
    domain,
    experience, // This is experienceDescription from frontend
    address,
    languages, // Array of languages from frontend (sent as JSON string)
  } = req.body;

  // Validate required fields exactly as frontend does
  if (
    !email ||
    !password ||
    !firstName ||
    !lastName ||
    !phone ||
    !domain ||
    !experience ||
    !address
  ) {
    throw new ApiError(400, "All required fields must be provided");
  }

  // Parse languages from JSON string if needed
  let parsedLanguages = languages;
  if (typeof languages === "string") {
    try {
      parsedLanguages = JSON.parse(languages);
    } catch (error) {
      throw new ApiError(400, "Invalid languages format");
    }
  }

  if (
    !parsedLanguages ||
    !Array.isArray(parsedLanguages) ||
    parsedLanguages.length === 0
  ) {
    throw new ApiError(400, "At least one language is required");
  }

  // Check if user already exists
  logger.info(
    `[RegisterCoach] Checking existing user for email=${email}, role=COACH`
  );
  const existingUser = await prisma.user.findFirst({
    where: { email, role: "COACH" },
  });
  // Also log other roles present for this email for diagnostics
  const existingRoles = await prisma.user.findMany({
    where: { email },
    select: { role: true },
  });
  if (existingRoles.length > 0) {
    logger.info(
      `[RegisterCoach] Existing roles for email ${email}: ${existingRoles.map((r) => r.role).join(", ")}`
    );
  }

  if (existingUser) {
    throw new ApiError(409, "User with this email already exists");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Handle file uploads if present
  let licenseFileUrl = null;
  let resumeFileUrl = null;
  let introVideoUrl = null;

  if (req.files) {
    try {
      // Mock file upload URLs for now (since file service is disabled)
      if (req.files.license) {
        licenseFileUrl = `http://localhost:5000/uploads/mock-license-${Date.now()}.pdf`;
        logger.info(
          `License file uploaded (mock): ${req.files.license[0].originalname}`
        );
      }
      if (req.files.resume) {
        resumeFileUrl = `http://localhost:5000/uploads/mock-resume-${Date.now()}.pdf`;
        logger.info(
          `Resume file uploaded (mock): ${req.files.resume[0].originalname}`
        );
      }
      if (req.files.video) {
        introVideoUrl = `http://localhost:5000/uploads/mock-video-${Date.now()}.mp4`;
        logger.info(
          `Video file uploaded (mock): ${req.files.video[0].originalname}`
        );
      }
    } catch (error) {
      logger.error("File upload error:", error);
      throw new ApiError(500, "Failed to upload files");
    }
  }

  // Create user and coach in a transaction
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone,
          role: "COACH",
          isVerified: false, // Will be verified via email code
          emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000),
          preferences: {},
        },
      });

      const coach = await tx.coach.create({
        data: {
          userId: user.id,
          domain,
          experienceDescription: experience, // Map frontend 'experience' to 'experienceDescription'
          address,
          languages: parsedLanguages, // Use parsed languages array
          licenseFileUrl,
          resumeFileUrl,
          introVideoUrl,
          status: "PENDING", // Default status for admin approval
          availability: {},
          education: [],
          certifications: [],
          specializations: [],
        },
      });

      return { user, coach };
    });
  } catch (e) {
    // Capture Prisma error codes
    logger.error("[RegisterCoach] Transaction failed", {
      code: e?.code,
      message: e?.message,
      meta: e?.meta,
    });
    if (
      e?.code === "P2002" &&
      Array.isArray(e?.meta?.target) &&
      e.meta.target.includes("email")
    ) {
      const roles = (
        await prisma.user.findMany({ where: { email }, select: { role: true } })
      )
        .map((r) => r.role)
        .join(", ");
      // Bubble a clearer conflict: legacy unique(email) still present
      throw new ApiError(
        409,
        `Email already used by role(s): ${roles}. Database must allow same email per role.`
      );
    }
    throw e;
  }

  // Send email verification code using Brevo
  try {
    await brevoEmailService.sendVerificationCode(email, firstName, "coach");
    logger.info(`Email verification code sent to coach: ${result.user.email}`);
  } catch (error) {
    logger.error("Failed to send verification email:", error);
    // Don't fail registration if email fails, user can request code later
  }

  res.status(201).json(
    new ApiResponse(
      201,
      {
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
          isVerified: result.user.isVerified,
        },
        coach: {
          id: result.coach.id,
          domain: result.coach.domain,
          status: result.coach.status,
          languages: result.coach.languages,
        },
        requiresVerification: true,
      },
      "Coach registered successfully! Please check your email for verification code."
    )
  );
});

// Login - matches frontend login workflow for all roles with email verification check
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user with coach relation if exists
  // Fetch all accounts for this email (could be PARENT and/or COACH)
  const users = await prisma.user.findMany({
    where: { email },
    include: { coach: true },
  });

  if (users.length === 0) {
    throw new ApiError(401, "Invalid email or password");
  }

  // If multiple, prefer role from request if provided
  const requestedRole = req.body.role; // optional: 'PARENT' or 'COACH'
  let user = users[0];
  if (requestedRole) {
    const match = users.find((u) => u.role === requestedRole);
    if (match) user = match;
  } else if (users.length > 1) {
    // Ask client to choose role
    const roles = users.map((u) => u.role);
    throw new ApiError(409, `Multiple roles found. Please select role.`, {
      roles,
    });
  }

  // user selected above

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    // No lockout: directly reject invalid credentials
    throw new ApiError(401, "Invalid email or password");
  }

  // Check if email is verified
  if (!user.isVerified) {
    throw new ApiError(
      403,
      "Please verify your email address before logging in. Check your inbox for verification code."
    );
  }

  // Check if user is active
  if (!user.isActive) {
    throw new ApiError(
      403,
      "Account has been deactivated. Please contact support."
    );
  }

  // For coaches, check if they are approved
  if (user.role === "COACH" && user.coach && user.coach.status !== "APPROVED") {
    let message = "Your coach application is still pending approval.";
    if (user.coach.status === "REJECTED") {
      message =
        "Your coach application has been rejected. Please contact support.";
    }
    throw new ApiError(403, message);
  }

  // Update last login timestamp on successful login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  // Generate tokens
  const accessToken = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Update refresh token
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  // Prepare response data based on role
  const responseData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isVerified: user.isVerified,
      lastLogin: user.lastLogin,
    },
    accessToken,
    refreshToken,
  };

  // Add coach data if user is a coach
  if (user.role === "COACH" && user.coach) {
    responseData.coach = {
      id: user.coach.id,
      domain: user.coach.domain,
      status: user.coach.status,
      languages: user.coach.languages,
      rating: user.coach.rating,
      totalReviews: user.coach.totalReviews,
    };
  }

  logger.info(`User logged in: ${user.email} (${user.role})`);

  res.json(new ApiResponse(200, responseData, "Login successful"));
});

// List roles available for the current user's email
export const getMyRoles = asyncHandler(async (req, res) => {
  const email = req.user.email;
  const accounts = await prisma.user.findMany({
    where: { email },
    select: { id: true, role: true, isVerified: true },
  });
  const roles = accounts.map((a) => ({
    role: a.role,
    isVerified: a.isVerified,
  }));
  res.json(new ApiResponse(200, { email, roles }, "Available roles fetched"));
});

// Switch role: require password re-entry, issue tokens for target role account
export const switchRole = asyncHandler(async (req, res) => {
  const { targetRole, password } = req.body;
  const currentUser = req.user;

  if (!targetRole || !["PARENT", "COACH"].includes(targetRole)) {
    throw new ApiError(400, "targetRole must be PARENT or COACH");
  }
  if (!password) {
    throw new ApiError(400, "Password is required to switch role");
  }
  if (targetRole === currentUser.role) {
    throw new ApiError(400, "You are already using this role");
  }

  // Find target account by same email + role
  const targetAccount = await prisma.user.findFirst({
    where: { email: currentUser.email, role: targetRole },
    include: { coach: true },
  });
  if (!targetAccount) {
    throw new ApiError(404, `No ${targetRole} account found for this email`);
  }

  // Verify password against target account
  const valid = await bcrypt.compare(password, targetAccount.password);
  if (!valid) {
    throw new ApiError(401, "Invalid password");
  }

  if (!targetAccount.isVerified) {
    throw new ApiError(
      403,
      "Please verify email for the target role before switching"
    );
  }

  // Update last login and issue tokens for target account
  await prisma.user.update({
    where: { id: targetAccount.id },
    data: { lastLogin: new Date() },
  });
  const accessToken = generateToken(targetAccount.id, targetAccount.role);
  const refreshToken = generateRefreshToken(targetAccount.id);
  await prisma.user.update({
    where: { id: targetAccount.id },
    data: { refreshToken },
  });

  const responseData = {
    user: {
      id: targetAccount.id,
      email: targetAccount.email,
      firstName: targetAccount.firstName,
      lastName: targetAccount.lastName,
      role: targetAccount.role,
      isVerified: targetAccount.isVerified,
      lastLogin: targetAccount.lastLogin,
    },
    accessToken,
    refreshToken,
  };
  if (targetAccount.role === "COACH" && targetAccount.coach) {
    responseData.coach = {
      id: targetAccount.coach.id,
      domain: targetAccount.coach.domain,
      status: targetAccount.coach.status,
      languages: targetAccount.coach.languages,
      rating: targetAccount.coach.rating,
      totalReviews: targetAccount.coach.totalReviews,
    };
  }
  logger.info(
    `Role switched to ${targetAccount.role} for ${targetAccount.email}`
  );
  res.json(new ApiResponse(200, responseData, "Switched role successfully"));
});

// Admin Login - separate endpoint for admin authentication
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find admin user
  const user = await prisma.user.findUnique({
    where: {
      email,
      role: "ADMIN", // Only allow admin users
    },
  });

  if (!user) {
    throw new ApiError(401, "Invalid admin credentials");
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    // No lockout: directly reject invalid credentials
    throw new ApiError(401, "Invalid admin credentials");
  }

  // Check if admin is active
  if (!user.isActive) {
    throw new ApiError(403, "Admin account has been deactivated.");
  }

  // Update last login timestamp on successful login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  // Generate tokens
  const accessToken = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Update refresh token
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  logger.info(`Admin logged in: ${user.email}`);

  res.json(
    new ApiResponse(
      200,
      {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isVerified: user.isVerified,
          lastLogin: user.lastLogin,
        },
        accessToken,
        refreshToken,
      },
      "Admin login successful"
    )
  );
});

// Logout
export const logout = asyncHandler(async (req, res) => {
  // Log the complete req.user object for debugging
  logger.info("Logout called. req.user:", req.user);

  // Use the correct property name based on middleware
  const userId = req.user?.id;

  if (!userId) {
    logger.error("Logout failed: No userId found in req.user:", req.user);
    throw new ApiError(500, "User not authenticated for logout");
  }

  // Clear refresh token
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });

  logger.info(`User logged out: ${userId}`);

  res.json(new ApiResponse(200, null, "Logout successful"));
});

// Refresh Token
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);

  // Find user with the refresh token
  const user = await prisma.user.findFirst({
    where: {
      id: decoded.userId,
      refreshToken: refreshToken,
    },
  });

  if (!user) {
    throw new ApiError(401, "Invalid refresh token");
  }

  // Generate new tokens
  const newAccessToken = generateToken(user.id, user.role);
  const newRefreshToken = generateRefreshToken(user.id);

  // Update refresh token in database
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: newRefreshToken },
  });

  res.json(
    new ApiResponse(
      200,
      {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      "Token refreshed successfully"
    )
  );
});

// Email Verification
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerificationExpires: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    throw new ApiError(400, "Invalid or expired verification token");
  }

  // Update user as verified
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });

  logger.info(`Email verified for user: ${user.email}`);

  res.json(new ApiResponse(200, null, "Email verified successfully"));
});

// Forgot Password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Don't reveal if email exists or not
    res.json(
      new ApiResponse(
        200,
        null,
        "If an account with that email exists, a password reset link has been sent."
      )
    );
    return;
  }

  // Generate password reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Update user with reset token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires,
    },
  });

  // Send password reset email
  try {
    await emailService.sendPasswordResetEmail(user, resetToken);
    logger.info(`Password reset email sent to: ${user.email}`);
  } catch (error) {
    logger.error("Failed to send password reset email:", error);
    throw new ApiError(500, "Failed to send password reset email");
  }

  res.json(
    new ApiResponse(
      200,
      null,
      "Please verify your email, a password reset link has been sent."
    )
  );
});

// Reset Password
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  // Prevent reusing the old password
  const isSameAsOld = await bcrypt.compare(password, user.password);
  if (isSameAsOld) {
    throw new ApiError(
      400,
      "New password cannot be the same as your old password"
    );
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Update user password and clear reset token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      refreshToken: null, // Invalidate all sessions
    },
  });

  logger.info(`Password reset for user: ${user.email}`);

  res.json(new ApiResponse(200, null, "Password reset successfully"));
});

// Verify current password (used on reset page for instant validation)
export const verifyCurrentPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { currentPassword } = req.body;

  if (!currentPassword || typeof currentPassword !== "string") {
    throw new ApiError(400, "Current password is required");
  }

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: { gt: new Date() },
    },
    select: { id: true, password: true, email: true },
  });

  if (!user) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  const match = await bcrypt.compare(currentPassword, user.password);
  res.json(
    new ApiResponse(
      200,
      { match },
      match ? "Password verified" : "Password does not match"
    )
  );
});

// Check if proposed new password equals the old one (for live validation on reset page)
export const checkNewPasswordSame = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || typeof password !== "string") {
    throw new ApiError(400, "Password is required");
  }

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: { gt: new Date() },
    },
    select: { id: true, password: true },
  });

  if (!user) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  const same = await bcrypt.compare(password, user.password);
  res.json(
    new ApiResponse(
      200,
      { same },
      same ? "New password matches old password" : "OK"
    )
  );
});

// Get Current User Profile
export const getProfile = asyncHandler(async (req, res) => {
  const { id: userId } = req.user;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isVerified: true,
      profileImageUrl: true,
      timezone: true,
      language: true,
      preferences: true,
      createdAt: true,
      lastLogin: true,
      coach: {
        select: {
          id: true,
          domain: true,
          experienceDescription: true,
          address: true,
          languages: true,
          hourlyRate: true,
          bio: true,
          status: true,
          isFrozen: true,
          rating: true,
          totalReviews: true,
          totalStudents: true,
          licenseFileUrl: true,
          resumeFileUrl: true,
          introVideoUrl: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.json(new ApiResponse(200, user, "Profile retrieved successfully"));
});
