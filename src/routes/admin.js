import express from 'express';
import { body, query, param } from 'express-validator';
import asyncHandler from '../utils/asyncHandler.js';
import validate from '../middleware/validation.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import * as adminController from '../controllers/adminController.js';
import ApiResponse from '../utils/ApiResponse.js';
import logger from '../utils/logger.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Validation rules
const coachIdValidation = [
  param('coachId').isInt({ min: 1 }).toInt().withMessage('Invalid coach ID format')
];

const approveCoachValidation = [
  ...coachIdValidation,
  body('adminNotes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Admin notes must be less than 1000 characters')
];

const rejectCoachValidation = [
  ...coachIdValidation,
  body('rejectionReason').optional().isString().trim().isLength({ max: 500 }).withMessage('Rejection reason must be less than 500 characters'),
  body('adminNotes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Admin notes must be less than 1000 characters')
];

const suspendCoachValidation = [
  ...coachIdValidation,
  body('reason').notEmpty().withMessage('Suspension reason is required'),
  body('adminNotes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Admin notes must be less than 1000 characters')
];

const updateNotesValidation = [
  ...coachIdValidation,
  body('adminNotes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Admin notes must be less than 1000 characters')
];

// Course approval validation rules
const courseIdValidation = [
  param('courseId').isInt({ min: 1 }).toInt().withMessage('Invalid course ID format')
];

const approveCourseValidation = [
  ...courseIdValidation,
  body('adminNotes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Admin notes must be less than 1000 characters')
];

const rejectCourseValidation = [
  ...courseIdValidation,
  body('rejectionReason').notEmpty().withMessage('Rejection reason is required'),
  body('adminNotes').optional().isString().trim().isLength({ max: 1000 }).withMessage('Admin notes must be less than 1000 characters')
];

const getCoursesValidation = [
  query('status').optional().isIn(['all', 'pending', 'approved', 'rejected']).withMessage('Invalid status filter'),
  query('search').optional().isString().trim().isLength({ max: 100 }).withMessage('Search term too long'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sortBy').optional().isIn(['submittedAt', 'courseTitle', 'coachName', 'category', 'price']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('category').optional().isString().trim().withMessage('Invalid category filter'),
  query('priceRange').optional().isString().withMessage('Invalid price range filter')
];

const getCoachesValidation = [
  query('status').optional().isIn(['all', 'pending', 'approved', 'rejected', 'suspended']).withMessage('Invalid status filter'),
  query('search').optional().isString().trim().isLength({ max: 100 }).withMessage('Search term too long'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'name', 'email', 'domain', 'status']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
];

/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardStats:
 *       type: object
 *       properties:
 *         totalCoaches:
 *           type: integer
 *           description: Total number of coaches
 *         pendingCoaches:
 *           type: integer
 *           description: Number of pending coach applications
 *         approvedCoaches:
 *           type: integer
 *           description: Number of approved coaches
 *         rejectedCoaches:
 *           type: integer
 *           description: Number of rejected coach applications
 *         totalParents:
 *           type: integer
 *           description: Total number of parent users
 *         totalSessions:
 *           type: integer
 *           description: Total number of sessions
 *         totalRevenue:
 *           type: number
 *           description: Total revenue from successful payments
 *     CoachListItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Coach ID
 *         firstName:
 *           type: string
 *           description: Coach first name
 *         lastName:
 *           type: string
 *           description: Coach last name
 *         email:
 *           type: string
 *           description: Coach email
 *         phone:
 *           type: string
 *           description: Coach phone number
 *         domain:
 *           type: string
 *           description: Teaching domain
 *         languages:
 *           type: array
 *           items:
 *             type: string
 *           description: Languages coach can teach in
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED, SUSPENDED]
 *           description: Coach status
 *         registrationDate:
 *           type: string
 *           format: date-time
 *           description: Registration date
 *         rating:
 *           type: number
 *           description: Coach rating
 *         totalReviews:
 *           type: integer
 *           description: Total number of reviews
 *     CoachDetails:
 *       allOf:
 *         - $ref: '#/components/schemas/CoachListItem'
 *         - type: object
 *           properties:
 *             experienceDescription:
 *               type: string
 *               description: Coach experience description
 *             address:
 *               type: string
 *               description: Coach address
 *             hourlyRate:
 *               type: number
 *               description: Hourly rate
 *             bio:
 *               type: string
 *               description: Coach biography
 *             licenseFileUrl:
 *               type: string
 *               description: License file URL
 *             resumeFileUrl:
 *               type: string
 *               description: Resume file URL
 *             introVideoUrl:
 *               type: string
 *               description: Introduction video URL
 *             adminNotes:
 *               type: string
 *               description: Admin notes
 *             approvedAt:
 *               type: string
 *               format: date-time
 *               description: Approval timestamp
 *             rejectedAt:
 *               type: string
 *               format: date-time
 *               description: Rejection timestamp
 *             rejectionReason:
 *               type: string
 *               description: Reason for rejection
 */

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get admin dashboard data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
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
 *                     dashboard:
 *                       $ref: '#/components/schemas/DashboardStats'
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.get('/dashboard', asyncHandler(adminController.getDashboard));

/**
 * @swagger
 * /admin/dashboard/stats:
 *   get:
 *     summary: Get admin dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DashboardStats'
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.get('/dashboard/stats', asyncHandler(adminController.getDashboardStats));

/**
 * @swagger
 * /admin/coaches:
 *   get:
 *     summary: Get all coaches with filtering and search
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, approved, rejected, suspended]
 *           default: all
 *         description: Filter by coach status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, email, or domain
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of coaches per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, name, email, domain, status]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Coaches retrieved successfully
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
 *                     coaches:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CoachListItem'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalCount:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.get('/coaches', getCoachesValidation, validate, asyncHandler(adminController.getCoaches));

/**
 * @swagger
 * /admin/coaches/{coachId}:
 *   get:
 *     summary: Get detailed coach information
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coachId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coach ID
 *     responses:
 *       200:
 *         description: Coach details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CoachDetails'
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Coach not found
 */
router.get('/coaches/:coachId', coachIdValidation, validate, asyncHandler(adminController.getCoachDetails));

/**
 * @swagger
 * /admin/coaches/{coachId}/approve:
 *   post:
 *     summary: Approve a coach application
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coachId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coach ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminNotes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional admin notes
 *     responses:
 *       200:
 *         description: Coach approved successfully
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
 *                     status:
 *                       type: string
 *                     approvedAt:
 *                       type: string
 *                       format: date-time
 *                     approvedBy:
 *                       type: object
 *                     adminNotes:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Coach is not pending or validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Coach not found
 */
router.post('/coaches/:coachId/approve', approveCoachValidation, validate, asyncHandler(adminController.approveCoach));

/**
 * @swagger
 * /admin/coaches/{coachId}/reject:
 *   post:
 *     summary: Reject a coach application
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coachId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coach ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for rejection
 *               adminNotes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional admin notes
 *     responses:
 *       200:
 *         description: Coach rejected successfully
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
 *                     status:
 *                       type: string
 *                     rejectedAt:
 *                       type: string
 *                       format: date-time
 *                     rejectedBy:
 *                       type: object
 *                     rejectionReason:
 *                       type: string
 *                     adminNotes:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Coach is not pending or validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Coach not found
 */
router.post('/coaches/:coachId/reject', rejectCoachValidation, validate, asyncHandler(adminController.rejectCoach));

/**
 * @swagger
 * /admin/coaches/{coachId}/suspend:
 *   post:
 *     summary: Suspend an approved coach
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coachId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coach ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for suspension
 *               adminNotes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional admin notes
 *     responses:
 *       200:
 *         description: Coach suspended successfully
 *       400:
 *         description: Coach is not approved or validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Coach not found
 */
router.post('/coaches/:coachId/suspend', suspendCoachValidation, validate, asyncHandler(adminController.suspendCoach));

/**
 * @swagger
 * /admin/coaches/{coachId}/reactivate:
 *   post:
 *     summary: Reactivate a suspended coach
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coachId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coach ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminNotes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional admin notes
 *     responses:
 *       200:
 *         description: Coach reactivated successfully
 *       400:
 *         description: Coach is not suspended or validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Coach not found
 */
router.post('/coaches/:coachId/reactivate', updateNotesValidation, validate, asyncHandler(adminController.reactivateCoach));

/**
 * @swagger
 * /admin/coaches/{coachId}/notes:
 *   put:
 *     summary: Update admin notes for a coach
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coachId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coach ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminNotes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Admin notes
 *     responses:
 *       200:
 *         description: Coach notes updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Coach not found
 */
router.put('/coaches/:coachId/notes', updateNotesValidation, validate, asyncHandler(adminController.updateCoachNotes));

/**
 * @swagger
 * /admin/activities:
 *   get:
 *     summary: Get recent admin activities for audit trail
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of activities per page
 *     responses:
 *       200:
 *         description: Admin activities retrieved successfully
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
 *                     activities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                             enum: [APPROVAL, REJECTION]
 *                           coachName:
 *                             type: string
 *                           coachEmail:
 *                             type: string
 *                           adminName:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           notes:
 *                             type: string
 *                           reason:
 *                             type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.get('/activities', 
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  validate,
  asyncHandler(adminController.getAdminActivities)
);

/**
 * @swagger
 * /admin/test-email:
 *   post:
 *     summary: Test email functionality using Resend
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to send test email to
 *     responses:
 *       200:
 *         description: Test email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     messageId:
 *                       type: string
 */
router.post('/test-email', 
  authenticate, 
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json(
        new ApiResponse(400, null, 'Email address is required')
      );
    }

    try {
      const resendEmailService = (await import('../services/resendEmailService.js')).default;
      
      // Send a test email
      const result = await resendEmailService.sendWelcomeEmail({
        email,
        firstName: 'Test',
        lastName: 'User',
        emailVerificationToken: 'test-token'
      });

      return res.status(200).json(
        new ApiResponse(200, { messageId: result?.id }, 'Test email sent successfully')
      );
    } catch (error) {
      logger.error('Test email failed:', error);
      return res.status(500).json(
        new ApiResponse(500, null, 'Failed to send test email: ' + error.message)
      );
    }
  })
);

// Course Approval Routes
router.get('/courses', getCoursesValidation, validate, asyncHandler(adminController.getCourses));
router.get('/courses/:courseId', courseIdValidation, validate, asyncHandler(adminController.getCourseDetails));
router.post('/courses/:courseId/approve', approveCourseValidation, validate, asyncHandler(adminController.approveCourse));
router.post('/courses/:courseId/reject', rejectCourseValidation, validate, asyncHandler(adminController.rejectCourse));

export default router;
