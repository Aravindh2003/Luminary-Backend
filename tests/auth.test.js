import request from 'supertest';
import app from '../src/server.js';
import { prisma } from '../src/config/database.js';

describe('Authentication Endpoints', () => {
  beforeAll(async () => {
    // Clean up test data before running tests
    await prisma.coach.deleteMany({
      where: {
        user: {
          email: {
            contains: 'test'
          }
        }
      }
    });
    
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test'
        }
      }
    });
  });

  afterAll(async () => {
    // Clean up test data after running tests
    await prisma.coach.deleteMany({
      where: {
        user: {
          email: {
            contains: 'test'
          }
        }
      }
    });
    
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test'
        }
      }
    });
    
    await prisma.$disconnect();
  });

  describe('POST /api/v1/auth/register/parent', () => {
    it('should register a new parent successfully', async () => {
      const parentData = {
        email: 'testparent@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'Parent',
        phone: '+1234567890'
      };

      const response = await request(app)
        .post('/api/v1/auth/register/parent')
        .send(parentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(parentData.email);
      expect(response.body.data.user.role).toBe('PARENT');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should not register parent with invalid email', async () => {
      const parentData = {
        email: 'invalid-email',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'Parent',
        phone: '+1234567890'
      };

      const response = await request(app)
        .post('/api/v1/auth/register/parent')
        .send(parentData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should not register parent with weak password', async () => {
      const parentData = {
        email: 'testparent2@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'Parent',
        phone: '+1234567890'
      };

      const response = await request(app)
        .post('/api/v1/auth/register/parent')
        .send(parentData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/register/coach', () => {
    it('should register a new coach successfully', async () => {
      const coachData = {
        email: 'testcoach@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'Coach',
        phone: '+1234567891',
        domain: 'Mathematics',
        experience: 'I have 5 years of teaching experience in mathematics.',
        address: '123 Test Street, Test City, TC 12345',
        languages: ['English', 'Spanish']
      };

      const response = await request(app)
        .post('/api/v1/auth/register/coach')
        .field('email', coachData.email)
        .field('password', coachData.password)
        .field('firstName', coachData.firstName)
        .field('lastName', coachData.lastName)
        .field('phone', coachData.phone)
        .field('domain', coachData.domain)
        .field('experience', coachData.experience)
        .field('address', coachData.address)
        .field('languages', JSON.stringify(coachData.languages))
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(coachData.email);
      expect(response.body.data.user.role).toBe('COACH');
      expect(response.body.data.coach.status).toBe('PENDING');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should not register coach without required fields', async () => {
      const coachData = {
        email: 'testcoach2@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'Coach'
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/v1/auth/register/coach')
        .field('email', coachData.email)
        .field('password', coachData.password)
        .field('firstName', coachData.firstName)
        .field('lastName', coachData.lastName)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let testUser;

    beforeAll(async () => {
      // Create a test user for login tests
      const response = await request(app)
        .post('/api/v1/auth/register/parent')
        .send({
          email: 'logintest@example.com',
          password: 'Password123!',
          firstName: 'Login',
          lastName: 'Test',
          phone: '+1234567892'
        });
      
      testUser = response.body.data.user;
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'Password123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('logintest@example.com');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should not login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/admin/login', () => {
    it('should login admin successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/admin/login')
        .send({
          email: process.env.ADMIN_EMAIL || 'admin@luminary.com',
          password: process.env.ADMIN_PASSWORD || 'AdminPassword123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('ADMIN');
      expect(response.body.data.accessToken).toBeDefined();
    });

    it('should not login non-admin user to admin endpoint', async () => {
      const response = await request(app)
        .post('/api/v1/auth/admin/login')
        .send({
          email: 'logintest@example.com',
          password: 'Password123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/profile', () => {
    let accessToken;

    beforeAll(async () => {
      // Login to get access token
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'Password123!'
        });
      
      accessToken = response.body.data.accessToken;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('logintest@example.com');
    });

    it('should not get profile without token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should not get profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
