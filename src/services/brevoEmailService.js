import SibApiV3Sdk from 'sib-api-v3-sdk';
import crypto from 'crypto';
import logger from '../utils/logger.js';
import { prisma } from '../config/database.js';

const {
  BREVO_API_KEY,
  FROM_EMAIL,
  FROM_NAME,
  FRONTEND_URL
} = process.env;

// Initialize Brevo API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// Email verification token model (in-memory store with expiration)
const emailVerificationTokens = new Map();

// Clean up expired tokens every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of emailVerificationTokens.entries()) {
    if (data.expiresAt < now) {
      emailVerificationTokens.delete(email);
    }
  }
}, 10 * 60 * 1000);

const brevoEmailService = {
  // Generate and store email verification code
  async generateVerificationCode(email) {
    try {
      // Generate a 6-digit verification code
      const verificationCode = crypto.randomInt(100000, 999999).toString();
      
      // Store in memory with 10-minute expiration
      const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
      
      emailVerificationTokens.set(email, {
        code: verificationCode,
        expiresAt,
        attempts: 0,
        maxAttempts: 3
      });

      logger.info(`Email verification code generated for: ${email}`);
      return verificationCode;
    } catch (error) {
      logger.error('Failed to generate verification code:', error);
      throw error;
    }
  },

  // Verify email verification code
  async verifyCode(email, code) {
    try {
      const tokenData = emailVerificationTokens.get(email);
      
      if (!tokenData) {
        return { success: false, message: 'No verification code found for this email' };
      }

      if (tokenData.expiresAt < Date.now()) {
        emailVerificationTokens.delete(email);
        return { success: false, message: 'Verification code has expired' };
      }

      if (tokenData.attempts >= tokenData.maxAttempts) {
        emailVerificationTokens.delete(email);
        return { success: false, message: 'Maximum verification attempts exceeded' };
      }

      if (tokenData.code !== code) {
        tokenData.attempts++;
        return { success: false, message: 'Invalid verification code' };
      }

      // Code is valid, remove from store
      emailVerificationTokens.delete(email);
      return { success: true, message: 'Email verified successfully' };
    } catch (error) {
      logger.error('Failed to verify code:', error);
      throw error;
    }
  },

  // Send email verification code
  async sendVerificationCode(email, firstName, userType = 'parent') {
    try {
      const verificationCode = await this.generateVerificationCode(email);
      
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      
      sendSmtpEmail.subject = 'Verify Your Luminary Email Address ✉️';
      sendSmtpEmail.htmlContent = this.getVerificationEmailTemplate(firstName, verificationCode, userType);
      sendSmtpEmail.sender = { 
        name: FROM_NAME || 'Luminary', 
        email: FROM_EMAIL 
      };
      sendSmtpEmail.to = [{ email, name: firstName }];
      sendSmtpEmail.replyTo = { 
        email: FROM_EMAIL, 
        name: FROM_NAME || 'Luminary' 
      };

      const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
      
      logger.info(`Email verification code sent to ${email}`, { 
        messageId: result.messageId,
        code: verificationCode // Remove this in production
      });
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Failed to send verification email:', error);
      throw error;
    }
  },

  // Resend verification code
  async resendVerificationCode(email, firstName, userType = 'parent') {
    try {
      // Remove existing code if any
      emailVerificationTokens.delete(email);
      
      // Send new code
      return await this.sendVerificationCode(email, firstName, userType);
    } catch (error) {
      logger.error('Failed to resend verification code:', error);
      throw error;
    }
  },

  // Get email verification template
  getVerificationEmailTemplate(firstName, verificationCode, userType) {
    const baseUrl = FRONTEND_URL || 'http://localhost:5173';
    const userTypeText = userType === 'coach' ? 'Coach' : 'Parent';
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email ✉️</h1>
          <p style="color: #bee3f8; margin: 10px 0 0 0; font-size: 16px;">Complete your ${userTypeText} account setup</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #2d3748; margin-bottom: 20px;">Hi ${firstName}!</h2>
          
          <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
            Please use the verification code below to complete your Luminary ${userType} account setup:
          </p>
          
          <div style="background: #f7fafc; border: 2px dashed #4299e1; border-radius: 10px; padding: 30px; text-align: center; margin: 30px 0;">
            <h3 style="color: #2d3748; margin: 0 0 10px 0; font-size: 16px;">Your Verification Code</h3>
            <div style="font-size: 36px; font-weight: bold; color: #4299e1; letter-spacing: 8px; font-family: 'Courier New', monospace;">
              ${verificationCode}
            </div>
            <p style="color: #718096; font-size: 14px; margin: 10px 0 0 0;">
              This code expires in 10 minutes
            </p>
          </div>
          
          <div style="background: #fef5e7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ed8936;">
            <h3 style="color: #c05621; margin: 0 0 15px 0;">⚠️ Security Notice</h3>
            <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
              <li>This code will expire in 10 minutes</li>
              <li>You have 3 attempts to enter the correct code</li>
              <li>If you didn't request this verification, please ignore this email</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/verify-email" 
               style="background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Enter Verification Code
            </a>
          </div>
          
          <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 30px;">
            Need help? Contact us at <a href="mailto:support@luminary.com" style="color: #4299e1;">support@luminary.com</a>
          </p>
        </div>
      </div>
    `;
  },

  // Send welcome email after successful verification
  async sendWelcomeEmail(user, userType = 'parent') {
    try {
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      
      sendSmtpEmail.subject = userType === 'coach' 
        ? 'Welcome to Luminary - Coach Application Received! 🎓'
        : 'Welcome to Luminary - Your Learning Journey Begins! 🎓';
      
      sendSmtpEmail.htmlContent = this.getWelcomeEmailTemplate(user, userType);
      sendSmtpEmail.sender = { 
        name: FROM_NAME || 'Luminary', 
        email: FROM_EMAIL 
      };
      sendSmtpEmail.to = [{ email: user.email, name: user.firstName }];
      sendSmtpEmail.replyTo = { 
        email: FROM_EMAIL, 
        name: FROM_NAME || 'Luminary' 
      };

      const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
      
      logger.info(`Welcome email sent to ${user.email}`, { 
        messageId: result.messageId,
        userType
      });
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      throw error;
    }
  },

  // Get welcome email template
  getWelcomeEmailTemplate(user, userType) {
    const baseUrl = FRONTEND_URL || 'http://localhost:5173';
    
    if (userType === 'coach') {
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Application Received! 🎉</h1>
            <p style="color: #c6f6d5; margin: 10px 0 0 0; font-size: 16px;">Thank you for joining our coaching community</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #2d3748; margin-bottom: 20px;">Hi ${user.firstName}! 👋</h2>
            
            <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
              Thank you for applying to become a coach on Luminary! We're excited about the possibility of having you join our community of educators.
            </p>
            
            <div style="background: #f0fff4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #48bb78;">
              <h3 style="color: #2f855a; margin: 0 0 15px 0;">📋 Verification Process</h3>
              <p style="color: #4a5568; margin: 0 0 10px 0;">Our admin team will review your profile and verify your credentials. This usually takes 24-48 hours.</p>
            </div>
            
            <div style="background: #fef5e7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ed8936;">
              <h3 style="color: #c05621; margin: 0 0 15px 0;">📧 Email Notifications</h3>
              <p style="color: #4a5568; margin: 0 0 10px 0;">You'll receive email updates about your verification status. Please check your inbox regularly, including spam folder.</p>
            </div>
            
            <div style="background: #e6fffa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #38b2ac;">
              <h3 style="color: #2c7a7b; margin: 0 0 15px 0;">🚀 What's Next?</h3>
              <p style="color: #4a5568; margin: 0 0 10px 0;">Once approved, you'll be able to create courses, connect with families, and start your coaching journey!</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/coach/dashboard" 
                 style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Access Dashboard
              </a>
            </div>
            
            <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 30px;">
              Need help? Contact us at <a href="mailto:support@luminary.com" style="color: #48bb78;">support@luminary.com</a>
            </p>
          </div>
        </div>
      `;
    } else {
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Luminary! ✨</h1>
            <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px;">Your learning journey starts here</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #2d3748; margin-bottom: 20px;">Hi ${user.firstName}! 👋</h2>
            
            <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
              Thank you for joining Luminary! We're excited to help you find the perfect coaching experience for your family.
            </p>
            
            <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4299e1;">
              <h3 style="color: #2b6cb0; margin: 0 0 10px 0;">What's Next?</h3>
              <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
                <li>Browse our qualified coaches</li>
                <li>Book sessions that fit your schedule</li>
                <li>Track your learning progress</li>
                <li>Connect with our community</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/parent/dashboard" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Explore Coaches
              </a>
            </div>
            
            <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 30px;">
              Need help? Contact us at <a href="mailto:support@luminary.com" style="color: #4299e1;">support@luminary.com</a>
            </p>
          </div>
        </div>
      `;
    }
  },

  // Test Brevo configuration
  async testConfiguration() {
    try {
      const accountApi = new SibApiV3Sdk.AccountApi();
      const account = await accountApi.getAccount();
      
      logger.info('Brevo configuration is valid', {
        email: account.email,
        plan: account.plan
      });
      
      return { success: true, account };
    } catch (error) {
      logger.error('Brevo configuration test failed:', error);
      throw error;
    }
  }
};

export default brevoEmailService;
