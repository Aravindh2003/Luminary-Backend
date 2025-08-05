import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const { JWT_SECRET, JWT_REFRESH_SECRET } = process.env;

export const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

export const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new ApiError(401, 'Invalid access token');
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    throw new ApiError(401, 'Invalid refresh token');
  }
};

export const authenticate = asyncHandler(async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new ApiError(401, 'Access token is required');
    }

    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        coach: true
      }
    });

    if (!user) {
      throw new ApiError(401, 'User not found');
    }

    if (!user.isActive) {
      throw new ApiError(401, 'Account is deactivated');
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isVerified: user.isVerified,
      coach: user.coach
    };

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(401, 'Invalid access token');
  }
});

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'Insufficient permissions');
    }

    next();
  };
};

export const requireAdmin = authorize('ADMIN');
export const requireCoach = authorize('COACH');
export const requireParent = authorize('PARENT');
export const requireCoachOrAdmin = authorize('COACH', 'ADMIN');

export const requireEmailVerification = asyncHandler(async (req, res, next) => {
  if (!req.user.isVerified) {
    throw new ApiError(403, 'Email verification required');
  }
  next();
});

export const authRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
};

export const trackLoginAttempts = asyncHandler(async (req, res, next) => {
  // This middleware will be called before login attempts
  // The actual tracking is done in the login controller
  next();
});

export const updateLoginAttempts = asyncHandler(async (req, res, next) => {
  // This middleware will be called after failed login attempts
  // The actual updating is done in the login controller
  next();
});

export const resetLoginAttempts = asyncHandler(async (req, res, next) => {
  // This middleware will be called after successful login
  // The actual resetting is done in the login controller
  next();
});

export const optionalAuth = asyncHandler(async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = verifyToken(token);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          coach: true
        }
      });

      if (user && user.isActive) {
        req.user = {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isVerified: user.isVerified,
          coach: user.coach
        };
      }
    }
  } catch (error) {
    // Silently ignore authentication errors for optional auth
  }

  next();
});

export const checkOwnership = (model, idField = 'id') => {
  return asyncHandler(async (req, res, next) => {
    const resourceId = req.params[idField];
    const userId = req.user.id;

    let resource;
    
    switch (model) {
      case 'user':
        resource = await prisma.user.findUnique({
          where: { id: resourceId }
        });
        break;
      case 'coach':
        resource = await prisma.coach.findUnique({
          where: { id: resourceId }
        });
        break;
      case 'course':
        resource = await prisma.course.findUnique({
          where: { id: resourceId }
        });
        break;
      case 'session':
        resource = await prisma.session.findUnique({
          where: { id: resourceId }
        });
        break;
      default:
        throw new ApiError(400, 'Invalid model specified');
    }

    if (!resource) {
      throw new ApiError(404, 'Resource not found');
    }

    // Check ownership based on model
    let isOwner = false;
    switch (model) {
      case 'user':
        isOwner = resource.id === userId;
        break;
      case 'coach':
        isOwner = resource.userId === userId;
        break;
      case 'course':
        isOwner = resource.coachId === userId;
        break;
      case 'session':
        isOwner = resource.coachId === userId || resource.studentId === userId;
        break;
    }

    if (!isOwner && req.user.role !== 'ADMIN') {
      throw new ApiError(403, 'Access denied');
    }

    req.resource = resource;
    next();
  });
};

export default {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  authenticate,
  authorize,
  requireAdmin,
  requireCoach,
  requireParent,
  requireCoachOrAdmin,
  requireEmailVerification,
  authRateLimit,
  trackLoginAttempts,
  updateLoginAttempts,
  resetLoginAttempts,
  optionalAuth,
  checkOwnership
}; 