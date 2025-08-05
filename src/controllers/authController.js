import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../middleware/auth.js';
import emailService from '../services/emailService.js';
// import fileService from '../services/fileService.js'; // Temporarily disabled
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';

// Parent Registration - matches frontend RegisterParent workflow
export const registerParent = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, phone } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new ApiError(409, 'User with this email already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Generate email verification token
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      role: 'PARENT',
      emailVerificationToken,
      emailVerificationExpires,
      preferences: {}
    }
  });

  // Send welcome email
  try {
    await emailService.sendWelcomeEmail(user);
    logger.info(`Welcome email sent to parent: ${user.email}`);
  } catch (error) {
    logger.error('Failed to send welcome email:', error);
  }

  // Generate tokens
  const accessToken = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Update user with refresh token
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken }
  });

  res.status(201).json(
    new ApiResponse(201, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isVerified: user.isVerified
      },
      accessToken,
      refreshToken
    }, 'Parent registered successfully')
  );
});

// Coach Registration - matches exact frontend RegisterCoach workflow
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
    languages // Array of languages from frontend
  } = req.body;

  // Validate required fields exactly as frontend does
  if (!email || !password || !firstName || !lastName || !phone || !domain || !experience || !address) {
    throw new ApiError(400, 'All required fields must be provided');
  }

  if (!languages || !Array.isArray(languages) || languages.length === 0) {
    throw new ApiError(400, 'At least one language is required');
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw new ApiError(409, 'User with this email already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Generate email verification token
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');
  const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Handle file uploads if present
  let licenseFileUrl = null;
  let resumeFileUrl = null;
  let introVideoUrl = null;

  if (req.files) {
    try {
      // Mock file upload URLs for now (since file service is disabled)
      if (req.files.license) {
        licenseFileUrl = `http://localhost:5000/uploads/mock-license-${Date.now()}.pdf`;
        logger.info(`License file uploaded (mock): ${req.files.license[0].originalname}`);
      }
      if (req.files.resume) {
        resumeFileUrl = `http://localhost:5000/uploads/mock-resume-${Date.now()}.pdf`;
        logger.info(`Resume file uploaded (mock): ${req.files.resume[0].originalname}`);
      }
      if (req.files.video) {
        introVideoUrl = `http://localhost:5000/uploads/mock-video-${Date.now()}.mp4`;
        logger.info(`Video file uploaded (mock): ${req.files.video[0].originalname}`);
      }
    } catch (error) {
      logger.error('File upload error:', error);
      throw new ApiError(500, 'Failed to upload files');
    }
  }

  // Create user and coach in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: 'COACH',
        emailVerificationToken,
        emailVerificationExpires,
        preferences: {}
      }
    });

    const coach = await tx.coach.create({
      data: {
        userId: user.id,
        domain,
        experienceDescription: experience, // Map frontend 'experience' to 'experienceDescription'
        address,
        languages: languages, // Array of languages
        licenseFileUrl,
        resumeFileUrl,
        introVideoUrl,
        status: 'PENDING', // Default status for admin approval
        availability: {},
        education: [],
        certifications: [],
        specializations: []
      }
    });

    return { user, coach };
  });

  // Send coach application notification email
  try {
    await emailService.sendCoachApplicationNotification(result.user);
    logger.info(`Coach application notification sent to: ${result.user.email}`);
  } catch (error) {
    logger.error('Failed to send coach application notification:', error);
  }

  // Generate tokens
  const accessToken = generateToken(result.user.id, result.user.role);
  const refreshToken = generateRefreshToken(result.user.id);

  // Update user with refresh token
  await prisma.user.update({
    where: { id: result.user.id },
    data: { refreshToken }
  });

  res.status(201).json(
    new ApiResponse(201, {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        isVerified: result.user.isVerified
      },
      coach: {
        id: result.coach.id,
        domain: result.coach.domain,
        status: result.coach.status,
        languages: result.coach.languages
      },
      accessToken,
      refreshToken
    }, 'Coach registered successfully! Your profile has been submitted for admin approval.')
  );
});

// Login - matches frontend login workflow for all roles
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user with coach relation if exists
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      coach: true
    }
  });

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const lockTimeRemaining = Math.ceil((user.lockedUntil - new Date()) / (1000 * 60));
    throw new ApiError(423, `Account is locked. Try again in ${lockTimeRemaining} minutes.`);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    // Increment login attempts
    const loginAttempts = user.loginAttempts + 1;
    const updateData = { loginAttempts };

    // Lock account after 5 failed attempts for 30 minutes
    if (loginAttempts >= 5) {
      updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      updateData.loginAttempts = 0; // Reset attempts after locking
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    throw new ApiError(401, 'Invalid email or password');
  }

  // Check if user is active
  if (!user.isActive) {
    throw new ApiError(403, 'Account has been deactivated. Please contact support.');
  }

  // For coaches, check if they are approved
  if (user.role === 'COACH' && user.coach && user.coach.status !== 'APPROVED') {
    let message = 'Your coach application is still pending approval.';
    if (user.coach.status === 'REJECTED') {
      message = 'Your coach application has been rejected. Please contact support.';
    }
    throw new ApiError(403, message);
  }

  // Reset login attempts on successful login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
      lastLogin: new Date()
    }
  });

  // Generate tokens
  const accessToken = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Update refresh token
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken }
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
      lastLogin: user.lastLogin
    },
    accessToken,
    refreshToken
  };

  // Add coach data if user is a coach
  if (user.role === 'COACH' && user.coach) {
    responseData.coach = {
      id: user.coach.id,
      domain: user.coach.domain,
      status: user.coach.status,
      languages: user.coach.languages,
      rating: user.coach.rating,
      totalReviews: user.coach.totalReviews
    };
  }

  logger.info(`User logged in: ${user.email} (${user.role})`);

  res.json(
    new ApiResponse(200, responseData, 'Login successful')
  );
});

// Admin Login - separate endpoint for admin authentication
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find admin user
  const user = await prisma.user.findUnique({
    where: { 
      email,
      role: 'ADMIN' // Only allow admin users
    }
  });

  if (!user) {
    throw new ApiError(401, 'Invalid admin credentials');
  }

  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const lockTimeRemaining = Math.ceil((user.lockedUntil - new Date()) / (1000 * 60));
    throw new ApiError(423, `Account is locked. Try again in ${lockTimeRemaining} minutes.`);
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    // Increment login attempts for admin (more strict)
    const loginAttempts = user.loginAttempts + 1;
    const updateData = { loginAttempts };

    // Lock admin account after 3 failed attempts for 60 minutes
    if (loginAttempts >= 3) {
      updateData.lockedUntil = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes
      updateData.loginAttempts = 0;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    throw new ApiError(401, 'Invalid admin credentials');
  }

  // Check if admin is active
  if (!user.isActive) {
    throw new ApiError(403, 'Admin account has been deactivated.');
  }

  // Reset login attempts on successful login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
      lastLogin: new Date()
    }
  });

  // Generate tokens
  const accessToken = generateToken(user.id, user.role);
  const refreshToken = generateRefreshToken(user.id);

  // Update refresh token
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken }
  });

  logger.info(`Admin logged in: ${user.email}`);

  res.json(
    new ApiResponse(200, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin
      },
      accessToken,
      refreshToken
    }, 'Admin login successful')
  );
});

// Logout
export const logout = asyncHandler(async (req, res) => {
  const { userId } = req.user;

  // Clear refresh token
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null }
  });

  logger.info(`User logged out: ${userId}`);

  res.json(
    new ApiResponse(200, null, 'Logout successful')
  );
});

// Refresh Token
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ApiError(401, 'Refresh token is required');
  }

  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);
  
  // Find user with the refresh token
  const user = await prisma.user.findFirst({
    where: {
      id: decoded.userId,
      refreshToken: refreshToken
    }
  });

  if (!user) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  // Generate new tokens
  const newAccessToken = generateToken(user.id, user.role);
  const newRefreshToken = generateRefreshToken(user.id);

  // Update refresh token in database
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: newRefreshToken }
  });

  res.json(
    new ApiResponse(200, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    }, 'Token refreshed successfully')
  );
});

// Email Verification
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerificationExpires: {
        gt: new Date()
      }
    }
  });

  if (!user) {
    throw new ApiError(400, 'Invalid or expired verification token');
  }

  // Update user as verified
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null
    }
  });

  logger.info(`Email verified for user: ${user.email}`);

  res.json(
    new ApiResponse(200, null, 'Email verified successfully')
  );
});

// Forgot Password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    // Don't reveal if email exists or not
    res.json(
      new ApiResponse(200, null, 'If an account with that email exists, a password reset link has been sent.')
    );
    return;
  }

  // Generate password reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Update user with reset token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires
    }
  });

  // Send password reset email
  try {
    await emailService.sendPasswordResetEmail(user, resetToken);
    logger.info(`Password reset email sent to: ${user.email}`);
  } catch (error) {
    logger.error('Failed to send password reset email:', error);
    throw new ApiError(500, 'Failed to send password reset email');
  }

  res.json(
    new ApiResponse(200, null, 'If an account with that email exists, a password reset link has been sent.')
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
        gt: new Date()
      }
    }
  });

  if (!user) {
    throw new ApiError(400, 'Invalid or expired reset token');
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
      refreshToken: null // Invalidate all sessions
    }
  });

  logger.info(`Password reset for user: ${user.email}`);

  res.json(
    new ApiResponse(200, null, 'Password reset successfully')
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
          rating: true,
          totalReviews: true,
          totalStudents: true,
          licenseFileUrl: true,
          resumeFileUrl: true,
          introVideoUrl: true
        }
      }
    }
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.json(
    new ApiResponse(200, user, 'Profile retrieved successfully')
  );
});
