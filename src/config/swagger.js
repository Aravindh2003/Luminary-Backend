import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Luminary API Documentation',
      version: '1.0.0',
      description: 'Comprehensive API documentation for the Luminary coaching platform',
      contact: {
        name: 'Luminary Support',
        email: 'support@luminary.com',
        url: 'https://luminary.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Development server'
      },
      {
        url: 'https://api.luminary.com/api/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1234567890abcdef' },
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            phone: { type: 'string', example: '+1234567890' },
            role: { type: 'string', enum: ['ADMIN', 'COACH', 'PARENT'], example: 'PARENT' },
            isVerified: { type: 'boolean', example: true },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Coach: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1234567890abcdef' },
            userId: { type: 'string', example: 'clx1234567890abcdef' },
            domain: { type: 'string', example: 'Mathematics' },
            experienceDescription: { type: 'string', example: 'Experienced mathematics educator with 5 years of teaching experience' },
            address: { type: 'string', example: '123 Education Street, Learning City, LC 12345' },
            languages: { type: 'array', items: { type: 'string' }, example: ['English', 'Spanish'] },
            hourlyRate: { type: 'number', format: 'decimal', example: 50.00 },
            bio: { type: 'string', example: 'Passionate mathematics educator...' },
            education: { type: 'array', items: { type: 'object' } },
            certifications: { type: 'array', items: { type: 'object' } },
            specializations: { type: 'array', items: { type: 'string' } },
            availability: { type: 'object' },
            status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'], example: 'PENDING' },
            adminNotes: { type: 'string', example: 'Admin review notes' },
            rating: { type: 'number', format: 'decimal', example: 4.5 },
            totalReviews: { type: 'integer', example: 25 },
            totalStudents: { type: 'integer', example: 50 },
            totalEarnings: { type: 'number', format: 'decimal', example: 2500.00 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Course: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1234567890abcdef' },
            coachId: { type: 'string', example: 'clx1234567890abcdef' },
            title: { type: 'string', example: 'Introduction to Calculus' },
            description: { type: 'string', example: 'A comprehensive introduction to calculus concepts' },
            category: { type: 'string', example: 'Mathematics' },
            level: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], example: 'BEGINNER' },
            duration: { type: 'integer', example: 60, description: 'Duration in minutes' },
            price: { type: 'number', format: 'decimal', example: 50.00 },
            currency: { type: 'string', example: 'USD' },
            isActive: { type: 'boolean', example: true },
            materials: { type: 'array', items: { type: 'object' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Session: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1234567890abcdef' },
            courseId: { type: 'string', example: 'clx1234567890abcdef' },
            coachId: { type: 'string', example: 'clx1234567890abcdef' },
            studentId: { type: 'string', example: 'clx1234567890abcdef' },
            title: { type: 'string', example: 'Calculus Session 1: Limits' },
            description: { type: 'string', example: 'Introduction to limits and continuity' },
            startTime: { type: 'string', format: 'date-time' },
            endTime: { type: 'string', format: 'date-time' },
            duration: { type: 'integer', example: 60, description: 'Duration in minutes' },
            status: { type: 'string', enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'], example: 'SCHEDULED' },
            meetingUrl: { type: 'string', example: 'https://meet.google.com/abc-defg-hij' },
            notes: { type: 'string', example: 'Session notes' },
            recordingUrl: { type: 'string', example: 'https://example.com/recording.mp4' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1234567890abcdef' },
            sessionId: { type: 'string', example: 'clx1234567890abcdef' },
            userId: { type: 'string', example: 'clx1234567890abcdef' },
            stripePaymentId: { type: 'string', example: 'pi_1234567890abcdef' },
            amount: { type: 'number', format: 'decimal', example: 50.00 },
            currency: { type: 'string', example: 'USD' },
            status: { type: 'string', enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'], example: 'SUCCEEDED' },
            paymentMethod: { type: 'string', example: 'card' },
            refunded: { type: 'boolean', example: false },
            refundAmount: { type: 'number', format: 'decimal', example: 25.00 },
            refundReason: { type: 'string', example: 'Student requested partial refund' },
            metadata: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Review: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1234567890abcdef' },
            coachId: { type: 'string', example: 'clx1234567890abcdef' },
            reviewerId: { type: 'string', example: 'clx1234567890abcdef' },
            sessionId: { type: 'string', example: 'clx1234567890abcdef' },
            rating: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
            comment: { type: 'string', example: 'Excellent teaching style and very patient with explanations' },
            isPublic: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1234567890abcdef' },
            userId: { type: 'string', example: 'clx1234567890abcdef' },
            type: { type: 'string', enum: ['SESSION_BOOKED', 'SESSION_REMINDER', 'SESSION_CANCELLED', 'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'REVIEW_RECEIVED', 'COACH_APPROVED', 'COACH_REJECTED', 'GENERAL'], example: 'SESSION_BOOKED' },
            title: { type: 'string', example: 'Session Booked Successfully' },
            message: { type: 'string', example: 'Your session has been booked for next week' },
            isRead: { type: 'boolean', example: false },
            data: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        FileUpload: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1234567890abcdef' },
            userId: { type: 'string', example: 'clx1234567890abcdef' },
            fileName: { type: 'string', example: 'john_doe_resume.pdf' },
            originalName: { type: 'string', example: 'John_Doe_Resume.pdf' },
            fileType: { type: 'string', example: 'resume' },
            fileSize: { type: 'integer', example: 1024000, description: 'File size in bytes' },
            mimeType: { type: 'string', example: 'application/pdf' },
            url: { type: 'string', example: 'https://example-bucket.s3.amazonaws.com/resumes/john_doe_resume.pdf' },
            bucket: { type: 'string', example: 'luminary-uploads' },
            key: { type: 'string', example: 'resumes/john_doe_resume.pdf' },
            isPublic: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
            statusCode: { type: 'integer', example: 400 },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation completed successfully' },
            data: { type: 'object' },
            statusCode: { type: 'integer', example: 200 },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Users',
        description: 'User management endpoints'
      },
      {
        name: 'Coaches',
        description: 'Coach registration and management endpoints'
      },
      {
        name: 'Admin',
        description: 'Admin dashboard and management endpoints'
      },
      {
        name: 'Courses',
        description: 'Course management endpoints'
      },
      {
        name: 'Sessions',
        description: 'Session management endpoints'
      },
      {
        name: 'Payments',
        description: 'Payment processing endpoints'
      },
      {
        name: 'Reviews',
        description: 'Review and rating endpoints'
      },
      {
        name: 'Notifications',
        description: 'Notification management endpoints'
      },
      {
        name: 'Files',
        description: 'File upload and management endpoints'
      },
      {
        name: 'Health',
        description: 'Health check and system status endpoints'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/middleware/*.js'
  ]
};

const specs = swaggerJsdoc(options);

export default specs; 