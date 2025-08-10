import Stripe from 'stripe';
import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';
import emailService from './emailService.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

export const createPaymentIntent = async (sessionId, userId) => {
  try {
    // Get session details
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        course: true,
        coach: true,
        student: true
      }
    });

    if (!session) {
      throw new ApiError(404, 'Session not found');
    }

    if (session.studentId !== userId) {
      throw new ApiError(403, 'Access denied');
    }

    // Calculate amount (in cents)
    const amount = Math.round(session.course.price * 100);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: session.course.currency.toLowerCase(),
      metadata: {
        sessionId,
        courseId: session.courseId,
        coachId: session.coachId,
        studentId: session.studentId
      }
    });

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        sessionId,
        userId,
        stripePaymentId: paymentIntent.id,
        amount: session.course.price,
        currency: session.course.currency,
        status: 'PENDING',
        metadata: {
          paymentIntentId: paymentIntent.id,
          sessionTitle: session.title,
          courseTitle: session.course.title
        }
      }
    });

    return {
      paymentIntent,
      payment
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to create payment intent');
  }
};

export const confirmPayment = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      // Update payment status
      await prisma.payment.update({
        where: { stripePaymentId: paymentIntentId },
        data: { status: 'SUCCEEDED' }
      });

      // Update session status
      await prisma.session.update({
        where: { id: paymentIntent.metadata.sessionId },
        data: { status: 'SCHEDULED' }
      });

      // Send confirmation email
      const payment = await prisma.payment.findUnique({
        where: { stripePaymentId: paymentIntentId },
        include: {
          session: {
            include: {
              course: true,
              coach: true,
              student: true
            }
          }
        }
      });

      if (payment) {
        try {
          await sendPaymentConfirmation(payment);
        } catch (emailError) {
          console.error('Failed to send payment confirmation email:', emailError);
        }
      }

      return paymentIntent;
    }

    return paymentIntent;
  } catch (error) {
    throw new ApiError(500, 'Failed to confirm payment');
  }
};

export const createCustomer = async (user) => {
  try {
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: {
        userId: user.id
      }
    });

    // Update user with Stripe customer ID
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id }
    });

    return customer;
  } catch (error) {
    throw new ApiError(500, 'Failed to create Stripe customer');
  }
};

export const createCoachAccount = async (coach) => {
  try {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US', // You might want to make this configurable
      email: coach.user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      metadata: {
        coachId: coach.id,
        userId: coach.userId
      }
    });

    // Update coach with Stripe account ID
    await prisma.coach.update({
      where: { id: coach.id },
      data: { stripeAccountId: account.id }
    });

    return account;
  } catch (error) {
    throw new ApiError(500, 'Failed to create Stripe account for coach');
  }
};

export const createAccountLink = async (coachId) => {
  try {
    const coach = await prisma.coach.findUnique({
      where: { id: coachId },
      include: { user: true }
    });

    if (!coach) {
      throw new ApiError(404, 'Coach not found');
    }

    if (!coach.stripeAccountId) {
      throw new ApiError(400, 'Coach does not have a Stripe account');
    }

    const accountLink = await stripe.accountLinks.create({
      account: coach.stripeAccountId,
      refresh_url: `${process.env.FRONTEND_URL}/coach/onboarding`,
      return_url: `${process.env.FRONTEND_URL}/coach/dashboard`,
      type: 'account_onboarding'
    });

    return accountLink;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to create account link');
  }
};

export const processRefund = async (paymentId, amount, reason) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        session: {
          include: {
            course: true,
            coach: true,
            student: true
          }
        }
      }
    });

    if (!payment) {
      throw new ApiError(404, 'Payment not found');
    }

    if (payment.refunded) {
      throw new ApiError(400, 'Payment has already been refunded');
    }

    // Process refund through Stripe
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripePaymentId,
      amount: Math.round(amount * 100), // Convert to cents
      reason: 'requested_by_customer'
    });

    // Update payment record
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        refunded: true,
        refundAmount: amount,
        refundReason: reason,
        status: 'REFUNDED'
      }
    });

    // Update session status if needed
    if (payment.session) {
      await prisma.session.update({
        where: { id: payment.session.id },
        data: { status: 'CANCELLED' }
      });
    }

    return refund;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to process refund');
  }
};

export const getPaymentHistory = async (userId, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { userId },
        include: {
          session: {
            include: {
              course: true,
              coach: {
                include: { user: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.payment.count({
        where: { userId }
      })
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw new ApiError(500, 'Failed to get payment history');
  }
};

export const getCoachEarnings = async (coachId, startDate, endDate) => {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        coachId,
        status: 'SUCCEEDED',
        startTime: {
          gte: startDate,
          lte: endDate
        },
        payment: {
          status: 'SUCCEEDED'
        }
      },
      include: {
        payment: true,
        course: true
      }
    });

    const totalEarnings = sessions.reduce((sum, session) => {
      return sum + parseFloat(session.payment.amount);
    }, 0);

    const earningsByDate = sessions.reduce((acc, session) => {
      const date = session.startTime.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + parseFloat(session.payment.amount);
      return acc;
    }, {});

    return {
      totalEarnings,
      earningsByDate,
      sessionCount: sessions.length
    };
  } catch (error) {
    throw new ApiError(500, 'Failed to get coach earnings');
  }
};

export const handleWebhook = async (event) => {
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'account.updated':
        await handleAccountUpdated(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('Webhook handling error:', error);
    throw error;
  }
};

const handlePaymentSucceeded = async (paymentIntent) => {
  try {
    await prisma.payment.update({
      where: { stripePaymentId: paymentIntent.id },
      data: { status: 'SUCCEEDED' }
    });

    if (paymentIntent.metadata.sessionId) {
      await prisma.session.update({
        where: { id: paymentIntent.metadata.sessionId },
        data: { status: 'SCHEDULED' }
      });
    }
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
};

const handlePaymentFailed = async (paymentIntent) => {
  try {
    await prisma.payment.update({
      where: { stripePaymentId: paymentIntent.id },
      data: { status: 'FAILED' }
    });
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
};

const handleAccountUpdated = async (account) => {
  try {
    const coach = await prisma.coach.findFirst({
      where: { stripeAccountId: account.id }
    });

    if (coach) {
      // Update coach status based on Stripe account status
      const status = account.charges_enabled ? 'APPROVED' : 'PENDING';
      await prisma.coach.update({
        where: { id: coach.id },
        data: { status }
      });
    }
  } catch (error) {
    console.error('Error handling account updated:', error);
  }
};

export const testPaymentService = async () => {
  try {
    // Test Stripe connection
    const balance = await stripe.balance.retrieve();
    console.log('✅ Stripe connection successful');
    console.log('Available balance:', balance.available);
    
    return { success: true, balance };
  } catch (error) {
    console.error('❌ Stripe connection failed:', error);
    throw error;
  }
};

export default {
  createPaymentIntent,
  confirmPayment,
  createCustomer,
  createCoachAccount,
  createAccountLink,
  processRefund,
  getPaymentHistory,
  getCoachEarnings,
  handleWebhook,
  testPaymentService
}; 