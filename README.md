# Luminary Backend API

A production-ready Node.js backend for the Luminary coaching platform, built with Express.js, PostgreSQL, and Prisma ORM.

## 🚀 Features

- **Authentication System**: JWT-based auth with refresh tokens, email verification, password reset
- **Multi-Role Support**: Admin, Coach, and Parent roles with proper authorization
- **File Upload System**: AWS S3 integration for license, resume, and video uploads
- **Email Notifications**: Free SMTP service integration for automated emails
- **Admin Dashboard**: Complete coach management and approval workflow
- **Payment Integration**: Stripe payment processing (ready for implementation)
- **Security**: Rate limiting, CORS, helmet, input validation, and sanitization
- **API Documentation**: Swagger/OpenAPI documentation
- **Logging**: Winston-based logging with file rotation
- **Testing**: Jest test framework setup
- **Production Ready**: Docker support, CI/CD ready, monitoring

## 📋 Prerequisites

- Node.js 18+ and npm 8+
- PostgreSQL 12+
- Stripe account (for payments)

## 🛠️ Installation

1. **Clone and navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration values.

4. **Database setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push database schema
   npm run db:push
   
   # Seed database with initial data
   npm run db:seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 🔧 Environment Configuration

### Required Environment Variables

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/luminary_db"

# JWT Secrets
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# Email (Free Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com

# AWS S3
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=your-bucket-name

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
```

### Email Setup (Free Gmail)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use the generated password in `SMTP_PASS`

## 📚 API Documentation

### Authentication Endpoints

#### Parent Registration
```http
POST /api/v1/auth/register/parent
Content-Type: application/json

{
  "email": "parent@example.com",
  "password": "Password123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890"
}
```

#### Coach Registration (with file uploads)
```http
POST /api/v1/auth/register/coach
Content-Type: multipart/form-data

{
  "email": "coach@example.com",
  "password": "Password123!",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+1234567890",
  "domain": "Mathematics",
  "experience": "5 years of teaching experience...",
  "address": "123 Main St, City, State",
  "languages": ["English", "Spanish"],
  "license": [file], // Optional
  "resume": [file],  // Optional
  "video": [file]    // Optional
}
```

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123!"
}
```

#### Admin Login
```http
POST /api/v1/auth/admin/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "AdminPassword123!"
}
```

### Admin Endpoints

#### Get Dashboard Statistics
```http
GET /api/v1/admin/dashboard/stats
Authorization: Bearer <admin_token>
```

#### Get All Coaches
```http
GET /api/v1/admin/coaches?status=pending&search=john&page=1&limit=10
Authorization: Bearer <admin_token>
```

#### Approve Coach
```http
POST /api/v1/admin/coaches/{coachId}/approve
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "adminNotes": "Excellent qualifications"
}
```

#### Reject Coach
```http
POST /api/v1/admin/coaches/{coachId}/reject
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "rejectionReason": "Insufficient documentation",
  "adminNotes": "Please provide additional certifications"
}
```

## 🗄️ Database Schema

### Key Models

- **User**: Base user model with authentication fields
- **Coach**: Coach-specific data with approval workflow
- **Course**: Course management (ready for implementation)
- **Session**: Session booking and management
- **Payment**: Stripe payment integration
- **Review**: Rating and review system
- **Notification**: In-app notifications
- **FileUpload**: File upload tracking

### Coach Approval Workflow

1. Coach registers with personal/professional info + optional files
2. Status set to `PENDING`
3. Admin reviews application in dashboard
4. Admin can `APPROVE` or `REJECT` with notes
5. Email notifications sent automatically
6. Approved coaches can access coach dashboard

## 🔐 Security Features

- **Password Hashing**: bcrypt with 12 rounds
- **JWT Authentication**: Access + refresh token pattern
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: express-validator with custom rules
- **SQL Injection Protection**: Prisma ORM parameterized queries
- **XSS Protection**: Helmet.js security headers
- **CORS**: Configurable cross-origin resource sharing
- **File Upload Security**: MIME type and size validation

## 📧 Email Templates

Professional HTML email templates for:
- Welcome emails (Parent/Coach)
- Coach application notifications
- Approval/rejection notifications
- Password reset emails
- Email verification

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Generate coverage report
npm test -- --coverage
```

## 🚀 Deployment

### Docker Deployment

```bash
# Build Docker image
npm run docker:build

# Run Docker container
npm run docker:run
```

### Environment-specific Commands

```bash
# Development
npm run dev

# Production
npm start

# Database migrations (production)
npm run db:migrate:deploy
```

## 📊 Monitoring & Logging

- **Winston Logger**: Structured logging with file rotation
- **Health Check**: `/health` endpoint for monitoring
- **Error Tracking**: Comprehensive error handling and logging
- **Performance Monitoring**: Request logging and timing

## 🔧 Development Scripts

```bash
npm run dev          # Start development server with nodemon
npm run build        # Build and validate project
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with initial data
npm run db:studio    # Open Prisma Studio
npm test             # Run tests
npm run docs         # Generate API documentation
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── server.js        # Main server file
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── migrations/      # Database migrations
├── logs/                # Log files
├── tests/               # Test files
├── docs/                # Documentation
├── .env.example         # Environment template
├── package.json         # Dependencies and scripts
└── README.md           # This file
```

## 🤝 Contributing

1. Follow the existing code style and patterns
2. Write tests for new features
3. Update documentation for API changes
4. Use conventional commit messages
5. Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Email: support@luminary.com
- Documentation: `/api-docs` endpoint
- Health Check: `/health` endpoint

## 🔄 API Versioning

Current API version: `v1`
Base URL: `/api/v1`

All endpoints are versioned to ensure backward compatibility.

## Stripe Payment Integration (Production-Ready)

### 1. Payment Flow Overview
- Payment intents are created on the backend and returned to the frontend for Stripe.js.
- Payment confirmation is handled via backend endpoints and Stripe webhooks.
- Refunds and payment failures are handled and logged.

### 2. Webhook Endpoint
- **Endpoint:** `POST /api/v1/payments/webhook/stripe`
- **Purpose:** Receives and verifies Stripe webhook events for payment status updates.
- **Security:**
  - Verifies Stripe signature using `STRIPE_WEBHOOK_SECRET`.
  - Only processes events from Stripe.

### 3. Supported Events
- `payment_intent.succeeded`: Marks payment as COMPLETED in the database.
- `payment_intent.payment_failed`: Marks payment as FAILED in the database.
- (Extend as needed for refunds, disputes, etc.)

### 4. Setup Instructions
1. **Set environment variables:**
   - `STRIPE_SECRET_KEY` (your Stripe secret key)
   - `STRIPE_WEBHOOK_SECRET` (from Stripe Dashboard after adding webhook endpoint)
2. **Add webhook endpoint in Stripe Dashboard:**
   - URL: `https://yourdomain.com/api/v1/payments/webhook/stripe` (use your public server URL)
   - Select relevant events (at minimum: payment_intent.succeeded, payment_intent.payment_failed)
3. **Deploy backend with HTTPS in production.**
4. **Test webhook using Stripe CLI or Dashboard.**

### 5. Security & Best Practices
- Never expose your Stripe secret key to the frontend.
- Always verify webhook signatures.
- Log all payment and webhook events for audit.
- Use Stripe test mode for development and live keys for production.

### 6. Extending Event Handling
- To handle more Stripe events (refunds, disputes, etc.), add cases to the webhook handler in `src/routes/payments.js`.

---
