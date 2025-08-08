import express from 'express';
import { body, query, param } from 'express-validator';
import asyncHandler from '../utils/asyncHandler.js';
import validate from '../middleware/validation.js';
import { authenticate, requireParent } from '../middleware/auth.js';
import * as childrenController from '../controllers/childrenController.js';
import ApiResponse from '../utils/ApiResponse.js';
import logger from '../utils/logger.js';

const router = express.Router();

// All children routes require authentication
router.use(authenticate);

// Validation rules
const childIdValidation = [
  param('childId').isString().isLength({ min: 20, max: 30 }).withMessage('Invalid child ID format')
];

const createChildValidation = [
  body('firstName').notEmpty().withMessage('First name is required').isLength({ max: 50 }).withMessage('First name must be less than 50 characters'),
  body('lastName').notEmpty().withMessage('Last name is required').isLength({ max: 50 }).withMessage('Last name must be less than 50 characters'),
  body('dateOfBirth').isISO8601().withMessage('Date of birth must be a valid ISO 8601 date'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('currentGrade').optional().isString().isLength({ max: 20 }).withMessage('Current grade must be less than 20 characters'),
  body('schoolName').optional().isString().isLength({ max: 100 }).withMessage('School name must be less than 100 characters'),
  body('specialNeeds').optional().isString().isLength({ max: 500 }).withMessage('Special needs must be less than 500 characters'),
  body('interests').optional().isArray().withMessage('Interests must be an array'),
  body('interests.*').optional().isString().isLength({ max: 50 }).withMessage('Each interest must be less than 50 characters')
];

const updateChildValidation = [
  ...childIdValidation,
  body('firstName').optional().isString().isLength({ max: 50 }).withMessage('First name must be less than 50 characters'),
  body('lastName').optional().isString().isLength({ max: 50 }).withMessage('Last name must be less than 50 characters'),
  body('dateOfBirth').optional().isISO8601().withMessage('Date of birth must be a valid ISO 8601 date'),
  body('gender').optional().isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('currentGrade').optional().isString().isLength({ max: 20 }).withMessage('Current grade must be less than 20 characters'),
  body('schoolName').optional().isString().isLength({ max: 100 }).withMessage('School name must be less than 100 characters'),
  body('specialNeeds').optional().isString().isLength({ max: 500 }).withMessage('Special needs must be less than 500 characters'),
  body('interests').optional().isArray().withMessage('Interests must be an array'),
  body('interests.*').optional().isString().isLength({ max: 50 }).withMessage('Each interest must be less than 50 characters')
];

const getChildrenValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().trim().isLength({ max: 100 }).withMessage('Search term too long'),
  query('sortBy').optional().isIn(['firstName', 'lastName', 'dateOfBirth', 'currentGrade']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
];

/**
 * @swagger
 * components:
 *   schemas:
 *     Child:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Child ID
 *         firstName:
 *           type: string
 *           description: Child's first name
 *         lastName:
 *           type: string
 *           description: Child's last name
 *         dateOfBirth:
 *           type: string
 *           format: date
 *           description: Child's date of birth
 *         gender:
 *           type: string
 *           enum: [male, female, other]
 *           description: Child's gender
 *         currentGrade:
 *           type: string
 *           description: Child's current grade level
 *         schoolName:
 *           type: string
 *           description: Child's school name
 *         specialNeeds:
 *           type: string
 *           description: Any special needs or requirements
 *         interests:
 *           type: array
 *           items:
 *             type: string
 *           description: Child's interests and hobbies
 *         parentId:
 *           type: string
 *           description: Parent's user ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/children:
 *   get:
 *     summary: Get all children for the authenticated parent
 *     tags: [Children]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of children per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for child name
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [firstName, lastName, dateOfBirth, currentGrade]
 *           default: firstName
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Children retrieved successfully
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
 *                     children:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Child'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalItems:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPreviousPage:
 *                           type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Parent access required
 */
router.get('/', getChildrenValidation, validate, asyncHandler(childrenController.getChildren));

/**
 * @swagger
 * /api/v1/children/{childId}:
 *   get:
 *     summary: Get child details by ID
 *     tags: [Children]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: childId
 *         required: true
 *         schema:
 *           type: string
 *         description: Child ID
 *     responses:
 *       200:
 *         description: Child details retrieved successfully
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
 *                   $ref: '#/components/schemas/Child'
 *       404:
 *         description: Child not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Parent access required
 */
router.get('/:childId', childIdValidation, validate, asyncHandler(childrenController.getChildDetails));

/**
 * @swagger
 * /api/v1/children:
 *   post:
 *     summary: Add a new child to parent account
 *     tags: [Children]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - dateOfBirth
 *               - gender
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: Child's first name
 *               lastName:
 *                 type: string
 *                 description: Child's last name
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 description: Child's date of birth
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *                 description: Child's gender
 *               currentGrade:
 *                 type: string
 *                 description: Child's current grade level
 *               schoolName:
 *                 type: string
 *                 description: Child's school name
 *               specialNeeds:
 *                 type: string
 *                 description: Any special needs or requirements
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Child's interests and hobbies
 *     responses:
 *       201:
 *         description: Child added successfully
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
 *                   $ref: '#/components/schemas/Child'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Parent access required
 */
router.post('/', requireParent, createChildValidation, validate, asyncHandler(childrenController.addChild));

/**
 * @swagger
 * /api/v1/children/{childId}:
 *   put:
 *     summary: Update child information
 *     tags: [Children]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: childId
 *         required: true
 *         schema:
 *           type: string
 *         description: Child ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: Child's first name
 *               lastName:
 *                 type: string
 *                 description: Child's last name
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *                 description: Child's date of birth
 *               gender:
 *                 type: string
 *                 enum: [male, female, other]
 *                 description: Child's gender
 *               currentGrade:
 *                 type: string
 *                 description: Child's current grade level
 *               schoolName:
 *                 type: string
 *                 description: Child's school name
 *               specialNeeds:
 *                 type: string
 *                 description: Any special needs or requirements
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Child's interests and hobbies
 *     responses:
 *       200:
 *         description: Child updated successfully
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
 *                   $ref: '#/components/schemas/Child'
 *       404:
 *         description: Child not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Parent access required
 */
router.put('/:childId', requireParent, updateChildValidation, validate, asyncHandler(childrenController.updateChild));

/**
 * @swagger
 * /api/v1/children/{childId}:
 *   delete:
 *     summary: Remove a child from parent account
 *     tags: [Children]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: childId
 *         required: true
 *         schema:
 *           type: string
 *         description: Child ID
 *     responses:
 *       200:
 *         description: Child removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Child not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Parent access required
 */
router.delete('/:childId', requireParent, childIdValidation, validate, asyncHandler(childrenController.removeChild));

/**
 * @swagger
 * /api/v1/children/{childId}/progress:
 *   get:
 *     summary: Get child's learning progress
 *     tags: [Children]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: childId
 *         required: true
 *         schema:
 *           type: string
 *         description: Child ID
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year]
 *           default: month
 *         description: Progress period
 *     responses:
 *       200:
 *         description: Child progress retrieved successfully
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
 *                     totalSessions:
 *                       type: number
 *                     completedSessions:
 *                       type: number
 *                     totalHours:
 *                       type: number
 *                     averageRating:
 *                       type: number
 *                     coursesEnrolled:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           courseId:
 *                             type: string
 *                           courseTitle:
 *                             type: string
 *                           progress:
 *                             type: number
 *                           lastSession:
 *                             type: string
 *                             format: date-time
 *       404:
 *         description: Child not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Parent access required
 */
router.get('/:childId/progress', childIdValidation, validate, asyncHandler(childrenController.getChildProgress));

/**
 * @swagger
 * /api/v1/children/{childId}/enrollments:
 *   get:
 *     summary: Get child's course enrollments
 *     tags: [Children]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: childId
 *         required: true
 *         schema:
 *           type: string
 *         description: Child ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, cancelled]
 *         description: Filter by enrollment status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of enrollments per page
 *     responses:
 *       200:
 *         description: Child enrollments retrieved successfully
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
 *                     enrollments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           courseId:
 *                             type: string
 *                           courseTitle:
 *                             type: string
 *                           coachName:
 *                             type: string
 *                           enrolledAt:
 *                             type: string
 *                             format: date-time
 *                           status:
 *                             type: string
 *                           progress:
 *                             type: number
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalItems:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPreviousPage:
 *                           type: boolean
 *       404:
 *         description: Child not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Parent access required
 */
router.get('/:childId/enrollments', childIdValidation, validate, asyncHandler(childrenController.getChildEnrollments));

export default router; 