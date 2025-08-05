import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';

// Create uploads directory if it doesn't exist
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    'license': ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    'resume': ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
    'video': ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm']
  };

  const fileType = req.body.fileType || 'resume'; // Default to resume if not specified
  const maxSizes = {
    'license': 5 * 1024 * 1024, // 5MB
    'resume': 10 * 1024 * 1024, // 10MB
    'video': 50 * 1024 * 1024   // 50MB
  };

  // Check file type
  if (!allowedTypes[fileType].includes(file.mimetype)) {
    return cb(new ApiError(400, `Invalid file type for ${fileType}. Allowed types: ${allowedTypes[fileType].join(', ')}`), false);
  }

  // Check file size
  if (file.size > maxSizes[fileType]) {
    return cb(new ApiError(400, `File size too large for ${fileType}. Maximum size: ${maxSizes[fileType] / (1024 * 1024)}MB`), false);
  }

  cb(null, true);
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  }
});

// File upload service functions
const fileUploadService = {
  // Upload single file
  uploadSingle: (fieldName) => {
    return upload.single(fieldName);
  },

  // Upload multiple files
  uploadMultiple: (fieldName, maxCount = 5) => {
    return upload.array(fieldName, maxCount);
  },

  // Upload specific file types
  uploadCoachFiles: () => {
    return upload.fields([
      { name: 'license', maxCount: 1 },
      { name: 'resume', maxCount: 1 },
      { name: 'video', maxCount: 1 }
    ]);
  },

  // Get file URL
  getFileUrl: (filename) => {
    return `http://localhost:5000/uploads/${filename}`;
  },

  // Delete file
  deleteFile: (filename) => {
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`File deleted: ${filename}`);
      return true;
    }
    return false;
  },

  // Validate file upload
  validateFileUpload: (req, res, next) => {
    if (!req.file && !req.files) {
      return next(new ApiError(400, 'No file uploaded'));
    }
    next();
  },

  // Process uploaded files
  processUploadedFiles: (req) => {
    const files = {};
    
    if (req.file) {
      // Single file upload
      files[req.body.fileType || 'file'] = {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUploadService.getFileUrl(req.file.filename)
      };
    } else if (req.files) {
      // Multiple files upload
      Object.keys(req.files).forEach(fieldName => {
        const fileArray = req.files[fieldName];
        if (Array.isArray(fileArray)) {
          files[fieldName] = fileArray.map(file => ({
            filename: file.filename,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            url: fileUploadService.getFileUrl(file.filename)
          }));
        } else {
          files[fieldName] = {
            filename: fileArray.filename,
            originalname: fileArray.originalname,
            mimetype: fileArray.mimetype,
            size: fileArray.size,
            url: fileUploadService.getFileUrl(fileArray.filename)
          };
        }
      });
    }

    return files;
  }
};

export default fileUploadService; 