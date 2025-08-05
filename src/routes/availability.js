import express from 'express';
import { body, query, param } from 'express-validator';
import asyncHandler from '../utils/asyncHandler.js';
import validate from '../middleware/validation.js';
import { authenticate, authorize } from '../middleware/auth.js';
import * as availabilityController from '../controllers/availabilityController.js';

const router = express.Router();

// Validation rules
const availabilityValidation = [
  body('availability')
    .isArray({ min: 1 })
    .withMessage('Availability must be an array with at least one day'),
  body('availability.*.dayOfWeek')
    .isInt({ min: 0, max: 6 })
    .withMessage('Day of week must be 0-6 (Sunday-Saturday)'),
  body('availability.*.timeSlots')
    .isArray({ min: 1 })
    .withMessage('Time slots must be an array with at least one slot'),
  body('availability.*.timeSlots.*.startTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('availability.*.timeSlots.*.endTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format'),
  body('availability.*.timeSlots.*.maxBookings')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max bookings must be a positive integer'),
  body('availability.*.timeSlots.*.price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('availability.*.timeSlots.*.sessionType')
    .optional()
    .isIn(['ONE_ON_ONE', 'GROUP', 'ASSESSMENT'])
    .withMessage('Session type must be ONE_ON_ONE, GROUP, or ASSESSMENT')
];

const scheduleSessionValidation = [
  body('timeSlotId')
    .isString()
    .isLength({ min: 20, max: 30 })
    .withMessage('Invalid time slot ID format'),
  body('studentId')
    .isString()
    .isLength({ min: 20, max: 30 })
    .withMessage('Invalid student ID format'),
  body('courseId')
    .optional()
    .isString()
    .isLength({ min: 20, max: 30 })
    .withMessage('Invalid course ID format'),
  body('sessionDate')
    .isISO8601()
    .withMessage('Session date must be a valid ISO 8601 date'),
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('duration')
    .isInt({ min: 15, max: 480 })
    .withMessage('Duration must be between 15 and 480 minutes'),
  body('sessionType')
    .optional()
    .isIn(['ONE_ON_ONE', 'GROUP', 'ASSESSMENT'])
    .withMessage('Session type must be ONE_ON_ONE, GROUP, or ASSESSMENT'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
];

const approveSessionValidation = [
  param('sessionId')
    .isString()
    .isLength({ min: 20, max: 30 })
    .withMessage('Invalid session ID format'),
  body('adminNotes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Admin notes must be less than 1000 characters')
];

const rejectSessionValidation = [
  param('sessionId')
    .isString()
    .isLength({ min: 20, max: 30 })
    .withMessage('Invalid session ID format'),
  body('rejectionReason')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Rejection reason is required and must be less than 500 characters'),
  body('adminNotes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Admin notes must be less than 1000 characters')
];

const approveAvailabilityValidation = [
  param('availabilityId')
    .isString()
    .isLength({ min: 20, max: 30 })
    .withMessage('Invalid availability ID format'),
  body('adminNotes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Admin notes must be less than 1000 characters')
];

const rejectAvailabilityValidation = [
  param('availabilityId')
    .isString()
    .isLength({ min: 20, max: 30 })
    .withMessage('Invalid availability ID format'),
  body('rejectionReason')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Rejection reason is required and must be less than 500 characters'),
  body('adminNotes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Admin notes must be less than 1000 characters')
];

const getAvailableTimeSlotsValidation = [
  query('coachId')
    .isString()
    .isLength({ min: 20, max: 30 })
    .withMessage('Invalid coach ID format'),
  query('date')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
  query('sessionType')
    .optional()
    .isIn(['ONE_ON_ONE', 'GROUP', 'ASSESSMENT'])
    .withMessage('Session type must be ONE_ON_ONE, GROUP, or ASSESSMENT')
];

/**
 * @swagger
 * components:
 *   schemas:
 *     Availability:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Availability ID
 *         coachId:
 *           type: string
 *           description: Coach ID
 *         dayOfWeek:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *           description: Day of week (0=Sunday, 1=Monday, etc.)
 *         isActive:
 *           type: boolean
 *           description: Whether this availability is active
 *         timeSlots:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TimeSlot'
 *     TimeSlot:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Time slot ID
 *         startTime:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: Start time in HH:MM format
 *         endTime:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *           description: End time in HH:MM format
 *         isAvailable:
 *           type: boolean
 *           description: Whether this time slot is available
 *         maxBookings:
 *           type: integer
 *           minimum: 1
 *           description: Maximum number of bookings allowed
 *         currentBookings:
 *           type: integer
 *           minimum: 0
 *           description: Current number of bookings
 *         price:
 *           type: number
 *           minimum: 0
 *           description: Price for this time slot
 *         sessionType:
 *           type: string
 *           enum: [ONE_ON_ONE, GROUP, ASSESSMENT]
 *           description: Type of session
 *     ScheduledSession:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Session ID
 *         timeSlotId:
 *           type: string
 *           description: Time slot ID
 *         coachId:
 *           type: string
 *           description: Coach ID
 *         studentId:
 *           type: string
 *           description: Student ID
 *         courseId:
 *           type: string
 *           description: Course ID (optional)
 *         sessionDate:
 *           type: string
 *           format: date-time
 *           description: Session date and time
 *         title:
 *           type: string
 *           description: Session title
 *         description:
 *           type: string
 *           description: Session description
 *         duration:
 *           type: integer
 *           minimum: 15
 *           maximum: 480
 *           description: Duration in minutes
 *         sessionType:
 *           type: string
 *           enum: [ONE_ON_ONE, GROUP, ASSESSMENT]
 *           description: Type of session
 *         status:
 *           type: string
 *           enum: [PENDING_APPROVAL, APPROVED, REJECTED, CANCELLED, COMPLETED, NO_SHOW]
 *           description: Session status
 *         price:
 *           type: number
 *           minimum: 0
 *           description: Session price
 *         meetingUrl:
 *           type: string
 *           description: Meeting URL
 *         notes:
 *           type: string
 *           description: Session notes
 *         adminNotes:
 *           type: string
 *           description: Admin notes
 */

/**
 * @swagger
 * /availability/coaches/{coachId}:
 *   post:
 *     summary: Set coach availability
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coachId
 *         required: true
 *         schema:
 *           type: string
 *         description: Coach ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - availability
 *             properties:
 *               availability:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - dayOfWeek
 *                     - timeSlots
 *                   properties:
 *                     dayOfWeek:
 *                       type: integer
 *                       minimum: 0
 *                       maximum: 6
 *                       description: Day of week (0=Sunday, 1=Monday, etc.)
 *                     isActive:
 *                       type: boolean
 *                       default: true
 *                       description: Whether this day is active
 *                     timeSlots:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required:
 *                           - startTime
 *                           - endTime
 *                         properties:
 *                           startTime:
 *                             type: string
 *                             pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                             description: Start time in HH:MM format
 *                           endTime:
 *                             type: string
 *                             pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                             description: End time in HH:MM format
 *                           isAvailable:
 *                             type: boolean
 *                             default: true
 *                             description: Whether this slot is available
 *                           maxBookings:
 *                             type: integer
 *                             minimum: 1
 *                             default: 1
 *                             description: Maximum bookings allowed
 *                           price:
 *                             type: number
 *                             minimum: 0
 *                             description: Price for this slot
 *                           sessionType:
 *                             type: string
 *                             enum: [ONE_ON_ONE, GROUP, ASSESSMENT]
 *                             default: ONE_ON_ONE
 *                             description: Type of session
 *     responses:
 *       200:
 *         description: Coach availability updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied
 *       500:
 *         description: Internal server error
 */
router.post('/coaches/:coachId', 
  authenticate, 
  availabilityValidation, 
  validate, 
  asyncHandler(availabilityController.setCoachAvailability)
);

/**
 * @swagger
 * /availability/coaches/{coachId}:
 *   get:
 *     summary: Get coach availability
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coachId
 *         required: true
 *         schema:
 *           type: string
 *         description: Coach ID
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Optional date to filter sessions
 *     responses:
 *       200:
 *         description: Coach availability retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       403:
 *         description: Access denied
 *       500:
 *         description: Internal server error
 */
router.get('/coaches/:coachId', 
  authenticate, 
  asyncHandler(availabilityController.getCoachAvailability)
);

/**
 * @swagger
 * /availability/time-slots:
 *   get:
 *     summary: Get available time slots for a coach on a specific date
 *     tags: [Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: coachId
 *         required: true
 *         schema:
 *           type: string
 *         description: Coach ID
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date to check availability
 *       - in: query
 *         name: sessionType
 *         schema:
 *           type: string
 *           enum: [ONE_ON_ONE, GROUP, ASSESSMENT]
 *           default: ONE_ON_ONE
 *         description: Type of session
 *     responses:
 *       200:
 *         description: Available time slots retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.get('/time-slots', 
  authenticate, 
  getAvailableTimeSlotsValidation, 
  validate, 
  asyncHandler(availabilityController.getAvailableTimeSlots)
);

/**
 * @swagger
 * /availability/sessions:
 *   post:
 *     summary: Schedule a new session
 *     tags: [Scheduling]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - timeSlotId
 *               - studentId
 *               - sessionDate
 *               - title
 *               - duration
 *               - price
 *             properties:
 *               timeSlotId:
 *                 type: string
 *                 description: Time slot ID
 *               studentId:
 *                 type: string
 *                 description: Student ID
 *               courseId:
 *                 type: string
 *                 description: Course ID (optional)
 *               sessionDate:
 *                 type: string
 *                 format: date-time
 *                 description: Session date and time
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *                 description: Session title
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Session description
 *               duration:
 *                 type: integer
 *                 minimum: 15
 *                 maximum: 480
 *                 description: Duration in minutes
 *               sessionType:
 *                 type: string
 *                 enum: [ONE_ON_ONE, GROUP, ASSESSMENT]
 *                 default: ONE_ON_ONE
 *                 description: Type of session
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 description: Session price
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Session notes
 *     responses:
 *       201:
 *         description: Session scheduled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Validation error or time slot not available
 *       404:
 *         description: Time slot not found
 *       500:
 *         description: Internal server error
 */
router.post('/sessions', 
  authenticate, 
  scheduleSessionValidation, 
  validate, 
  asyncHandler(availabilityController.scheduleSession)
);

/**
 * @swagger
 * /availability/sessions:
 *   get:
 *     summary: Get scheduled sessions with filtering
 *     tags: [Scheduling]
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
 *           default: 10
 *         description: Number of sessions per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING_APPROVAL, APPROVED, REJECTED, CANCELLED, COMPLETED, NO_SHOW]
 *         description: Filter by session status
 *       - in: query
 *         name: coachId
 *         schema:
 *           type: string
 *         description: Filter by coach ID
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *         description: Filter by student ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter sessions from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter sessions until this date
 *       - in: query
 *         name: sessionType
 *         schema:
 *           type: string
 *           enum: [ONE_ON_ONE, GROUP, ASSESSMENT]
 *         description: Filter by session type
 *     responses:
 *       200:
 *         description: Scheduled sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: Internal server error
 */
router.get('/sessions', 
  authenticate, 
  asyncHandler(availabilityController.getScheduledSessions)
);

/**
 * @swagger
 * /availability/sessions/{sessionId}/approve:
 *   post:
 *     summary: Approve a scheduled session (Admin only)
 *     tags: [Scheduling]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
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
 *         description: Session approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Session is not pending approval
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
router.post('/sessions/:sessionId/approve', 
  authenticate, 
  authorize(['ADMIN']), 
  approveSessionValidation, 
  validate, 
  asyncHandler(availabilityController.approveSession)
);

/**
 * @swagger
 * /availability/sessions/{sessionId}/reject:
 *   post:
 *     summary: Reject a scheduled session (Admin only)
 *     tags: [Scheduling]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejectionReason
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Reason for rejection
 *               adminNotes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional admin notes
 *     responses:
 *       200:
 *         description: Session rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Session is not pending approval or missing rejection reason
 *       404:
 *         description: Session not found
 *       500:
 *         description: Internal server error
 */
router.post('/sessions/:sessionId/reject', 
  authenticate, 
  authorize(['ADMIN']), 
  rejectSessionValidation, 
  validate, 
  asyncHandler(availabilityController.rejectSession)
);

// Admin-only routes
/**
 * @swagger
 * /availability/admin/coaches:
 *   get:
 *     summary: Get all coach availabilities (Admin only)
 *     tags: [Admin Availability]
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
 *           default: 10
 *         description: Number of availabilities per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by coach name or email
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, inactive]
 *           default: all
 *         description: Filter by availability status
 *       - in: query
 *         name: dayOfWeek
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 6
 *         description: Filter by day of week
 *     responses:
 *       200:
 *         description: Coach availabilities retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: Internal server error
 */
router.get('/admin/coaches', 
  authenticate, 
  authorize(['ADMIN']), 
  asyncHandler(availabilityController.getAllCoachAvailabilities)
);

/**
 * @swagger
 * /availability/admin/coaches/{availabilityId}/approve:
 *   post:
 *     summary: Approve coach availability (Admin only)
 *     tags: [Admin Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: availabilityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Availability ID
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
 *         description: Coach availability approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: Availability not found
 *       500:
 *         description: Internal server error
 */
router.post('/admin/coaches/:availabilityId/approve', 
  authenticate, 
  authorize(['ADMIN']), 
  approveAvailabilityValidation, 
  validate, 
  asyncHandler(availabilityController.approveCoachAvailability)
);

/**
 * @swagger
 * /availability/admin/coaches/{availabilityId}/reject:
 *   post:
 *     summary: Reject coach availability (Admin only)
 *     tags: [Admin Availability]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: availabilityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Availability ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejectionReason
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Reason for rejection
 *               adminNotes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional admin notes
 *     responses:
 *       200:
 *         description: Coach availability rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: Missing rejection reason
 *       404:
 *         description: Availability not found
 *       500:
 *         description: Internal server error
 */
router.post('/admin/coaches/:availabilityId/reject', 
  authenticate, 
  authorize(['ADMIN']), 
  rejectAvailabilityValidation, 
  validate, 
  asyncHandler(availabilityController.rejectCoachAvailability)
);

// Notification routes
/**
 * @swagger
 * /availability/notifications:
 *   get:
 *     summary: Get schedule notifications for the current user
 *     tags: [Notifications]
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
 *           default: 10
 *         description: Number of notifications per page
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *         description: Filter by read status
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: Internal server error
 */
router.get('/notifications', 
  authenticate, 
  asyncHandler(availabilityController.getScheduleNotifications)
);

/**
 * @swagger
 * /availability/notifications/{notificationId}/read:
 *   post:
 *     summary: Mark a notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       403:
 *         description: Access denied
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Internal server error
 */
router.post('/notifications/:notificationId/read', 
  authenticate, 
  asyncHandler(availabilityController.markNotificationAsRead)
);

/**
 * @swagger
 * /availability/notifications/read-all:
 *   post:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       500:
 *         description: Internal server error
 */
router.post('/notifications/read-all', 
  authenticate, 
  asyncHandler(availabilityController.markAllNotificationsAsRead)
);

export default router; 