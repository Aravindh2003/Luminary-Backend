import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";

// Create a single PrismaClient instance that can be shared throughout your app
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
  errorFormat: "pretty",
});

// Handle graceful shutdown
const gracefulShutdown = async () => {
  logger.info("Shutting down Prisma client...");
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// Test database connection
const testConnection = async () => {
  try {
    await prisma.$connect();
    logger.info("✅ Database connection established successfully.");

    // Test a simple query
    await prisma.$queryRaw`SELECT 1`;
    logger.info("✅ Database query test successful.");
  } catch (error) {
    logger.error("❌ Unable to connect to the database:", error);
    process.exit(1);
  }
};

// Initialize database (create tables if they don't exist)
const initializeDatabase = async () => {
  try {
    // This will create the database schema if it doesn't exist
    // In production, you should use migrations instead
    if (process.env.NODE_ENV === "development") {
      logger.info("🔄 Syncing database schema...");
      // Note: In production, use prisma migrate deploy
      // await prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS public`;
    }

    logger.info("✅ Database initialized successfully.");
  } catch (error) {
    logger.error("❌ Database initialization failed:", error);
    throw error;
  }
};

// Health check function
const healthCheck = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "healthy", timestamp: new Date().toISOString() };
  } catch (error) {
    logger.error("Database health check failed:", error);
    return {
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

export { prisma, testConnection, initializeDatabase, healthCheck };
export default prisma;

// Diagnostics: log unique constraints on users table (helps detect legacy unique(email))
export const logUserUniqueConstraints = async () => {
  try {
    const constraints = await prisma.$queryRawUnsafe(`
      SELECT c.conname as name, pg_get_constraintdef(c.oid) as definition
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE t.relname = 'users' AND c.contype = 'u'
      ORDER BY c.conname;
    `);
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT indexname as name, indexdef as definition
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'users' AND indexdef LIKE 'CREATE UNIQUE INDEX%'
      ORDER BY indexname;
    `);
    logger.info("🔎 Users table unique constraints:");
    if (Array.isArray(constraints) && constraints.length > 0) {
      constraints.forEach((r) =>
        logger.info(` - [constraint] ${r.name}: ${r.definition}`)
      );
    } else {
      logger.info(" - [constraint] (none found)");
    }
    logger.info("🔎 Users table unique indexes:");
    if (Array.isArray(indexes) && indexes.length > 0) {
      indexes.forEach((r) =>
        logger.info(` - [index] ${r.name}: ${r.definition}`)
      );
    } else {
      logger.info(" - [index] (none found)");
    }
  } catch (e) {
    logger.warn("Could not list users unique constraints:", e);
  }
};
