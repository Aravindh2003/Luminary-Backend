import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import 'express-async-errors'; // For async error handling

import { testConnection, initializeDatabase } from './config/database.js';
import logger from './utils/logger.js';
import errorHandler from './middleware/errorHandler.js';
import notFound from './middleware/notFound.js';

// Import routes
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes from './routes/upload.js';
import courseRoutes from './routes/courses.js';
import sessionRoutes from './routes/sessions.js';
import paymentRoutes from './routes/payments.js';
import availabilityRoutes from './routes/availability.js';
import creditRoutes from './routes/credit.js';
import videoRoutes from './routes/videos.js';
import childrenRoutes from './routes/children.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const API_VERSION = process.env.API_VERSION || 'v1';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  // Allow resources (e.g., images) to be consumed cross-origin (frontend at :5173)
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security middleware
app.use(mongoSanitize());
app.use(hpp());

// Rate limiting - more lenient in development
const isDevelopment = process.env.NODE_ENV === 'development';
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100), // Higher limit in development
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Slow down middleware - disabled in development
if (!isDevelopment) {
  app.use(slowDown({
    windowMs: parseInt(process.env.SLOW_DOWN_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    delayAfter: parseInt(process.env.SLOW_DOWN_DELAY_AFTER) || 100, // allow 100 requests per 15 minutes, then...
    delayMs: () => parseInt(process.env.SLOW_DOWN_DELAY_MS) || 500 // begin adding 500ms of delay per request above 100
  }));
}

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await testConnection();
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      database: 'connected',
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Import the proper Swagger configuration
import swaggerSpec from './config/swagger.js';

// Swagger documentation routes
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/admin`, adminRoutes);
app.use(`/api/${API_VERSION}/upload`, uploadRoutes);
app.use(`/api/${API_VERSION}/courses`, courseRoutes);
app.use(`/api/${API_VERSION}/sessions`, sessionRoutes);
app.use(`/api/${API_VERSION}/payments`, paymentRoutes);
app.use(`/api/${API_VERSION}/availability`, availabilityRoutes);
app.use(`/api/${API_VERSION}/credits`, creditRoutes);
app.use(`/api/${API_VERSION}/videos`, videoRoutes);
app.use(`/api/${API_VERSION}/children`, childrenRoutes);

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Global variable to store server instance
let server;

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // Close server
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Close database connection
  try {
    const { prisma } = await import('./config/database.js');
    await prisma.$disconnect();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
  }

  process.exit(0);
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Promise Rejection:', err);
  logger.error('Promise:', promise);
  // Don't exit the process in production, just log the error
  if (process.env.NODE_ENV === 'production') {
    gracefulShutdown('SIGTERM');
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  gracefulShutdown('SIGTERM');
});

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    logger.info('🔄 Starting server initialization...');
    
    // Test database connection
    logger.info('🔄 Testing database connection...');
    await testConnection();
    logger.info('✅ Database connection successful');
    
    // Initialize database
    logger.info('🔄 Initializing database...');
    await initializeDatabase();
    logger.info('✅ Database initialized');
    
    // Start HTTP server
    logger.info('🔄 Starting HTTP server...');
    server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 API Version: ${API_VERSION}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`💚 Health Check: http://localhost:${PORT}/health`);
      logger.info(`🔐 Authentication: /api/${API_VERSION}/auth`);
      logger.info(`👨‍💼 Admin Panel: /api/${API_VERSION}/admin`);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Export for testing
export default app;

// Start the server immediately
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 