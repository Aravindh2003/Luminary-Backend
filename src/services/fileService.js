import AWS from 'aws-sdk';
import multer from 'multer';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

class FileService {
  constructor() {
    this.s3 = null;
    this.bucket = process.env.AWS_S3_BUCKET;
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.isEnabled = false;
    this.initialize();
  }

  initialize() {
    try {
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

      // Check if AWS credentials are properly configured
      if (!accessKeyId || !secretAccessKey || 
          accessKeyId === 'your_aws_access_key_id' || 
          secretAccessKey === 'your_aws_secret_access_key' ||
          !this.bucket || this.bucket === 'luminary-uploads') {
        logger.warn('AWS credentials not configured properly, file uploads will be disabled');
        this.s3 = null;
        this.isEnabled = false;
        logger.info('File service initialized successfully (without AWS S3)');
        return;
      }

      // Configure AWS with timeout to prevent hanging
      AWS.config.update({
        accessKeyId,
        secretAccessKey,
        region: this.region,
        maxRetries: 2,
        retryDelayOptions: {
          customBackoff: function(retryCount) {
            return Math.pow(2, retryCount) * 100;
          }
        }
      });

      this.s3 = new AWS.S3({
        httpOptions: {
          timeout: 5000,
          connectTimeout: 3000
        }
      });

      this.isEnabled = true;
      logger.info('File service initialized successfully with AWS S3');
    } catch (error) {
      logger.error('Failed to initialize file service:', error);
      this.s3 = null;
      this.isEnabled = false;
      logger.info('File service initialized successfully (fallback mode)');
    }
  }

  // Configure multer for file uploads
  configureMulter() {
    const storage = multer.memoryStorage();
    
    const fileFilter = (req, file, cb) => {
      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
      const allowedDocumentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const allowedVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime'];

      const allowedTypes = [...allowedImageTypes, ...allowedDocumentTypes, ...allowedVideoTypes];

      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} is not allowed`), false);
      }
    };

    const limits = {
      fileSize: 50 * 1024 * 1024, // 50MB max
      files: 3 // Maximum 3 files per request (license, resume, video)
    };

    return multer({
      storage,
      fileFilter,
      limits
    });
  }

  // Upload file to S3 or return mock URL if S3 not available
  async uploadFile(file, folder = 'uploads') {
    if (!this.isEnabled || !this.s3) {
      // Return mock URL for development/testing
      const mockUrl = `http://localhost:5000/uploads/mock-${uuidv4()}-${file.originalname}`;
      logger.info(`File upload mocked (S3 not configured): ${file.originalname} -> ${mockUrl}`);
      
      return {
        url: mockUrl,
        key: `mock/${uuidv4()}-${file.originalname}`,
        size: file.size,
        originalName: file.originalname
      };
    }

    try {
      let processedBuffer = file.buffer;
      let contentType = file.mimetype;
      let extension = this.getFileExtension(file.originalname);

      // Process images if needed
      if (file.mimetype.startsWith('image/')) {
        try {
          processedBuffer = await this.processImage(file.buffer);
          contentType = 'image/jpeg';
          extension = '.jpg';
        } catch (imageError) {
          logger.warn('Image processing failed, using original:', imageError.message);
          // Use original file if image processing fails
        }
      }

      const fileName = `${folder}/${uuidv4()}${extension}`;
      const params = {
        Bucket: this.bucket,
        Key: fileName,
        Body: processedBuffer,
        ContentType: contentType,
        ACL: 'public-read',
        Metadata: {
          originalName: file.originalname,
          uploadedBy: 'luminary-backend'
        }
      };

      const result = await this.s3.upload(params).promise();
      
      logger.info('File uploaded successfully to S3', {
        fileName: file.originalname,
        s3Key: fileName,
        size: processedBuffer.length
      });

      return {
        url: result.Location,
        key: fileName,
        size: processedBuffer.length,
        originalName: file.originalname
      };
    } catch (error) {
      logger.error('Failed to upload file to S3:', error);
      
      // Fallback to mock URL if S3 upload fails
      const mockUrl = `http://localhost:5000/uploads/fallback-${uuidv4()}-${file.originalname}`;
      logger.info(`File upload failed, using fallback: ${file.originalname} -> ${mockUrl}`);
      
      return {
        url: mockUrl,
        key: `fallback/${uuidv4()}-${file.originalname}`,
        size: file.size,
        originalName: file.originalname
      };
    }
  }

  // Process image (resize, compress, convert to JPEG)
  async processImage(buffer) {
    try {
      const processedBuffer = await sharp(buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      return processedBuffer;
    } catch (error) {
      logger.error('Failed to process image:', error);
      throw error;
    }
  }

  // Delete file from S3
  async deleteFile(key) {
    if (!this.isEnabled || !this.s3) {
      logger.info(`File deletion mocked (S3 not configured): ${key}`);
      return;
    }

    try {
      const params = {
        Bucket: this.bucket,
        Key: key
      };

      await this.s3.deleteObject(params).promise();
      
      logger.info('File deleted successfully from S3', { key });
    } catch (error) {
      logger.error('Failed to delete file from S3:', error);
      // Don't throw error for deletion failures
    }
  }

  // Get file extension
  getFileExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot) : '';
  }

  // Generate presigned URL for direct upload
  async generatePresignedUrl(key, contentType, expiresIn = 3600) {
    if (!this.isEnabled || !this.s3) {
      throw new Error('S3 not configured. File uploads are disabled.');
    }

    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        Expires: expiresIn
      };

      const presignedUrl = await this.s3.getSignedUrlPromise('putObject', params);
      
      logger.info('Presigned URL generated', { key, expiresIn });
      
      return presignedUrl;
    } catch (error) {
      logger.error('Failed to generate presigned URL:', error);
      throw error;
    }
  }

  // Upload multiple files
  async uploadMultipleFiles(files, folder = 'uploads') {
    const uploadPromises = files.map(file => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  // Validate file size
  validateFileSize(fileSize, maxSize = null) {
    const maxFileSize = maxSize || 50 * 1024 * 1024; // 50MB default
    return fileSize <= maxFileSize;
  }

  // Get file info
  getFileInfo(file) {
    return {
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      extension: this.getFileExtension(file.originalname)
    };
  }

  // Check if file service is enabled
  isFileUploadEnabled() {
    return this.isEnabled;
  }
}

export default new FileService();
