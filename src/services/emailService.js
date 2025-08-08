import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  FROM_EMAIL,
  FROM_NAME,
  FRONTEND_URL
} = process.env;

// Create transporter using SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// Email templates matching frontend workflow

const getEmailTemplate = (type, data) => {
  const baseUrl = FRONTEND_URL || 'http://localhost:3000';
  
  switch (type) {
    case 'welcome_parent':
      return {
        subject: 'Welcome to Luminary - Your Learning Journey Begins! 🎓',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Luminary! ✨</h1>
              <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px;">Your learning journey starts here</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #2d3748; margin-bottom: 20px;">Hi ${data.firstName}! 👋</h2>
              
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
                <a href="${baseUrl}/verify-email/${data.emailVerificationToken}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Verify Your Email
                </a>
              </div>
              
              <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 30px;">
                Need help? Contact us at <a href="mailto:support@luminary.com" style="color: #4299e1;">support@luminary.com</a>
              </p>
            </div>
          </div>
        `
      };

    case 'coach_application':
      return {
        subject: 'Coach Application Received - Welcome to Luminary! 🎓',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Application Received! 🎉</h1>
              <p style="color: #c6f6d5; margin: 10px 0 0 0; font-size: 16px;">Thank you for joining our coaching community</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #2d3748; margin-bottom: 20px;">Hi ${data.firstName}! 👋</h2>
              
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
                <a href="${baseUrl}/verify-email/${data.emailVerificationToken}" 
                   style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Verify Your Email
                </a>
              </div>
              
              <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 30px;">
                Need help? Contact us at <a href="mailto:support@luminary.com" style="color: #48bb78;">support@luminary.com</a>
              </p>
            </div>
          </div>
        `
      };

    case 'coach_approved':
      return {
        subject: 'Congratulations! Your Coach Application Has Been Approved! 🎉',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
              <p style="color: #c6f6d5; margin: 10px 0 0 0; font-size: 16px;">You're now an approved Luminary coach!</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #2d3748; margin-bottom: 20px;">Hi ${data.firstName}! 🎓</h2>
              
              <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
                Great news! Your coach application has been approved. Welcome to the Luminary coaching community!
              </p>
              
              <div style="background: #f0fff4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #48bb78;">
                <h3 style="color: #2f855a; margin: 0 0 15px 0;">✅ You can now:</h3>
                <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
                  <li>Access your coach dashboard</li>
                  <li>Create and manage courses</li>
                  <li>Schedule sessions with students</li>
                  <li>Start earning from your expertise</li>
                </ul>
              </div>
              
              ${data.adminNotes ? `
              <div style="background: #e6fffa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #38b2ac;">
                <h3 style="color: #2c7a7b; margin: 0 0 15px 0;">📝 Admin Notes:</h3>
                <p style="color: #4a5568; margin: 0; font-style: italic;">"${data.adminNotes}"</p>
              </div>
              ` : ''}
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/coach/dashboard" 
                   style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Access Coach Dashboard
                </a>
              </div>
              
              <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 30px;">
                Need help getting started? Contact us at <a href="mailto:support@luminary.com" style="color: #48bb78;">support@luminary.com</a>
              </p>
            </div>
          </div>
        `
      };

    case 'coach_rejected':
      return {
        subject: 'Update on Your Coach Application - Luminary',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Application Update</h1>
              <p style="color: #fed7aa; margin: 10px 0 0 0; font-size: 16px;">Thank you for your interest in Luminary</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #2d3748; margin-bottom: 20px;">Hi ${data.firstName},</h2>
              
              <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
                Thank you for your interest in becoming a coach on Luminary. After careful review, we're unable to approve your application at this time.
              </p>
              
              ${data.rejectionReason ? `
              <div style="background: #fef5e7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ed8936;">
                <h3 style="color: #c05621; margin: 0 0 15px 0;">📝 Feedback:</h3>
                <p style="color: #4a5568; margin: 0;">${data.rejectionReason}</p>
              </div>
              ` : ''}
              
              <div style="background: #e6fffa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #38b2ac;">
                <h3 style="color: #2c7a7b; margin: 0 0 15px 0;">🔄 What's Next?</h3>
                <p style="color: #4a5568; margin: 0 0 10px 0;">You're welcome to reapply in the future. We encourage you to address any feedback provided and try again.</p>
              </div>
              
              <p style="color: #4a5568; line-height: 1.6; margin: 20px 0;">
                We appreciate your interest in joining our community and wish you the best in your educational endeavors.
              </p>
              
              <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 30px;">
                Questions? Contact us at <a href="mailto:support@luminary.com" style="color: #ed8936;">support@luminary.com</a>
              </p>
            </div>
          </div>
        `
      };

    case 'course_approved':
      return {
        subject: `Your course has been approved: ${data.courseTitle} 🎉`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Course Approved 🎉</h1>
            </div>
            <div style="background: white; padding: 24px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <p style="color: #2d3748;">Hi ${data.firstName},</p>
              <p style="color: #4a5568;">Great news! Your course <strong>${data.courseTitle}</strong> has been approved and is now live.</p>
              ${data.adminNotes ? `<p style="color:#4a5568;"><em>Admin notes:</em> ${data.adminNotes}</p>` : ''}
              <p style="color:#4a5568;">You can manage your course from your dashboard.</p>
            </div>
          </div>
        `
      };

    case 'course_rejected':
      return {
        subject: `Your course was rejected: ${data.courseTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Course Rejected</h1>
            </div>
            <div style="background: white; padding: 24px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <p style="color: #2d3748;">Hi ${data.firstName},</p>
              <p style="color: #4a5568;">Your course <strong>${data.courseTitle}</strong> was not approved at this time.</p>
              ${data.rejectionReason ? `<p style=\"color:#4a5568;\"><em>Reason:</em> ${data.rejectionReason}</p>` : ''}
              ${data.adminNotes ? `<p style=\"color:#4a5568;\"><em>Admin notes:</em> ${data.adminNotes}</p>` : ''}
            </div>
          </div>
        `
      };

    case 'password_reset':
      return {
        subject: 'Reset Your Luminary Password 🔐',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset 🔐</h1>
              <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px;">Secure your account</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #2d3748; margin-bottom: 20px;">Hi ${data.firstName},</h2>
              
              <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
                You requested to reset your password for your Luminary account. Click the button below to create a new password.
              </p>
              
              <div style="background: #fef5e7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ed8936;">
                <h3 style="color: #c05621; margin: 0 0 15px 0;">⚠️ Security Notice</h3>
                <p style="color: #4a5568; margin: 0;">This link will expire in 1 hour for your security. If you didn't request this reset, please ignore this email.</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/reset-password/${data.resetToken}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Reset Password
                </a>
              </div>
              
              <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 30px;">
                Need help? Contact us at <a href="mailto:support@luminary.com" style="color: #4299e1;">support@luminary.com</a>
              </p>
            </div>
          </div>
        `
      };

    case 'email_verification':
      return {
        subject: 'Verify Your Luminary Email Address ✉️',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email ✉️</h1>
              <p style="color: #bee3f8; margin: 10px 0 0 0; font-size: 16px;">Complete your account setup</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #2d3748; margin-bottom: 20px;">Hi ${data.firstName}!</h2>
              
              <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
                Please verify your email address to complete your Luminary account setup and access all features.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/verify-email/${data.emailVerificationToken}" 
                   style="background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              
              <p style="color: #718096; font-size: 14px; text-align: center;">
                This link will expire in 24 hours. If you didn't create this account, please ignore this email.
              </p>
              
              <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 30px;">
                Need help? Contact us at <a href="mailto:support@luminary.com" style="color: #4299e1;">support@luminary.com</a>
              </p>
            </div>
          </div>
        `
      };

    default:
      throw new Error(`Unknown email template type: ${type}`);
  }
};

// Email service functions
const emailService = {
  // Send welcome email to parent
  async sendWelcomeEmail(user) {
    try {
      const transporter = createTransporter();
      const template = getEmailTemplate('welcome_parent', user);
      
      const mailOptions = {
        from: `"${FROM_NAME || 'Luminary'}" <${FROM_EMAIL}>`,
        to: user.email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      logger.info(`Welcome email sent to ${user.email}`, { messageId: result.messageId });
      return result;
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      throw error;
    }
  },

  // Send coach application notification
  async sendCoachApplicationNotification(user) {
    try {
      const transporter = createTransporter();
      const template = getEmailTemplate('coach_application', user);
      
      const mailOptions = {
        from: `"${FROM_NAME || 'Luminary'}" <${FROM_EMAIL}>`,
        to: user.email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      logger.info(`Coach application notification sent to ${user.email}`, { messageId: result.messageId });
      return result;
    } catch (error) {
      logger.error('Failed to send coach application notification:', error);
      throw error;
    }
  },

  // Send coach approval notification
  async sendCoachApprovalNotification(user, adminNotes = null) {
    try {
      const transporter = createTransporter();
      const template = getEmailTemplate('coach_approved', { ...user, adminNotes });
      
      const mailOptions = {
        from: `"${FROM_NAME || 'Luminary'}" <${FROM_EMAIL}>`,
        to: user.email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      logger.info(`Coach approval notification sent to ${user.email}`, { messageId: result.messageId });
      return result;
    } catch (error) {
      logger.error('Failed to send coach approval notification:', error);
      throw error;
    }
  },

  // Send coach rejection notification
  async sendCoachRejectionNotification(user, rejectionReason = null) {
    try {
      const transporter = createTransporter();
      const template = getEmailTemplate('coach_rejected', { ...user, rejectionReason });
      
      const mailOptions = {
        from: `"${FROM_NAME || 'Luminary'}" <${FROM_EMAIL}>`,
        to: user.email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      logger.info(`Coach rejection notification sent to ${user.email}`, { messageId: result.messageId });
      return result;
    } catch (error) {
      logger.error('Failed to send coach rejection notification:', error);
      throw error;
    }
  },

  // Send course approval email
  async sendCourseApprovalEmail(data) {
    try {
      const transporter = createTransporter();
      const template = getEmailTemplate('course_approved', data);
      const mailOptions = {
        from: `"${FROM_NAME || 'Luminary'}" <${FROM_EMAIL}>`,
        to: data.email,
        subject: template.subject,
        html: template.html
      };
      const result = await transporter.sendMail(mailOptions);
      logger.info(`Course approval email sent to ${data.email}`, { messageId: result.messageId });
      return result;
    } catch (error) {
      logger.error('Failed to send course approval email:', error);
      throw error;
    }
  },

  // Send course rejection email
  async sendCourseRejectionEmail(data) {
    try {
      const transporter = createTransporter();
      const template = getEmailTemplate('course_rejected', data);
      const mailOptions = {
        from: `"${FROM_NAME || 'Luminary'}" <${FROM_EMAIL}>`,
        to: data.email,
        subject: template.subject,
        html: template.html
      };
      const result = await transporter.sendMail(mailOptions);
      logger.info(`Course rejection email sent to ${data.email}`, { messageId: result.messageId });
      return result;
    } catch (error) {
      logger.error('Failed to send course rejection email:', error);
      throw error;
    }
  },

  // Send password reset email
  async sendPasswordResetEmail(user, resetToken) {
    try {
      const transporter = createTransporter();
      const template = getEmailTemplate('password_reset', { ...user, resetToken });
      
      const mailOptions = {
        from: `"${FROM_NAME || 'Luminary'}" <${FROM_EMAIL}>`,
        to: user.email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      logger.info(`Password reset email sent to ${user.email}`, { messageId: result.messageId });
      return result;
    } catch (error) {
      logger.error('Failed to send password reset email:', error);
      throw error;
    }
  },

  // Send email verification
  async sendEmailVerification(user) {
    try {
      const transporter = createTransporter();
      const template = getEmailTemplate('email_verification', user);
      
      const mailOptions = {
        from: `"${FROM_NAME || 'Luminary'}" <${FROM_EMAIL}>`,
        to: user.email,
        subject: template.subject,
        html: template.html
      };

      const result = await transporter.sendMail(mailOptions);
      logger.info(`Email verification sent to ${user.email}`, { messageId: result.messageId });
      return result;
    } catch (error) {
      logger.error('Failed to send email verification:', error);
      throw error;
    }
  },

  // Test email configuration
  async testEmailConfiguration() {
    try {
      const transporter = createTransporter();
      await transporter.verify();
      logger.info('Email configuration is valid');
      return true;
    } catch (error) {
      logger.error('Email configuration test failed:', error);
      throw error;
    }
  }
};

export default emailService;
