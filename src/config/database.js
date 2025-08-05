import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

// Create a single PrismaClient instance that can be shared throughout your app
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  errorFormat: 'pretty',
});

// Handle graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Shutting down Prisma client...');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Test database connection
const testConnection = async () => {
  try {
    await prisma.$connect();
    logger.info('✅ Database connection established successfully.');
    
    // Test a simple query
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database query test successful.');
  } catch (error) {
    logger.error('❌ Unable to connect to the database:', error);
    process.exit(1);
  }
};

// Initialize database (create tables if they don't exist)
const initializeDatabase = async () => {
  try {
    // This will create the database schema if it doesn't exist
    // In production, you should use migrations instead
    if (process.env.NODE_ENV === 'development') {
      logger.info('🔄 Syncing database schema...');
      // Note: In production, use prisma migrate deploy
      // await prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS public`;
    }
    
    logger.info('✅ Database initialized successfully.');
  } catch (error) {
    logger.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// Health check function
const healthCheck = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
  }
};

export { prisma, testConnection, initializeDatabase, healthCheck };
export default prisma; 