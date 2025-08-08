import { Resend } from 'resend';
import logger from '../utils/logger.js';

const resend = new Resend(process.env.RESEND_API_KEY);

const {
  FROM_EMAIL = 'noreply@luminary.com',
  FROM_NAME = 'Luminary',
  FRONTEND_URL = 'http://localhost:5173'
} = process.env;

// Email templates for Resend
const getEmailTemplate = (type, data) => {
  const baseUrl = FRONTEND_URL;
  
  switch (type) {
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
        subject: '🎉 Your Course Has Been Approved! - Luminary',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Course Approved!</h1>
              <p style="color: #c6f6d5; margin: 10px 0 0 0; font-size: 16px;">Your course is now live on Luminary</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #2d3748; margin-bottom: 20px;">Hi ${data.firstName}! 🎓</h2>
              
              <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
                Great news! Your course <strong>"${data.courseTitle}"</strong> has been approved and is now live on Luminary.
              </p>
              
              <div style="background: #f0fff4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #48bb78;">
                <h3 style="color: #2f855a; margin: 0 0 15px 0;">✅ Your course is now:</h3>
                <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
                  <li>Visible to all students on the platform</li>
                  <li>Available for enrollment</li>
                  <li>Ready to generate revenue</li>
                  <li>Part of our course catalog</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/coach/dashboard" 
                   style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  View Course Dashboard
                </a>
              </div>
              
              <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 30px;">
                Need help managing your course? Contact us at <a href="mailto:support@luminary.com" style="color: #48bb78;">support@luminary.com</a>
              </p>
            </div>
          </div>
        `
      };

    case 'course_rejected':
      return {
        subject: 'Course Review Update - Luminary',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Course Review Update</h1>
              <p style="color: #fed7aa; margin: 10px 0 0 0; font-size: 16px;">Feedback on your course submission</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #2d3748; margin-bottom: 20px;">Hi ${data.firstName},</h2>
              
              <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
                Thank you for submitting your course <strong>"${data.courseTitle}"</strong> for review. After careful evaluation, we're unable to approve this course at this time.
              </p>
              
              ${data.rejectionReason ? `
              <div style="background: #fef5e7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ed8936;">
                <h3 style="color: #c05621; margin: 0 0 15px 0;">📝 Feedback:</h3>
                <p style="color: #4a5568; margin: 0;">${data.rejectionReason}</p>
              </div>
              ` : ''}
              
              <div style="background: #e6fffa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #38b2ac;">
                <h3 style="color: #2c7a7b; margin: 0 0 15px 0;">🔄 Next Steps:</h3>
                <p style="color: #4a5568; margin: 0 0 10px 0;">You can update your course based on the feedback provided and resubmit it for review.</p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${baseUrl}/coach/dashboard" 
                   style="background: linear-gradient(135deg, #ed8936 0%, #dd6b20 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Update Course
                </a>
              </div>
              
              <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 30px;">
                Questions about the feedback? Contact us at <a href="mailto:support@luminary.com" style="color: #ed8936;">support@luminary.com</a>
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
                <h3 style="color: #c05621; margin: 0 0 15px 0;">📧 What's Next?</h3>
                <p style="color: #4a5568; margin: 0 0 10px 0;">You'll receive an email notification once your application has been reviewed.</p>
              </div>
              
              <p style="color: #718096; font-size: 14px; text-align: center; margin-top: 30px;">
                Questions? Contact us at <a href="mailto:support@luminary.com" style="color: #48bb78;">support@luminary.com</a>
              </p>
            </div>
          </div>
        `
      };

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

    default:
      return {
        subject: 'Luminary Notification',
        html: '<p>This is a default email template.</p>'
      };
  }
};

const resendEmailService = {
  // Send coach approval notification using Resend
  async sendCoachApprovalNotification(user, adminNotes = null) {
    try {
      const template = getEmailTemplate('coach_approved', { ...user, adminNotes });
      
      const { data, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        html: template.html
      });

      if (error) {
        logger.error('Failed to send coach approval notification via Resend:', error);
        throw error;
      }

      logger.info(`Coach approval notification sent to ${user.email} via Resend`, { 
        messageId: data?.id 
      });
      return data;
    } catch (error) {
      logger.error('Failed to send coach approval notification:', error);
      throw error;
    }
  },

  // Send coach rejection notification using Resend
  async sendCoachRejectionNotification(user, rejectionReason = null) {
    try {
      const template = getEmailTemplate('coach_rejected', { ...user, rejectionReason });
      
      const { data, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        html: template.html
      });

      if (error) {
        logger.error('Failed to send coach rejection notification via Resend:', error);
        throw error;
      }

      logger.info(`Coach rejection notification sent to ${user.email} via Resend`, { 
        messageId: data?.id 
      });
      return data;
    } catch (error) {
      logger.error('Failed to send coach rejection notification:', error);
      throw error;
    }
  },

  // Send coach application notification using Resend
  async sendCoachApplicationNotification(user) {
    try {
      const template = getEmailTemplate('coach_application', user);
      
      const { data, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        html: template.html
      });

      if (error) {
        logger.error('Failed to send coach application notification via Resend:', error);
        throw error;
      }

      logger.info(`Coach application notification sent to ${user.email} via Resend`, { 
        messageId: data?.id 
      });
      return data;
    } catch (error) {
      logger.error('Failed to send coach application notification:', error);
      throw error;
    }
  },

  // Send welcome email using Resend
  async sendWelcomeEmail(user) {
    try {
      const template = getEmailTemplate('welcome_parent', user);
      
      const { data, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [user.email],
        subject: template.subject,
        html: template.html
      });

      if (error) {
        logger.error('Failed to send welcome email via Resend:', error);
        throw error;
      }

      logger.info(`Welcome email sent to ${user.email} via Resend`, { 
        messageId: data?.id 
      });
      return data;
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      throw error;
    }
  },

  // Test Resend configuration
  async testResendConfiguration() {
    try {
      const { data, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: ['test@example.com'],
        subject: 'Test Email from Luminary',
        html: '<p>This is a test email to verify Resend configuration.</p>'
      });

      if (error) {
        logger.error('Resend configuration test failed:', error);
        throw error;
      }

      logger.info('Resend configuration is valid', { messageId: data?.id });
      return true;
    } catch (error) {
      logger.error('Resend configuration test failed:', error);
      throw error;
    }
  },

  // Generic sendEmail function for custom emails
  async sendEmail({ to, subject, html, from = null }) {
    try {
      const { data, error } = await resend.emails.send({
        from: from || `${FROM_NAME} <${FROM_EMAIL}>`,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html
      });

      if (error) {
        logger.error('Failed to send email via Resend:', error);
        throw error;
      }

      logger.info(`Email sent successfully via Resend`, { 
        messageId: data?.id,
        to: to,
        subject: subject
      });
      return data;
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  },

  // Course approval email
  async sendCourseApprovalEmail({ email, firstName, courseTitle }) {
    try {
      const template = getEmailTemplate('course_approved', {
        firstName,
        courseTitle
      });

      const result = await this.sendEmail({
        to: email,
        subject: template.subject,
        html: template.html
      });

      logger.info('Course approval email sent successfully', {
        email,
        courseTitle,
        messageId: result?.id
      });

      return result;
    } catch (error) {
      logger.error('Failed to send course approval email:', error);
      throw error;
    }
  },

  // Course rejection email
  async sendCourseRejectionEmail({ email, firstName, courseTitle, rejectionReason }) {
    try {
      const template = getEmailTemplate('course_rejected', {
        firstName,
        courseTitle,
        rejectionReason
      });

      const result = await this.sendEmail({
        to: email,
        subject: template.subject,
        html: template.html
      });

      logger.info('Course rejection email sent successfully', {
        email,
        courseTitle,
        rejectionReason,
        messageId: result?.id
      });

      return result;
    } catch (error) {
      logger.error('Failed to send course rejection email:', error);
      throw error;
    }
  }
};

export default resendEmailService; 