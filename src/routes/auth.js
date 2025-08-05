import express from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import asyncHandler from '../utils/asyncHandler.js';
import validate from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import * as authController from '../controllers/authController.js';

const router = express.Router();

// Configure multer for file uploads (coach registration)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
    files: 3 // Maximum 3 files (license, resume, video)
  },
  fileFilter: (req, file, cb) => {
    // License files: PDF, JPG, PNG, DOC
    if (file.fieldname === 'license') {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('License file must be PDF, JPG, PNG, or DOC format'), false);
      }
    }
    // Resume files: Any format
    else if (file.fieldname === 'resume') {
      cb(null, true); // Accept any file type for resume
    }
    // Video files: Video formats only
    else if (file.fieldname === 'video') {
      if (file.mimetype.startsWith('video/')) {
        cb(null, true);
      } else {
        cb(new Error('Video file must be a valid video format'), false);
      }
    } else {
      cb(new Error('Unexpected field'), false);
    }
  }
});

// Validation rules matching frontend requirements

// Parent registration validation
const parentRegistrationValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please include an "@" in the email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('Password must contain at least one capital letter, one lowercase letter, one number, and one special character'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
];

// Coach registration validation - matches exact frontend requirements
const coachRegistrationValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please include an "@" in the email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('Password must contain at least one capital letter, one lowercase letter, one number, and one special character'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required'),
  body('domain')
    .trim()
    .notEmpty()
    .withMessage('Domain is required'),
  body('experience')
    .trim()
    .notEmpty()
    .withMessage('Experience is required'),
  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required'),
  body('languages')
    .isArray({ min: 1 })
    .withMessage('At least one language is required')
];

// Login validation
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Password validation for reset
const passwordValidation = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .withMessage('Password must contain at least one capital letter, one lowercase letter, one number, and one special character')
];

// Routes with Swagger documentation

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: User ID
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *         firstName:
 *           type: string
 *           description: User first name
 *         lastName:
 *           type: string
 *           description: User last name
 *         role:
 *           type: string
 *           enum: [ADMIN, COACH, PARENT]
 *           description: User role
 *         isVerified:
 *           type: boolean
 *           description: Email verification status
 *     Coach:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Coach ID
 *         domain:
 *           type: string
 *           description: Teaching domain
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, SUSPENDED]
 *           description: Coach approval status
 *         languages:
 *           type: array
 *           items:
 *             type: string
 *           description: Languages coach can teach in
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/User'
 *             coach:
 *               $ref: '#/components/schemas/Coach'
 *             accessToken:
 *               type: string
 *             refreshToken:
 *               type: string
 *         message:
 *           type: string
 */

/**
 * @swagger
 * /auth/register/parent:
 *   post:
 *     summary: Register a new parent
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - phone
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: parent@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "Password123!"
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *     responses:
 *       201:
 *         description: Parent registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/register/parent', parentRegistrationValidation, validate, asyncHandler(authController.registerParent));

/**
 * @swagger
 * /auth/register/coach:
 *   post:
 *     summary: Register a new coach with file uploads
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - phone
 *               - domain
 *               - experience
 *               - address
 *               - languages
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: coach@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "Password123!"
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               domain:
 *                 type: string
 *                 example: Mathematics
 *               experience:
 *                 type: string
 *                 example: "Experienced mathematics educator with 5 years of teaching experience"
 *               address:
 *                 type: string
 *                 example: "123 Education Street, Learning City, LC 12345"
 *               languages:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["English", "Spanish"]
 *               license:
 *                 type: string
 *                 format: binary
 *                 description: License proof file (PDF, JPG, PNG, DOC - max 5MB)
 *               resume:
 *                 type: string
 *                 format: binary
 *                 description: Resume file (any format - max 10MB)
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Introduction video (video format - max 50MB)
 *     responses:
 *       201:
 *         description: Coach registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/register/coach', 
  upload.fields([
    { name: 'license', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
    { name: 'video', maxCount: 1 }
  ]),
  coachRegistrationValidation, 
  validate, 
  asyncHandler(authController.registerCoach)
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user (Parent/Coach)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: "Password123!"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account locked or coach not approved
 *       423:
 *         description: Account temporarily locked
 */
router.post('/login', loginValidation, validate, asyncHandler(authController.login));

/**
 * @swagger
 * /auth/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 example: "AdminPassword123!"
 *     responses:
 *       200:
 *         description: Admin login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid admin credentials
 *       403:
 *         description: Admin account deactivated
 *       423:
 *         description: Account temporarily locked
 */
router.post('/admin/login', loginValidation, validate, asyncHandler(authController.adminLogin));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */
router.post('/logout', authenticate, asyncHandler(authController.logout));

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                 message:
 *                   type: string
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', asyncHandler(authController.refreshToken));

/**
 * @swagger
 * /auth/verify-email/{token}:
 *   get:
 *     summary: Verify email address
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Email verification token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.get('/verify-email/:token', asyncHandler(authController.verifyEmail));

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Password reset email sent (if account exists)
 */
router.post('/forgot-password', 
  [body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')],
  validate,
  asyncHandler(authController.forgotPassword)
);

/**
 * @swagger
 * /auth/reset-password/{token}:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Password reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "NewPassword123!"
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token / Validation error
 */
router.post('/reset-password/:token', passwordValidation, validate, asyncHandler(authController.resetPassword));

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     firstName:
 *                       type: string
 *                     lastName:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     role:
 *                       type: string
 *                     isVerified:
 *                       type: boolean
 *                     coach:
 *                       $ref: '#/components/schemas/Coach'
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/profile', authenticate, asyncHandler(authController.getProfile));

export default router;
