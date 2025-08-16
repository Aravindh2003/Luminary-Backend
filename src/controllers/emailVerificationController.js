import { prisma } from "../config/database.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import brevoEmailService from "../services/brevoEmailService.js";
import logger from "../utils/logger.js";

// Cancel registration: delete unverified user and invalidate code
export const cancelRegistration = asyncHandler(async (req, res) => {
  const { email, userType = "parent" } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const role = userType === "coach" ? "COACH" : "PARENT";
  const user = await prisma.user.findFirst({ where: { email, role } });
  if (!user) {
    // Idempotent: treat as success
    return res.json(new ApiResponse(200, null, "Account removed (if existed)"));
  }

  if (user.isVerified) {
    throw new ApiError(400, "Verified accounts cannot be cancelled");
  }

  // Invalidate any pending code
  try {
    brevoEmailService.invalidateVerification(email, role);
  } catch {}

  await prisma.user.delete({ where: { id: user.id } });
  logger.info(`Unverified account deleted by cancel: ${email}`);
  return res.json(new ApiResponse(200, null, "Unverified account deleted"));
});

// Cleanup: remove any unverified users whose code expired
export const cleanupExpiredUnverified = asyncHandler(async (_req, res) => {
  const now = new Date();
  const deleted = await prisma.user.deleteMany({
    where: {
      isVerified: false,
      emailVerificationExpires: { lt: now },
    },
  });
  logger.info(`Cleanup expired unverified users: ${deleted.count}`);
  return res.json(
    new ApiResponse(200, { count: deleted.count }, "Cleanup complete")
  );
});

// Request email verification code
export const requestVerificationCode = asyncHandler(async (req, res) => {
  const { email, userType = "parent" } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  // Check if user exists
  const role = userType === "coach" ? "COACH" : "PARENT";
  const user = await prisma.user.findFirst({
    where: { email, role },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isVerified) {
    throw new ApiError(400, "Email is already verified");
  }

  try {
    // Send verification code
    await brevoEmailService.sendVerificationCode(
      email,
      user.firstName,
      userType
    );

    logger.info(`Verification code requested for: ${email}`);

    res.json(
      new ApiResponse(200, null, "Verification code sent to your email")
    );
  } catch (error) {
    logger.error("Failed to send verification code:", error);
    throw new ApiError(500, "Failed to send verification code");
  }
});

// Verify email with code
export const verifyEmailWithCode = asyncHandler(async (req, res) => {
  const { email, code, userType = "parent" } = req.body;

  if (!email || !code) {
    throw new ApiError(400, "Email and verification code are required");
  }

  // Find user
  const role = userType === "coach" ? "COACH" : "PARENT";
  const user = await prisma.user.findFirst({
    where: { email, role },
    include: {
      coach: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isVerified) {
    throw new ApiError(400, "Email is already verified");
  }

  try {
    // Verify the code
    const verificationResult = await brevoEmailService.verifyCode(
      email,
      code,
      role
    );

    if (!verificationResult.success) {
      throw new ApiError(400, verificationResult.message);
    }

    // Update user as verified
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
      include: {
        coach: true,
      },
    });

    // Send welcome email
    try {
      const userType = user.role === "COACH" ? "coach" : "parent";
      await brevoEmailService.sendWelcomeEmail(updatedUser, userType);
      logger.info(`Welcome email sent to verified user: ${email}`);
    } catch (emailError) {
      logger.error("Failed to send welcome email:", emailError);
      // Don't fail the verification if welcome email fails
    }

    logger.info(`Email verified successfully for: ${email}`);

    // Prepare response data
    const responseData = {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        isVerified: updatedUser.isVerified,
      },
    };

    // Add coach data if user is a coach
    if (updatedUser.role === "COACH" && updatedUser.coach) {
      responseData.coach = {
        id: updatedUser.coach.id,
        domain: updatedUser.coach.domain,
        status: updatedUser.coach.status,
        languages: updatedUser.coach.languages,
      };
    }

    res.json(new ApiResponse(200, responseData, "Email verified successfully"));
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    logger.error("Email verification failed:", error);
    throw new ApiError(500, "Email verification failed");
  }
});

// Resend verification code
export const resendVerificationCode = asyncHandler(async (req, res) => {
  const { email, userType = "parent" } = req.body;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  // Check if user exists
  const role = userType === "coach" ? "COACH" : "PARENT";
  const user = await prisma.user.findFirst({
    where: { email, role },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.isVerified) {
    throw new ApiError(400, "Email is already verified");
  }

  try {
    // Resend verification code
    await brevoEmailService.resendVerificationCode(
      email,
      user.firstName,
      userType
    );
    // Extend expiry window by 10 minutes from now
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationExpires: new Date(Date.now() + 10 * 60 * 1000) },
    });

    logger.info(`Verification code resent for: ${email}`);

    res.json(
      new ApiResponse(200, null, "Verification code resent to your email")
    );
  } catch (error) {
    logger.error("Failed to resend verification code:", error);
    throw new ApiError(500, "Failed to resend verification code");
  }
});

// Check verification status
export const checkVerificationStatus = asyncHandler(async (req, res) => {
  const { email } = req.params;
  const { userType } = req.query;

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const where = userType
    ? { email, role: userType === "coach" ? "COACH" : "PARENT" }
    : { email };
  const user = await prisma.user.findFirst({
    where,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isVerified: true,
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.json(
    new ApiResponse(
      200,
      {
        email: user.email,
        isVerified: user.isVerified,
        firstName: user.firstName,
        role: user.role,
      },
      "Verification status retrieved"
    )
  );
});
