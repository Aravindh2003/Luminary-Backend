import { prisma } from "../config/database.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";
import Stripe from "stripe";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Get all payments with filtering
export const getPayments = asyncHandler(async (req, res) => {
  const {
    status,
    courseId,
    sessionId,
    startDate,
    endDate,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const userId = req.user.id;
  const userRole = req.user.role;

  // Build where clause for filtering
  const where = {};

  // Role-based filtering
  if (userRole === "PARENT") {
    where.userId = userId;
  } else if (userRole === "COACH") {
  }
  // Admin can see all payments

  // Status filter
  if (status) {
    where.status = status;
  }

  // Course filter
  if (courseId) {
    where.courseId = courseId;
  }

  // Session filter
  if (sessionId) {
    where.sessionId = sessionId;
  }

  // Date range filter
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  // Sort order
  const orderBy = {};
  orderBy[sortBy] = sortOrder;

  const [payments, totalCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        course: {
          select: {
            id: true,
            title: true,
            category: true,
          },
        },
        session: {
          select: {
            id: true,
            title: true,
            startTime: true,
          },
        },
        payer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        payee: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy,
      skip,
      take,
    }),
    prisma.payment.count({ where }),
  ]);

  // Format response
  const formattedPayments = payments.map((payment) => ({
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    stripePaymentId: payment.stripePaymentId,
    stripeRefundId: payment.stripeRefundId,
    description: payment.description,
    refundReason: payment.refundReason,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    course: {
      id: payment.course.id,
      title: payment.course.title,
      category: payment.course.category,
    },
    session: {
      id: payment.session.id,
      title: payment.session.title,
      startTime: payment.session.startTime,
    },
    payer: {
      name: `${payment.payer.firstName} ${payment.payer.lastName}`,
      email: payment.payer.email,
    },
    payee: {
      name: `${payment.payee.user.firstName} ${payment.payee.user.lastName}`,
      email: payment.payee.user.email,
    },
  }));

  const totalPages = Math.ceil(totalCount / take);

  res.json(
    new ApiResponse(
      200,
      {
        payments: formattedPayments,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
      "Payment history retrieved successfully"
    )
  );
});

// Get payment by ID
export const getPaymentById = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  // Convert paymentId to integer
  const paymentIdInt = parseInt(paymentId, 10);
  if (isNaN(paymentIdInt)) {
    throw new ApiError(400, "Invalid payment ID");
  }

  // Build where clause based on user role
  const where = { id: paymentIdInt };

  if (userRole === "PARENT") {
    where.userId = userId;
  } else if (userRole === "COACH") {
  }
  // Admin can access any payment

  const payment = await prisma.payment.findFirst({
    where,
    include: {
      course: {
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          level: true,
          duration: true,
        },
      },
      session: {
        select: {
          id: true,
          title: true,
          description: true,
          startTime: true,
          endTime: true,
          duration: true,
          status: true,
        },
      },
      payer: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      payee: {
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  if (!payment) {
    throw new ApiError(404, "Payment not found");
  }

  // Format response
  const formattedPayment = {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    stripePaymentId: payment.stripePaymentId,
    stripeRefundId: payment.stripeRefundId,
    description: payment.description,
    refundReason: payment.refundReason,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    course: payment.course,
    session: payment.session,
    payer: {
      name: `${payment.payer.firstName} ${payment.payer.lastName}`,
      email: payment.payer.email,
      phone: payment.payer.phone,
    },
    payee: {
      name: `${payment.payee.user.firstName} ${payment.payee.user.lastName}`,
      email: payment.payee.user.email,
      phone: payment.payee.user.phone,
    },
  };

  res.json(
    new ApiResponse(
      200,
      formattedPayment,
      "Payment details retrieved successfully"
    )
  );
});

// Create new payment
export const createPayment = asyncHandler(async (req, res) => {
  const {
    courseId,
    sessionId,
    amount,
    currency,
    paymentMethodId,
    description,
    metadata = {},
  } = req.body;

  const payerId = req.user.id;

  // Check if course and session exist
  // Check if course exists
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      coach: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Check if session exists (only if sessionId is provided)
  let session = null;
  if (sessionId !== null && sessionId !== undefined) {
    session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        coach: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!session) {
      throw new ApiError(404, "Session not found");
    }
  }

  // Check if payment already exists for this session
  const existingPayment = await prisma.payment.findFirst({
    where: {
      sessionId,
      userId: payerId,
      status: "PENDING",
    },
  });

  if (existingPayment) {
    // If there's already a pending payment, retrieve the Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.retrieve(
      existingPayment.stripePaymentId
    );

    logger.info(`Returning existing pending payment: ${existingPayment.id}`);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          paymentId: existingPayment.id,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        },
        "Existing pending payment found"
      )
    );
  }

  // Check if there's already a successful payment for this session
  const successfulPayment = await prisma.payment.findFirst({
    where: {
      sessionId,
      userId: payerId,
      status: "SUCCEEDED",
    },
  });

  if (successfulPayment) {
    throw new ApiError(400, "Payment already completed for this session");
  }

  // Create Stripe payment intent
  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      payment_method: paymentMethodId,
      description: description || `Payment for ${course.title}`,
      confirm: false,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
    });
  } catch (error) {
    logger.error("Stripe payment intent creation failed:", error);
    throw new ApiError(400, "Payment processing failed");
  }

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      sessionId,
      userId: payerId,
      amount,
      currency,
      status: "PENDING",
      stripePaymentId: paymentIntent.id,
      metadata: {
        courseId,
        courseTitle: course.title,
        coachId: course.coachId,
        description: description || `Payment for ${course.title}`,
        selectedChildren: metadata?.selectedChildren || [],
        cardholderName: metadata?.cardholderName || "",
      },
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  logger.info(
    `Payment created: ${payment.id} for course ${payment.metadata.courseTitle} by ${payment.user.firstName} ${payment.user.lastName}`
  );

  res.status(201).json(
    new ApiResponse(
      201,
      {
        paymentId: payment.id,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
      "Payment created successfully"
    )
  );
});

// Create payment for credit package purchase
export const createCreditPayment = asyncHandler(async (req, res) => {
  const { packageId, paymentMethodId, description } = req.body;
  const payerId = req.user.id;

  // Find credit package
  const creditPackage = await prisma.creditPackage.findUnique({
    where: { id: packageId },
  });
  if (!creditPackage || !creditPackage.isActive) {
    throw new ApiError(404, "Credit package not found or inactive");
  }

  // Create Stripe PaymentIntent
  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(creditPackage.price) * 100),
      currency: creditPackage.currency.toLowerCase(),
      payment_method: paymentMethodId,
      description: description || `Purchase credits: ${creditPackage.name}`,
      confirm: false,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
    });
  } catch (error) {
    logger.error("Stripe payment intent creation failed (credits):", error);
    throw new ApiError(400, "Payment processing failed");
  }

  // Create Payment record
  const payment = await prisma.payment.create({
    data: {
      sessionId: null,
      userId: payerId,
      amount: Number(creditPackage.price),
      currency: creditPackage.currency,
      status: "PENDING",
      stripePaymentId: paymentIntent.id,
      metadata: {
        type: "CREDIT_PURCHASE",
        packageId: creditPackage.id,
        packageName: creditPackage.name,
        credits:
          Number(creditPackage.credits) +
          Number(creditPackage.bonusCredits || 0),
      },
    },
  });

  // Create CreditPurchase record (pending, linked to payment)
  await prisma.creditPurchase.create({
    data: {
      userId: payerId,
      packageId: creditPackage.id,
      packageName: creditPackage.name,
      credits:
        Number(creditPackage.credits) + Number(creditPackage.bonusCredits || 0),
      amount: Number(creditPackage.price),
      currency: creditPackage.currency,
      paymentId: payment.id,
      status: "PENDING",
      expiresAt: creditPackage.validDays
        ? new Date(Date.now() + creditPackage.validDays * 24 * 60 * 60 * 1000)
        : null,
    },
  });

  logger.info(
    `Credit payment created: ${payment.id} for package ${creditPackage.name} by user ${payerId}`
  );

  res.status(201).json(
    new ApiResponse(
      201,
      {
        paymentId: payment.id,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
      "Credit payment created successfully"
    )
  );
});

// Confirm payment
export const confirmPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const { paymentIntentId } = req.body;
  const userId = req.user.id;

  // Convert paymentId to integer
  const paymentIdInt = parseInt(paymentId, 10);
  if (isNaN(paymentIdInt)) {
    throw new ApiError(400, "Invalid payment ID");
  }

  // Check if payment exists and belongs to user
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentIdInt,
      userId: userId,
      status: "PENDING",
    },
  });

  logger.info(
    `Looking for payment: ID=${paymentIdInt}, userId=${userId}, status=PENDING`
  );

  if (!payment) {
    logger.error(`Payment not found: ID=${paymentIdInt}, userId=${userId}`);
    throw new ApiError(404, "Payment not found or cannot be confirmed");
  }

  logger.info(`Found payment: ${JSON.stringify(payment)}`);

  // Validate that the PaymentIntent ID matches
  if (payment.stripePaymentId !== paymentIntentId) {
    logger.error(
      `PaymentIntent ID mismatch: stored=${payment.stripePaymentId}, provided=${paymentIntentId}`
    );
    throw new ApiError(400, "PaymentIntent ID does not match");
  }

  // Check payment status with Stripe
  try {
    let paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // If payment requires confirmation, confirm it
    if (paymentIntent.status === "requires_confirmation") {
      logger.info(
        `Payment requires confirmation, confirming now: ${paymentIntentId}`
      );
      paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
      });
    }

    if (paymentIntent.status === "succeeded") {
      // Update payment status
      const updatedPayment = await prisma.payment.update({
        where: { id: paymentIdInt },
        data: { status: "SUCCEEDED" },
      });

      logger.info(`Payment confirmed: ${paymentIdInt}`);

      // If this was a credit purchase, complete it and add credits
      if (payment.metadata && payment.metadata.type === "CREDIT_PURCHASE") {
        try {
          const creditPurchase = await prisma.creditPurchase.findFirst({
            where: { paymentId: paymentIdInt },
          });
          if (creditPurchase && creditPurchase.status === "PENDING") {
            await prisma.creditPurchase.update({
              where: { id: creditPurchase.id },
              data: { status: "COMPLETED" },
            });

            // Update credit balance and create transaction
            const amountToAdd = Number(payment.metadata.credits || 0);
            // Get or create credit balance
            let creditBalance = await prisma.creditBalance.findUnique({
              where: { userId },
            });
            if (!creditBalance) {
              creditBalance = await prisma.creditBalance.create({
                data: { userId, balance: 0, totalEarned: 0, totalSpent: 0 },
              });
            }
            const newBalance = Number(creditBalance.balance) + amountToAdd;
            await prisma.$transaction([
              prisma.creditBalance.update({
                where: { userId },
                data: {
                  balance: newBalance,
                  totalEarned: Number(creditBalance.totalEarned) + amountToAdd,
                  lastUpdated: new Date(),
                },
              }),
              prisma.creditTransaction.create({
                data: {
                  userId,
                  type: "PURCHASE",
                  amount: amountToAdd,
                  balance: newBalance,
                  description: `Purchased credits: ${payment.metadata.packageName}`,
                  referenceId: String(creditPurchase.id),
                  referenceType: "PURCHASE",
                  metadata: { packageId: payment.metadata.packageId },
                },
              }),
            ]);
          }
        } catch (e) {
          logger.error(
            "Failed to finalize credit purchase after payment success:",
            e
          );
        }
      }

      res.json(
        new ApiResponse(200, updatedPayment, "Payment confirmed successfully")
      );
    } else if (paymentIntent.status === "requires_action") {
      // Payment requires additional authentication (3D Secure, etc.)
      logger.info(`Payment requires action: ${paymentIntentId}`);
      res.json(
        new ApiResponse(
          200,
          {
            requiresAction: true,
            clientSecret: paymentIntent.client_secret,
          },
          "Payment requires additional authentication"
        )
      );
    } else {
      logger.error(
        `Payment confirmation failed - Stripe status: ${paymentIntent.status}`
      );
      throw new ApiError(
        400,
        `Payment confirmation failed - Status: ${paymentIntent.status}`
      );
    }
  } catch (error) {
    logger.error("Payment confirmation failed:", error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(400, `Payment confirmation failed: ${error.message}`);
  }
});

// Process refund
export const processRefund = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const { reason, amount } = req.body;
  const userId = req.user.id;

  // Convert paymentId to integer
  const paymentIdInt = parseInt(paymentId, 10);
  if (isNaN(paymentIdInt)) {
    throw new ApiError(400, "Invalid payment ID");
  }

  // Check if payment exists
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentIdInt,
      status: "COMPLETED",
    },
  });

  if (!payment) {
    throw new ApiError(404, "Payment not found or cannot be refunded");
  }

  // Check if user has permission to refund
  if (req.user.role === "COACH" && payment.payeeId !== userId) {
    throw new ApiError(403, "Access denied");
  }

  // Process refund with Stripe
  try {
    const refundAmount = amount ? Math.round(amount * 100) : undefined; // Convert to cents
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripePaymentId,
      amount: refundAmount,
      reason: "requested_by_customer",
    });

    // Update payment record
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentIdInt },
      data: {
        status: "REFUNDED",
        stripeRefundId: refund.id,
        refundReason: reason,
      },
    });

    logger.info(`Refund processed: ${paymentId} for reason: ${reason}`);

    res.json(
      new ApiResponse(200, updatedPayment, "Refund processed successfully")
    );
  } catch (error) {
    logger.error("Refund processing failed:", error);
    throw new ApiError(400, "Refund processing failed");
  }
});

// Cancel payment
export const cancelPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const userId = req.user.id;

  // Convert paymentId to integer
  const paymentIdInt = parseInt(paymentId, 10);
  if (isNaN(paymentIdInt)) {
    throw new ApiError(400, "Invalid payment ID");
  }

  // Check if payment exists and belongs to user
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentIdInt,
      userId: userId,
      status: "PENDING",
    },
  });

  if (!payment) {
    throw new ApiError(404, "Payment not found or cannot be cancelled");
  }

  // Cancel payment with Stripe
  try {
    await stripe.paymentIntents.cancel(payment.stripePaymentId);

    // Update payment status
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentIdInt },
      data: { status: "CANCELLED" },
    });

    logger.info(`Payment cancelled: ${paymentId}`);

    res.json(
      new ApiResponse(200, updatedPayment, "Payment cancelled successfully")
    );
  } catch (error) {
    logger.error("Payment cancellation failed:", error);
    throw new ApiError(400, "Payment cancellation failed");
  }
});

// Create setup intent for saving payment methods
export const createSetupIntent = asyncHandler(async (req, res) => {
  const { customerId } = req.body;
  const userId = req.user.id;

  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
    });

    res.json(
      new ApiResponse(
        200,
        {
          clientSecret: setupIntent.client_secret,
          setupIntentId: setupIntent.id,
        },
        "Setup intent created successfully"
      )
    );
  } catch (error) {
    logger.error("Setup intent creation failed:", error);
    throw new ApiError(400, "Setup intent creation failed");
  }
});

// Get payment methods for current user
export const getPaymentMethods = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get user's Stripe customer ID (you'll need to store this in your user model)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return res.json(new ApiResponse(200, [], "No payment methods found"));
  }

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: "card",
    });

    const formattedPaymentMethods = paymentMethods.data.map((pm) => ({
      id: pm.id,
      type: pm.type,
      card: {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      },
    }));

    res.json(
      new ApiResponse(
        200,
        formattedPaymentMethods,
        "Payment methods retrieved successfully"
      )
    );
  } catch (error) {
    logger.error("Payment methods retrieval failed:", error);
    throw new ApiError(400, "Failed to retrieve payment methods");
  }
});

// Remove payment method
export const removePaymentMethod = asyncHandler(async (req, res) => {
  const { paymentMethodId } = req.params;
  const userId = req.user.id;

  // Get user's Stripe customer ID
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    throw new ApiError(404, "Payment method not found");
  }

  try {
    // Detach payment method from customer
    await stripe.paymentMethods.detach(paymentMethodId);

    logger.info(`Payment method removed: ${paymentMethodId} by user ${userId}`);

    res.json(new ApiResponse(200, null, "Payment method removed successfully"));
  } catch (error) {
    logger.error("Payment method removal failed:", error);
    throw new ApiError(400, "Failed to remove payment method");
  }
});

// Generate invoice PDF
export const generateInvoice = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  // Convert paymentId to integer
  const paymentIdInt = parseInt(paymentId, 10);
  if (isNaN(paymentIdInt)) {
    throw new ApiError(400, "Invalid payment ID");
  }

  // Build where clause based on user role
  const where = { id: paymentIdInt };

  if (userRole === "PARENT") {
    where.userId = userId;
  } else if (userRole === "COACH") {
  }

  const payment = await prisma.payment.findFirst({
    where,
    include: {
      course: {
        select: {
          title: true,
          category: true,
        },
      },
      session: {
        select: {
          title: true,
          startTime: true,
        },
      },
      payer: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      payee: {
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!payment) {
    throw new ApiError(404, "Payment not found");
  }

  // Generate PDF invoice (you'll need to implement PDF generation)
  // For now, we'll return a simple JSON response
  const invoiceData = {
    invoiceNumber: `INV-${payment.id.slice(0, 8).toUpperCase()}`,
    date: payment.createdAt,
    dueDate: payment.createdAt,
    customer: {
      name: `${payment.payer.firstName} ${payment.payer.lastName}`,
      email: payment.payer.email,
    },
    items: [
      {
        description: payment.course.title,
        quantity: 1,
        unitPrice: payment.amount,
        total: payment.amount,
      },
    ],
    subtotal: payment.amount,
    tax: 0,
    total: payment.amount,
    currency: payment.currency,
  };

  // In a real implementation, you would generate a PDF here
  // For now, we'll return the invoice data as JSON
  res.json(
    new ApiResponse(200, invoiceData, "Invoice data generated successfully")
  );
});

// Get payment analytics (Admin only)
export const getPaymentAnalytics = asyncHandler(async (req, res) => {
  const { period = "month", startDate, endDate } = req.query;

  let dateFilter = {};
  const now = new Date();

  // Set date range based on period
  switch (period) {
    case "day":
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        lte: now,
      };
      break;
    case "week":
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { gte: weekAgo, lte: now };
      break;
    case "month":
      dateFilter = {
        gte: new Date(now.getFullYear(), now.getMonth(), 1),
        lte: now,
      };
      break;
    case "year":
      dateFilter = {
        gte: new Date(now.getFullYear(), 0, 1),
        lte: now,
      };
      break;
  }

  // Override with custom date range if provided
  if (startDate && endDate) {
    dateFilter = {
      gte: new Date(startDate),
      lte: new Date(endDate),
    };
  }

  // Get payment statistics
  const [
    totalPayments,
    completedPayments,
    pendingPayments,
    failedPayments,
    totalRevenue,
    averagePayment,
    paymentByStatus,
    revenueByMonth,
  ] = await Promise.all([
    // Total payments
    prisma.payment.count({
      where: { createdAt: dateFilter },
    }),
    // Completed payments
    prisma.payment.count({
      where: {
        createdAt: dateFilter,
        status: "COMPLETED",
      },
    }),
    // Pending payments
    prisma.payment.count({
      where: {
        createdAt: dateFilter,
        status: "PENDING",
      },
    }),
    // Failed payments
    prisma.payment.count({
      where: {
        createdAt: dateFilter,
        status: "FAILED",
      },
    }),
    // Total revenue
    prisma.payment.aggregate({
      where: {
        createdAt: dateFilter,
        status: "COMPLETED",
      },
      _sum: {
        amount: true,
      },
    }),
    // Average payment amount
    prisma.payment.aggregate({
      where: {
        createdAt: dateFilter,
        status: "COMPLETED",
      },
      _avg: {
        amount: true,
      },
    }),
    // Payments by status
    prisma.payment.groupBy({
      by: ["status"],
      where: { createdAt: dateFilter },
      _count: {
        status: true,
      },
    }),
    // Revenue by month (for chart)
    prisma.payment.groupBy({
      by: ["createdAt"],
      where: {
        createdAt: dateFilter,
        status: "COMPLETED",
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  const analytics = {
    summary: {
      totalPayments,
      completedPayments,
      pendingPayments,
      failedPayments,
      totalRevenue: totalRevenue._sum.amount || 0,
      averagePayment: averagePayment._avg.amount || 0,
      successRate:
        totalPayments > 0 ? (completedPayments / totalPayments) * 100 : 0,
    },
    byStatus: paymentByStatus.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {}),
    revenueByMonth: revenueByMonth.map((item) => ({
      date: item.createdAt,
      revenue: item._sum.amount || 0,
    })),
  };

  res.json(
    new ApiResponse(200, analytics, "Payment analytics retrieved successfully")
  );
});
