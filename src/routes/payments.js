import express from "express";
import { body, query, param } from "express-validator";
import asyncHandler from "../utils/asyncHandler.js";
import validate from "../middleware/validation.js";
import { authenticate, authorize } from "../middleware/auth.js";
import * as paymentController from "../controllers/paymentController.js";
import Stripe from "stripe";
import { prisma } from "../config/database.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Stripe webhook endpoint
// NOTE: This must be mounted BEFORE any body parsers that consume JSON
const router = express.Router();

// Get Stripe publishable key
router.get("/config", (req, res) => {
  res.json({
    success: true,
    data: {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    },
    message: "Stripe configuration retrieved successfully",
  });
});

router.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error(
        "Stripe webhook signature verification failed:",
        err.message
      );
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        // Update payment record in DB
        await prisma.payment.updateMany({
          where: { stripePaymentId: paymentIntent.id },
          data: { status: "SUCCEEDED" },
        });
        // Optionally, update session status, send email, etc.
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        await prisma.payment.updateMany({
          where: { stripePaymentId: paymentIntent.id },
          data: { status: "FAILED" },
        });
        break;
      }
      // Add more event types as needed
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    res.json({ received: true });
  }
);

// Validation rules
const createPaymentValidation = [
  body("courseId").isInt().withMessage("Invalid course ID format"),
  body("sessionId")
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage("Invalid session ID format"),
  body("amount")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be greater than 0"),
  body("currency")
    .isIn(["USD", "EUR", "GBP", "CAD"])
    .withMessage("Currency must be USD, EUR, GBP, or CAD"),
  body("paymentMethodId")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Payment method ID is required"),
];

// Validation for credit package payments
const createCreditPaymentValidation = [
  body("packageId")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Package ID is required"),
  body("paymentMethodId")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Payment method ID is required"),
  body("description").optional().isString().isLength({ max: 500 }),
];

const getPaymentsValidation = [
  query("status")
    .optional()
    .isIn(["PENDING", "SUCCEEDED", "FAILED", "REFUNDED", "CANCELLED"]),
  query("courseId").optional().isInt({ min: 1 }),
  query("sessionId").optional().isInt({ min: 1 }),
  query("startDate").optional().isISO8601(),
  query("endDate").optional().isISO8601(),
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("sortBy").optional().isIn(["createdAt", "amount", "status"]),
  query("sortOrder").optional().isIn(["asc", "desc"]),
];

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: Get payment history with filtering
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, REFUNDED, CANCELLED]
 *         description: Filter by payment status
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by course ID
 *       - in: query
 *         name: sessionId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by session ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter payments from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter payments until this date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of payments per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, amount, status]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Payment history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     payments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Payment'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalCount:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  getPaymentsValidation,
  validate,
  asyncHandler(paymentController.getPayments)
);

/**
 * @swagger
 * /payments/{paymentId}:
 *   get:
 *     summary: Get payment details by ID
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 *                 message:
 *                   type: string
 *       404:
 *         description: Payment not found
 */
router.get(
  "/:paymentId",
  [
    param("paymentId")
      .isInt({ min: 1 })
      .withMessage("Invalid payment ID format"),
  ],
  validate,
  asyncHandler(paymentController.getPaymentById)
);

/**
 * @swagger
 * /payments:
 *   post:
 *     summary: Create a new payment (Parent only)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courseId
 *               - sessionId
 *               - amount
 *               - currency
 *               - paymentMethodId
 *             properties:
 *               courseId:
 *                 type: string
 *                 format: uuid
 *                 example: "clx1234567890abcdef"
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *                 example: "clx1234567890abcdef"
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 89.99
 *               currency:
 *                 type: string
 *                 enum: [USD, EUR, GBP, CAD]
 *                 example: "USD"
 *               paymentMethodId:
 *                 type: string
 *                 example: "pm_1234567890abcdef"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Payment for Advanced Calculus course"
 *     responses:
 *       201:
 *         description: Payment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error or payment failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Parent access required
 */
router.post(
  "/",
  authenticate,
  authorize("PARENT"),
  createPaymentValidation,
  validate,
  asyncHandler(paymentController.createPayment)
);

// Create credit package payment (Parent only)
router.post(
  "/credits",
  authenticate,
  authorize("PARENT"),
  createCreditPaymentValidation,
  validate,
  asyncHandler(paymentController.createCreditPayment)
);

/**
 * @swagger
 * /payments/{paymentId}/confirm:
 *   post:
 *     summary: Confirm payment (Parent only)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Payment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentIntentId
 *             properties:
 *               paymentIntentId:
 *                 type: string
 *                 example: "pi_1234567890abcdef"
 *     responses:
 *       200:
 *         description: Payment confirmed successfully
 *       400:
 *         description: Payment confirmation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Parent access required
 *       404:
 *         description: Payment not found
 */
router.post(
  "/:paymentId/confirm",
  authenticate,
  authorize("PARENT"),
  [
    param("paymentId")
      .isInt({ min: 1 })
      .withMessage("Invalid payment ID format"),
    body("paymentIntentId")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Payment intent ID is required"),
  ],
  validate,
  asyncHandler(paymentController.confirmPayment)
);

/**
 * @swagger
 * /payments/{paymentId}/refund:
 *   post:
 *     summary: Process refund (Admin/Coach only)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Payment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 500
 *                 example: "Student requested refund due to scheduling conflict"
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 description: Partial refund amount (optional for full refund)
 *     responses:
 *       200:
 *         description: Refund processed successfully
 *       400:
 *         description: Refund processing failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin/Coach access required
 *       404:
 *         description: Payment not found
 */
router.post(
  "/:paymentId/refund",
  authenticate,
  authorize("ADMIN", "COACH"),
  [
    param("paymentId")
      .isInt({ min: 1 })
      .withMessage("Invalid payment ID format"),
    body("reason")
      .isString()
      .trim()
      .isLength({ min: 10, max: 500 })
      .withMessage("Reason must be between 10 and 500 characters"),
    body("amount")
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage("Refund amount must be greater than 0"),
  ],
  validate,
  asyncHandler(paymentController.processRefund)
);

/**
 * @swagger
 * /payments/{paymentId}/cancel:
 *   post:
 *     summary: Cancel payment (Parent only)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment cancelled successfully
 *       400:
 *         description: Payment cannot be cancelled
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Parent access required
 *       404:
 *         description: Payment not found
 */
router.post(
  "/:paymentId/cancel",
  authenticate,
  authorize("PARENT"),
  [
    param("paymentId")
      .isInt({ min: 1 })
      .withMessage("Invalid payment ID format"),
  ],
  validate,
  asyncHandler(paymentController.cancelPayment)
);

/**
 * @swagger
 * /payments/setup-intent:
 *   post:
 *     summary: Create payment setup intent for saving payment methods
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerId:
 *                 type: string
 *                 description: Stripe customer ID (optional)
 *     responses:
 *       200:
 *         description: Setup intent created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     clientSecret:
 *                       type: string
 *                     setupIntentId:
 *                       type: string
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/setup-intent",
  authenticate,
  authorize("PARENT"),
  asyncHandler(paymentController.createSetupIntent)
);

/**
 * @swagger
 * /payments/payment-methods:
 *   get:
 *     summary: Get saved payment methods for current user
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment methods retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                       card:
 *                         type: object
 *                         properties:
 *                           brand:
 *                             type: string
 *                           last4:
 *                             type: string
 *                           expMonth:
 *                             type: integer
 *                           expYear:
 *                             type: integer
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/payment-methods",
  authenticate,
  authorize("PARENT"),
  asyncHandler(paymentController.getPaymentMethods)
);

/**
 * @swagger
 * /payments/payment-methods/{paymentMethodId}:
 *   delete:
 *     summary: Remove saved payment method
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentMethodId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method ID
 *     responses:
 *       200:
 *         description: Payment method removed successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Payment method not found
 */
router.delete(
  "/payment-methods/:paymentMethodId",
  authenticate,
  authorize("PARENT"),
  [
    param("paymentMethodId")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Payment method ID is required"),
  ],
  validate,
  asyncHandler(paymentController.removePaymentMethod)
);

/**
 * @swagger
 * /payments/invoice/{paymentId}:
 *   get:
 *     summary: Generate payment invoice PDF
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Invoice generated successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Payment not found
 */
router.get(
  "/invoice/:paymentId",
  authenticate,
  [
    param("paymentId")
      .isInt({ min: 1 })
      .withMessage("Invalid payment ID format"),
  ],
  validate,
  asyncHandler(paymentController.generateInvoice)
);

/**
 * @swagger
 * /payments/analytics:
 *   get:
 *     summary: Get payment analytics (Admin only)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *           default: month
 *         description: Analytics period
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for custom period
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for custom period
 *     responses:
 *       200:
 *         description: Payment analytics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.get(
  "/analytics",
  authenticate,
  authorize("ADMIN"),
  [
    query("period").optional().isIn(["day", "week", "month", "year"]),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
  ],
  validate,
  asyncHandler(paymentController.getPaymentAnalytics)
);

export default router;
