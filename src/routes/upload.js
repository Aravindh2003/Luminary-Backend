import express from 'express';
import fileUploadService from '../services/fileUploadService.js';
import { authenticate } from '../middleware/auth.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/upload/single:
 *   post:
 *     summary: Upload a single file
 *     tags: [File Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               fileType:
 *                 type: string
 *                 enum: [license, resume, video]
 *     responses:
 *       200:
 *         description: File uploaded successfully
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
 *                     file:
 *                       type: object
 *                       properties:
 *                         filename:
 *                           type: string
 *                         url:
 *                           type: string
 *                         size:
 *                           type: number
 */
router.post('/single', 
  authenticate, 
  fileUploadService.uploadSingle('file'),
  fileUploadService.validateFileUpload,
  asyncHandler(async (req, res) => {
    const files = fileUploadService.processUploadedFiles(req);
    
    logger.info(`File uploaded: ${files.file.filename} by user ${req.user.id}`);
    
    return res.status(200).json(
      new ApiResponse(200, files.file, 'File uploaded successfully')
    );
  })
);

/**
 * @swagger
 * /api/v1/upload/coach-files:
 *   post:
 *     summary: Upload coach registration files (license, resume, video)
 *     tags: [File Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               license:
 *                 type: string
 *                 format: binary
 *                 description: License or certification file (max 5MB)
 *               resume:
 *                 type: string
 *                 format: binary
 *                 description: Resume or CV file (max 10MB)
 *               video:
 *                 type: string
 *                 format: binary
 *                 description: Introduction video (max 50MB)
 *     responses:
 *       200:
 *         description: Files uploaded successfully
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
 *                     files:
 *                       type: object
 *                       properties:
 *                         license:
 *                           type: object
 *                         resume:
 *                           type: object
 *                         video:
 *                           type: object
 */
router.post('/coach-files',
  authenticate,
  fileUploadService.uploadCoachFiles(),
  fileUploadService.validateFileUpload,
  asyncHandler(async (req, res) => {
    const files = fileUploadService.processUploadedFiles(req);
    
    logger.info(`Coach files uploaded by user ${req.user.id}: ${Object.keys(files).join(', ')}`);
    
    return res.status(200).json(
      new ApiResponse(200, { files }, 'Coach files uploaded successfully')
    );
  })
);

/**
 * @swagger
 * /api/v1/upload/multiple:
 *   post:
 *     summary: Upload multiple files
 *     tags: [File Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Files uploaded successfully
 */
router.post('/multiple',
  authenticate,
  fileUploadService.uploadMultiple('files', 10),
  fileUploadService.validateFileUpload,
  asyncHandler(async (req, res) => {
    const files = fileUploadService.processUploadedFiles(req);
    
    logger.info(`Multiple files uploaded by user ${req.user.id}: ${files.files.length} files`);
    
    return res.status(200).json(
      new ApiResponse(200, { files: files.files }, 'Files uploaded successfully')
    );
  })
);

/**
 * @swagger
 * /api/v1/upload/delete/{filename}:
 *   delete:
 *     summary: Delete a file
 *     tags: [File Upload]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File deleted successfully
 */
router.delete('/delete/:filename',
  authenticate,
  asyncHandler(async (req, res) => {
    const { filename } = req.params;
    
    const deleted = fileUploadService.deleteFile(filename);
    
    if (!deleted) {
      return res.status(404).json(
        new ApiResponse(404, null, 'File not found')
      );
    }
    
    logger.info(`File deleted: ${filename} by user ${req.user.id}`);
    
    return res.status(200).json(
      new ApiResponse(200, null, 'File deleted successfully')
    );
  })
);

/**
 * @swagger
 * /api/v1/upload/files:
 *   get:
 *     summary: Get list of uploaded files for user
 *     tags: [File Upload]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Files retrieved successfully
 */
router.get('/files',
  authenticate,
  asyncHandler(async (req, res) => {
    // This would typically query the database for user's files
    // For now, return empty array
    return res.status(200).json(
      new ApiResponse(200, { files: [] }, 'Files retrieved successfully')
    );
  })
);

export default router; 