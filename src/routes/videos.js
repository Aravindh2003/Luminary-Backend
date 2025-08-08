import express from 'express';
import { body, query, param } from 'express-validator';
import asyncHandler from '../utils/asyncHandler.js';
import validate from '../middleware/validation.js';
import { authenticate, requireCoach } from '../middleware/auth.js';
import * as videoController from '../controllers/videoController.js';
import ApiResponse from '../utils/ApiResponse.js';
import logger from '../utils/logger.js';

const router = express.Router();

// All video routes require authentication
router.use(authenticate);

// Validation rules
const videoIdValidation = [
  param('videoId').isString().isLength({ min: 20, max: 30 }).withMessage('Invalid video ID format')
];

const createVideoValidation = [
  body('title').notEmpty().withMessage('Video title is required').isLength({ max: 200 }).withMessage('Title must be less than 200 characters'),
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('courseId').optional().isString().isLength({ min: 20, max: 30 }).withMessage('Invalid course ID format'),
  body('category').optional().isString().isLength({ max: 100 }).withMessage('Category must be less than 100 characters'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
  body('thumbnail').optional().isString().withMessage('Thumbnail must be a valid URL')
];

const updateVideoValidation = [
  ...videoIdValidation,
  body('title').optional().isString().isLength({ max: 200 }).withMessage('Title must be less than 200 characters'),
  body('description').optional().isString().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('category').optional().isString().isLength({ max: 100 }).withMessage('Category must be less than 100 characters'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
  body('thumbnail').optional().isString().withMessage('Thumbnail must be a valid URL')
];

const getVideosValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().isString().trim().isLength({ max: 100 }).withMessage('Search term too long'),
  query('category').optional().isString().trim().withMessage('Invalid category filter'),
  query('sortBy').optional().isIn(['createdAt', 'title', 'views', 'duration']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean')
];

/**
 * @swagger
 * components:
 *   schemas:
 *     Video:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Video ID
 *         title:
 *           type: string
 *           description: Video title
 *         description:
 *           type: string
 *           description: Video description
 *         url:
 *           type: string
 *           description: Video URL
 *         thumbnail:
 *           type: string
 *           description: Video thumbnail URL
 *         duration:
 *           type: number
 *           description: Video duration in seconds
 *         size:
 *           type: number
 *           description: Video file size in bytes
 *         views:
 *           type: number
 *           description: Number of views
 *         category:
 *           type: string
 *           description: Video category
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Video tags
 *         isPublic:
 *           type: boolean
 *           description: Whether video is public
 *         coachId:
 *           type: string
 *           description: Coach ID who uploaded the video
 *         courseId:
 *           type: string
 *           description: Associated course ID (optional)
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/videos:
 *   get:
 *     summary: Get all videos for the authenticated coach
 *     tags: [Videos]
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
 *         description: Number of videos per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for video title or description
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, title, views, duration]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Videos retrieved successfully
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
 *                     videos:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Video'
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
 *         description: Coach access required
 */
router.get('/', getVideosValidation, validate, asyncHandler(videoController.getVideos));

/**
 * @swagger
 * /api/v1/videos/{videoId}:
 *   get:
 *     summary: Get video details by ID
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video details retrieved successfully
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
 *                   $ref: '#/components/schemas/Video'
 *       404:
 *         description: Video not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 */
router.get('/:videoId', videoIdValidation, validate, asyncHandler(videoController.getVideoDetails));

/**
 * @swagger
 * /api/v1/videos:
 *   post:
 *     summary: Upload a new video
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Video file (max 500MB)
 *               title:
 *                 type: string
 *                 description: Video title
 *               description:
 *                 type: string
 *                 description: Video description
 *               category:
 *                 type: string
 *                 description: Video category
 *               tags:
 *                 type: string
 *                 description: Comma-separated tags
 *               isPublic:
 *                 type: boolean
 *                 description: Whether video is public
 *               courseId:
 *                 type: string
 *                 description: Associated course ID
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: Video thumbnail (optional)
 *     responses:
 *       201:
 *         description: Video uploaded successfully
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
 *                   $ref: '#/components/schemas/Video'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 */
router.post('/', requireCoach, createVideoValidation, validate, asyncHandler(videoController.uploadVideo));

/**
 * @swagger
 * /api/v1/videos/{videoId}:
 *   put:
 *     summary: Update video metadata
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Video title
 *               description:
 *                 type: string
 *                 description: Video description
 *               category:
 *                 type: string
 *                 description: Video category
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Video tags
 *               isPublic:
 *                 type: boolean
 *                 description: Whether video is public
 *               thumbnail:
 *                 type: string
 *                 description: Thumbnail URL
 *     responses:
 *       200:
 *         description: Video updated successfully
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
 *                   $ref: '#/components/schemas/Video'
 *       404:
 *         description: Video not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 */
router.put('/:videoId', requireCoach, updateVideoValidation, validate, asyncHandler(videoController.updateVideo));

/**
 * @swagger
 * /api/v1/videos/{videoId}:
 *   delete:
 *     summary: Delete a video
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     responses:
 *       200:
 *         description: Video deleted successfully
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
 *         description: Video not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 */
router.delete('/:videoId', requireCoach, videoIdValidation, validate, asyncHandler(videoController.deleteVideo));

/**
 * @swagger
 * /api/v1/videos/{videoId}/thumbnail:
 *   post:
 *     summary: Upload video thumbnail
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               thumbnail:
 *                 type: string
 *                 format: binary
 *                 description: Thumbnail image (max 5MB)
 *     responses:
 *       200:
 *         description: Thumbnail uploaded successfully
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
 *                     thumbnail:
 *                       type: string
 *                       description: Thumbnail URL
 *       404:
 *         description: Video not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 */
router.post('/:videoId/thumbnail', requireCoach, videoIdValidation, validate, asyncHandler(videoController.uploadThumbnail));

/**
 * @swagger
 * /api/v1/videos/{videoId}/stream:
 *   get:
 *     summary: Stream video content
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *       - in: header
 *         name: Range
 *         schema:
 *           type: string
 *         description: HTTP Range header for video streaming
 *     responses:
 *       200:
 *         description: Video stream
 *         content:
 *           video/*:
 *             schema:
 *               type: string
 *               format: binary
 *       206:
 *         description: Partial video stream
 *       404:
 *         description: Video not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:videoId/stream', videoIdValidation, validate, asyncHandler(videoController.streamVideo));

/**
 * @swagger
 * /api/v1/videos/{videoId}/analytics:
 *   post:
 *     summary: Track video view
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: videoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Video ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               watchTime:
 *                 type: number
 *                 description: Watch time in seconds
 *               progress:
 *                 type: number
 *                 description: Video progress percentage (0-100)
 *     responses:
 *       200:
 *         description: View tracked successfully
 *       404:
 *         description: Video not found
 *       401:
 *         description: Unauthorized
 */
router.post('/:videoId/analytics', videoIdValidation, validate, asyncHandler(videoController.trackVideoView));

/**
 * @swagger
 * /api/v1/videos/analytics:
 *   get:
 *     summary: Get video analytics for coach
 *     tags: [Videos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *           default: month
 *         description: Analytics period
 *     responses:
 *       200:
 *         description: Video analytics retrieved successfully
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
 *                     totalViews:
 *                       type: number
 *                     totalWatchTime:
 *                       type: number
 *                     averageWatchTime:
 *                       type: number
 *                     topVideos:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           videoId:
 *                             type: string
 *                           title:
 *                             type: string
 *                           views:
 *                             type: number
 *                           watchTime:
 *                             type: number
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Coach access required
 */
router.get('/analytics', requireCoach, asyncHandler(videoController.getVideoAnalytics));

export default router; 