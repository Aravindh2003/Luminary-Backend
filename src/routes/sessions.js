import express from 'express';
import { body, query, param } from 'express-validator';
import asyncHandler from '../utils/asyncHandler.js';
import validate from '../middleware/validation.js';
import { authenticate, authorize } from '../middleware/auth.js';
import * as sessionController from '../controllers/sessionController.js';

const router = express.Router();

// Validation rules
const createSessionValidation = [
  body('courseId')
    .isUUID()
    .withMessage('Invalid course ID format'),
  body('studentId')
    .isUUID()
    .withMessage('Invalid student ID format'),
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('startTime')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  body('endTime')
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date'),
  body('duration')
    .isInt({ min: 15, max: 480 })
    .withMessage('Duration must be between 15 and 480 minutes')
];

const updateSessionValidation = [
  ...createSessionValidation,
  param('sessionId')
    .isUUID()
    .withMessage('Invalid session ID format')
];

const getSessionsValidation = [
  query('status').optional().isIn(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  query('courseId').optional().isUUID(),
  query('coachId').optional().isUUID(),
  query('studentId').optional().isUUID(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sortBy').optional().isIn(['startTime', 'createdAt', 'title']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
];

// Enhanced session booking validation
const bookSessionValidation = [
  body('courseId')
    .isUUID()
    .withMessage('Invalid course ID format'),
  body('studentId')
    .isUUID()
    .withMessage('Invalid student ID format'),
  body('startTime')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  body('endTime')
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date'),
  body('sessionType')
    .optional()
    .isIn(['ONE_ON_ONE', 'GROUP', 'WORKSHOP'])
    .withMessage('Invalid session type'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes must be less than 500 characters')
];

const bulkBookSessionValidation = [
  body('courseId')
    .isUUID()
    .withMessage('Invalid course ID format'),
  body('studentId')
    .isUUID()
    .withMessage('Invalid student ID format'),
  body('sessions')
    .isArray({ min: 1, max: 10 })
    .withMessage('Must provide 1-10 sessions'),
  body('sessions.*.startTime')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  body('sessions.*.endTime')
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date'),
  body('sessions.*.sessionType')
    .optional()
    .isIn(['ONE_ON_ONE', 'GROUP', 'WORKSHOP'])
    .withMessage('Invalid session type')
];

const rescheduleSessionValidation = [
  param('sessionId')
    .isUUID()
    .withMessage('Invalid session ID format'),
  body('startTime')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  body('endTime')
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Reason must be less than 200 characters')
];

const checkConflictsValidation = [
  query('coachId')
    .isUUID()
    .withMessage('Invalid coach ID format'),
  query('startTime')
    .isISO8601()
    .withMessage('Start time must be a valid ISO 8601 date'),
  query('endTime')
    .isISO8601()
    .withMessage('End time must be a valid ISO 8601 date'),
  query('excludeSessionId')
    .optional()
    .isUUID()
    .withMessage('Invalid session ID format')
];

/**
 * @swagger
 * /sessions:
 *   get:
 *     summary: Get all sessions with filtering
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW]
 *         description: Filter by session status
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by course ID
 *       - in: query
 *         name: coachId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by coach ID
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *           format: uuid
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
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [startTime, createdAt, title]
 *           default: startTime
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
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
 *                     sessions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Session'
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
 */
router.get('/', getSessionsValidation, validate, asyncHandler(sessionController.getSessions));

/**
 * @swagger
 * /sessions/{sessionId}:
 *   get:
 *     summary: Get session details by ID
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Session'
 *                 message:
 *                   type: string
 *       404:
 *         description: Session not found
 */
router.get('/:sessionId',
  [param('sessionId').isUUID().withMessage('Invalid session ID format')],
  validate,
  asyncHandler(sessionController.getSessionById)
);

/**
 * @swagger
 * /sessions:
 *   post:
 *     summary: Create a new session (Coach only)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courseId
 *               - studentId
 *               - title
 *               - startTime
 *               - endTime
 *               - duration
 *             properties:
 *               courseId:
 *                 type: string
 *                 format: uuid
 *                 example: "clx1234567890abcdef"
 *               studentId:
 *                 type: string
 *                 format: uuid
 *                 example: "clx1234567890abcdef"
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *                 example: "Introduction to Calculus"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "First session covering basic calculus concepts"
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T14:00:00Z"
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-01-15T15:00:00Z"
 *               duration:
 *                 type: integer
 *                 minimum: 15
 *                 maximum: 480
 *                 example: 60
 *               meetingUrl:
 *                 type: string
 *                 format: uri
 *                 example: "https://meet.google.com/abc-defg-hij"
 *     responses:
 *       201:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Session'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 */
router.post('/',
  authenticate,
  authorize('COACH'),
  createSessionValidation,
  validate,
  asyncHandler(sessionController.createSession)
);

/**
 * @swagger
 * /sessions/{sessionId}:
 *   put:
 *     summary: Update session (Coach only)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               duration:
 *                 type: integer
 *                 minimum: 15
 *                 maximum: 480
 *               meetingUrl:
 *                 type: string
 *                 format: uri
 *               notes:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       200:
 *         description: Session updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 *       404:
 *         description: Session not found
 */
router.put('/:sessionId',
  authenticate,
  authorize('COACH'),
  updateSessionValidation,
  validate,
  asyncHandler(sessionController.updateSession)
);

/**
 * @swagger
 * /sessions/{sessionId}:
 *   delete:
 *     summary: Cancel session (Coach only)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session cancelled successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 *       404:
 *         description: Session not found
 */
router.delete('/:sessionId',
  authenticate,
  authorize('COACH'),
  [param('sessionId').isUUID().withMessage('Invalid session ID format')],
  validate,
  asyncHandler(sessionController.cancelSession)
);

/**
 * @swagger
 * /sessions/{sessionId}/start:
 *   patch:
 *     summary: Start session (Coach only)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session started successfully
 *       400:
 *         description: Session cannot be started
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 *       404:
 *         description: Session not found
 */
router.patch('/:sessionId/start',
  authenticate,
  authorize('COACH'),
  [param('sessionId').isUUID().withMessage('Invalid session ID format')],
  validate,
  asyncHandler(sessionController.startSession)
);

/**
 * @swagger
 * /sessions/{sessionId}/complete:
 *   patch:
 *     summary: Complete session (Coach only)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Session completion notes
 *               recordingUrl:
 *                 type: string
 *                 format: uri
 *                 description: URL to session recording
 *     responses:
 *       200:
 *         description: Session completed successfully
 *       400:
 *         description: Session cannot be completed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 *       404:
 *         description: Session not found
 */
router.patch('/:sessionId/complete',
  authenticate,
  authorize('COACH'),
  [
    param('sessionId').isUUID().withMessage('Invalid session ID format'),
    body('notes').optional().isString().trim().isLength({ max: 2000 }).withMessage('Notes must be less than 2000 characters'),
    body('recordingUrl').optional().isURL().withMessage('Recording URL must be a valid URL')
  ],
  validate,
  asyncHandler(sessionController.completeSession)
);

/**
 * @swagger
 * /sessions/{sessionId}/join:
 *   post:
 *     summary: Join session (Student/Parent only)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session joined successfully
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
 *                     meetingUrl:
 *                       type: string
 *                       format: uri
 *                     sessionInfo:
 *                       $ref: '#/components/schemas/Session'
 *                 message:
 *                   type: string
 *       400:
 *         description: Cannot join session
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Student/Parent access required
 *       404:
 *         description: Session not found
 */
router.post('/:sessionId/join',
  authenticate,
  authorize('PARENT'),
  [param('sessionId').isUUID().withMessage('Invalid session ID format')],
  validate,
  asyncHandler(sessionController.joinSession)
);

/**
 * @swagger
 * /sessions/{sessionId}/notes:
 *   put:
 *     summary: Update session notes (Coach only)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - notes
 *             properties:
 *               notes:
 *                 type: string
 *                 maxLength: 2000
 *                 example: "Student showed good understanding of calculus concepts"
 *     responses:
 *       200:
 *         description: Session notes updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 *       404:
 *         description: Session not found
 */
router.put('/:sessionId/notes',
  authenticate,
  authorize('COACH'),
  [
    param('sessionId').isUUID().withMessage('Invalid session ID format'),
    body('notes').isString().trim().isLength({ max: 2000 }).withMessage('Notes must be less than 2000 characters')
  ],
  validate,
  asyncHandler(sessionController.updateSessionNotes)
);

/**
 * @swagger
 * /sessions/upcoming:
 *   get:
 *     summary: Get upcoming sessions for current user
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of upcoming sessions to retrieve
 *     responses:
 *       200:
 *         description: Upcoming sessions retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/upcoming',
  authenticate,
  [query('limit').optional().isInt({ min: 1, max: 50 })],
  validate,
  asyncHandler(sessionController.getUpcomingSessions)
);

/**
 * @swagger
 * /sessions/calendar:
 *   get:
 *     summary: Get sessions for calendar view
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for calendar view
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for calendar view
 *     responses:
 *       200:
 *         description: Calendar sessions retrieved successfully
 *       400:
 *         description: Invalid date range
 *       401:
 *         description: Unauthorized
 */
router.get('/calendar',
  authenticate,
  [
    query('startDate').isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').isISO8601().withMessage('End date must be a valid ISO 8601 date')
  ],
  validate,
  asyncHandler(sessionController.getCalendarSessions)
);

// Enhanced Session Booking Routes

/**
 * @swagger
 * /sessions/available-slots:
 *   get:
 *     summary: Get available time slots for booking
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: coachId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coach ID
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date to check availability
 *       - in: query
 *         name: duration
 *         schema:
 *           type: integer
 *           minimum: 15
 *           maximum: 480
 *           default: 60
 *         description: Session duration in minutes
 *     responses:
 *       200:
 *         description: Available slots retrieved successfully
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 */
router.get('/available-slots',
  authenticate,
  checkConflictsValidation,
  validate,
  asyncHandler(sessionController.getAvailableSlots)
);

/**
 * @swagger
 * /sessions/book:
 *   post:
 *     summary: Book a session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courseId
 *               - studentId
 *               - startTime
 *               - endTime
 *             properties:
 *               courseId:
 *                 type: string
 *                 format: uuid
 *                 description: Course ID
 *               studentId:
 *                 type: string
 *                 format: uuid
 *                 description: Student ID
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: Session start time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: Session end time
 *               sessionType:
 *                 type: string
 *                 enum: [ONE_ON_ONE, GROUP, WORKSHOP]
 *                 default: ONE_ON_ONE
 *                 description: Type of session
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Additional notes
 *     responses:
 *       201:
 *         description: Session booked successfully
 *       400:
 *         description: Validation error or scheduling conflict
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Course or student not found
 */
router.post('/book',
  authenticate,
  bookSessionValidation,
  validate,
  asyncHandler(sessionController.bookSession)
);

/**
 * @swagger
 * /sessions/bulk-book:
 *   post:
 *     summary: Book multiple sessions
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courseId
 *               - studentId
 *               - sessions
 *             properties:
 *               courseId:
 *                 type: string
 *                 format: uuid
 *                 description: Course ID
 *               studentId:
 *                 type: string
 *                 format: uuid
 *                 description: Student ID
 *               sessions:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 10
 *                 items:
 *                   type: object
 *                   required:
 *                     - startTime
 *                     - endTime
 *                   properties:
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                       description: Session start time
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                       description: Session end time
 *                     sessionType:
 *                       type: string
 *                       enum: [ONE_ON_ONE, GROUP, WORKSHOP]
 *                       default: ONE_ON_ONE
 *                       description: Type of session
 *     responses:
 *       201:
 *         description: Sessions booked successfully
 *       400:
 *         description: Validation error or scheduling conflict
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Course or student not found
 */
router.post('/bulk-book',
  authenticate,
  bulkBookSessionValidation,
  validate,
  asyncHandler(sessionController.bulkBookSessions)
);

/**
 * @swagger
 * /sessions/conflicts:
 *   get:
 *     summary: Check for scheduling conflicts
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: coachId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coach ID
 *       - in: query
 *         name: startTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start time to check
 *       - in: query
 *         name: endTime
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End time to check
 *       - in: query
 *         name: excludeSessionId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID to exclude from conflict check
 *     responses:
 *       200:
 *         description: Conflict check completed
 *       400:
 *         description: Invalid parameters
 *       401:
 *         description: Unauthorized
 */
router.get('/conflicts',
  authenticate,
  checkConflictsValidation,
  validate,
  asyncHandler(sessionController.checkConflicts)
);

/**
 * @swagger
 * /sessions/{sessionId}/reschedule:
 *   put:
 *     summary: Reschedule a session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startTime
 *               - endTime
 *             properties:
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 description: New start time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 description: New end time
 *               reason:
 *                 type: string
 *                 maxLength: 200
 *                 description: Reason for rescheduling
 *     responses:
 *       200:
 *         description: Session rescheduled successfully
 *       400:
 *         description: Validation error or scheduling conflict
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Session not found
 */
router.put('/:sessionId/reschedule',
  authenticate,
  rescheduleSessionValidation,
  validate,
  asyncHandler(sessionController.rescheduleSession)
);

/**
 * @swagger
 * /sessions/calendar/{userId}:
 *   get:
 *     summary: Get user's session calendar
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for calendar view
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for calendar view
 *     responses:
 *       200:
 *         description: Calendar sessions retrieved successfully
 *       400:
 *         description: Invalid date range
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
router.get('/calendar/:userId',
  authenticate,
  [
    param('userId').isUUID().withMessage('Invalid user ID format'),
    query('startDate').isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').isISO8601().withMessage('End date must be a valid ISO 8601 date')
  ],
  validate,
  asyncHandler(sessionController.getUserCalendar)
);

export default router; 