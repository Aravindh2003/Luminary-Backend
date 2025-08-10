import express from 'express';
import { body, param, query } from 'express-validator';
import validate from '../middleware/validation.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  // Credit Balance Management
  getCreditBalance,
  updateCreditBalance,
  
  // Credit Transactions
  getCreditTransactions,
  
  // Credit Packages
  getCreditPackages,
  createCreditPackage,
  updateCreditPackage,
  deleteCreditPackage,
  
  // Credit Purchases
  purchaseCredits,
  getCreditPurchases,
  
  // Course Enrollment with Credits
  enrollWithCredits,
  
  // Admin Credit Management
  getAllCreditBalances,
  getCreditSystemStats
} from '../controllers/creditController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     CreditBalance:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         balance:
 *           type: number
 *           format: decimal
 *         totalEarned:
 *           type: number
 *           format: decimal
 *         totalSpent:
 *           type: number
 *           format: decimal
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *         user:
 *           $ref: '#/components/schemas/User'
 *     
 *     CreditTransaction:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [PURCHASE, EARNED, SPENT, REFUND, BONUS, EXPIRED, TRANSFER]
 *         amount:
 *           type: number
 *           format: decimal
 *         balance:
 *           type: number
 *           format: decimal
 *         description:
 *           type: string
 *         referenceId:
 *           type: string
 *         referenceType:
 *           type: string
 *         metadata:
 *           type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 *     
 *     CreditPackage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         credits:
 *           type: number
 *           format: decimal
 *         price:
 *           type: number
 *           format: decimal
 *         currency:
 *           type: string
 *           default: USD
 *         isActive:
 *           type: boolean
 *         isPopular:
 *           type: boolean
 *         bonusCredits:
 *           type: number
 *           format: decimal
 *         validDays:
 *           type: integer
 *     
 *     CreditPurchase:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         packageId:
 *           type: string
 *         packageName:
 *           type: string
 *         credits:
 *           type: number
 *           format: decimal
 *         amount:
 *           type: number
 *           format: decimal
 *         currency:
 *           type: string
 *         paymentId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, CANCELLED, REFUNDED]
 *         purchasedAt:
 *           type: string
 *           format: date-time
 *         expiresAt:
 *           type: string
 *           format: date-time
 */

// Credit Balance Management Routes
/**
 * @swagger
 * /api/v1/credits/balance/{userId}:
 *   get:
 *     summary: Get user's credit balance
 *     tags: [Credits]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Credit balance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CreditBalance'
 *                 message:
 *                   type: string
 *       403:
 *         description: Access denied
 *       404:
 *         description: User not found
 */
router.get('/balance/:userId',
  [
    param('userId').isString().notEmpty().withMessage('User ID is required')
  ],
  validate,
  getCreditBalance
);

/**
 * @swagger
 * /api/v1/credits/balance/{userId}:
 *   put:
 *     summary: Update user's credit balance (Admin only)
 *     tags: [Credits]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - type
 *               - description
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount to add/subtract
 *               type:
 *                 type: string
 *                 enum: [PURCHASE, EARNED, SPENT, REFUND, BONUS, EXPIRED]
 *                 description: Transaction type
 *               description:
 *                 type: string
 *                 description: Transaction description
 *               referenceId:
 *                 type: string
 *                 description: Reference entity ID
 *               referenceType:
 *                 type: string
 *                 description: Reference entity type
 *               metadata:
 *                 type: object
 *                 description: Additional transaction data
 *     responses:
 *       200:
 *         description: Credit balance updated successfully
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
 *                     creditBalance:
 *                       $ref: '#/components/schemas/CreditBalance'
 *                     transaction:
 *                       $ref: '#/components/schemas/CreditTransaction'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Access denied
 */
router.put('/balance/:userId',
  [
    param('userId').isString().notEmpty().withMessage('User ID is required'),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('type').isIn(['PURCHASE', 'EARNED', 'SPENT', 'REFUND', 'BONUS', 'EXPIRED']).withMessage('Invalid transaction type'),
    body('description').isString().notEmpty().withMessage('Description is required')
  ],
  validate,
  authorize('ADMIN'),
  updateCreditBalance
);

// Credit Transactions Routes
/**
 * @swagger
 * /api/v1/credits/transactions/{userId}:
 *   get:
 *     summary: Get user's credit transactions
 *     tags: [Credits]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PURCHASE, EARNED, SPENT, REFUND, BONUS, EXPIRED, TRANSFER]
 *         description: Filter by transaction type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *       - in: query
 *         name: referenceType
 *         schema:
 *           type: string
 *         description: Filter by reference type
 *     responses:
 *       200:
 *         description: Credit transactions retrieved successfully
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
 *                     transactions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CreditTransaction'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                 message:
 *                   type: string
 *       403:
 *         description: Access denied
 */
router.get('/transactions/:userId',
  [
    param('userId').isString().notEmpty().withMessage('User ID is required'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('type').optional().isIn(['PURCHASE', 'EARNED', 'SPENT', 'REFUND', 'BONUS', 'EXPIRED', 'TRANSFER']).withMessage('Invalid transaction type'),
    query('referenceType').optional().isString().withMessage('Reference type must be a string')
  ],
  validate,
  getCreditTransactions
);

// Credit Packages Routes
/**
 * @swagger
 * /api/v1/credits/packages:
 *   get:
 *     summary: Get available credit packages
 *     tags: [Credits]
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Credit packages retrieved successfully
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
 *                     packages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CreditPackage'
 *                 message:
 *                   type: string
 */
router.get('/packages',
  [
    query('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
  ],
  validate,
  getCreditPackages
);

/**
 * @swagger
 * /api/v1/credits/packages:
 *   post:
 *     summary: Create a new credit package (Admin only)
 *     tags: [Credits]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - credits
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 description: Package name
 *               description:
 *                 type: string
 *                 description: Package description
 *               credits:
 *                 type: number
 *                 format: decimal
 *                 description: Number of credits in package
 *               price:
 *                 type: number
 *                 format: decimal
 *                 description: Package price
 *               currency:
 *                 type: string
 *                 default: USD
 *                 description: Currency code
 *               isActive:
 *                 type: boolean
 *                 default: true
 *                 description: Whether package is active
 *               isPopular:
 *                 type: boolean
 *                 default: false
 *                 description: Whether package is marked as popular
 *               bonusCredits:
 *                 type: number
 *                 format: decimal
 *                 default: 0
 *                 description: Bonus credits included
 *               validDays:
 *                 type: integer
 *                 description: Days until credits expire
 *     responses:
 *       201:
 *         description: Credit package created successfully
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
 *                     creditPackage:
 *                       $ref: '#/components/schemas/CreditPackage'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Access denied
 */
router.post('/packages',
  [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('credits').isNumeric().withMessage('Credits must be a number'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('currency').optional().isString().withMessage('Currency must be a string'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
    body('isPopular').optional().isBoolean().withMessage('isPopular must be a boolean'),
    body('bonusCredits').optional().isNumeric().withMessage('Bonus credits must be a number'),
    body('validDays').optional().isInt({ min: 1 }).withMessage('Valid days must be a positive integer')
  ],
  validate,
  authorize('ADMIN'),
  createCreditPackage
);

/**
 * @swagger
 * /api/v1/credits/packages/{packageId}:
 *   put:
 *     summary: Update a credit package (Admin only)
 *     tags: [Credits]
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Package ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               credits:
 *                 type: number
 *                 format: decimal
 *               price:
 *                 type: number
 *                 format: decimal
 *               currency:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               isPopular:
 *                 type: boolean
 *               bonusCredits:
 *                 type: number
 *                 format: decimal
 *               validDays:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Credit package updated successfully
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
 *                     creditPackage:
 *                       $ref: '#/components/schemas/CreditPackage'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Access denied
 *       404:
 *         description: Package not found
 */
router.put('/packages/:packageId',
  [
    param('packageId').isString().notEmpty().withMessage('Package ID is required')
  ],
  validate,
  authorize('ADMIN'),
  updateCreditPackage
);

/**
 * @swagger
 * /api/v1/credits/packages/{packageId}:
 *   delete:
 *     summary: Delete a credit package (Admin only)
 *     tags: [Credits]
 *     parameters:
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Package ID
 *     responses:
 *       200:
 *         description: Credit package deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *       403:
 *         description: Access denied
 *       404:
 *         description: Package not found
 */
router.delete('/packages/:packageId',
  [
    param('packageId').isString().notEmpty().withMessage('Package ID is required')
  ],
  validate,
  authorize('ADMIN'),
  deleteCreditPackage
);

// Credit Purchases Routes
/**
 * @swagger
 * /api/v1/credits/purchase/{userId}:
 *   post:
 *     summary: Purchase credits
 *     tags: [Credits]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - packageId
 *             properties:
 *               packageId:
 *                 type: string
 *                 description: Credit package ID
 *               paymentMethod:
 *                 type: string
 *                 description: Payment method used
 *               paymentId:
 *                 type: string
 *                 description: Payment ID from payment processor
 *     responses:
 *       201:
 *         description: Credit purchase created successfully
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
 *                     creditPurchase:
 *                       $ref: '#/components/schemas/CreditPurchase'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Access denied
 *       404:
 *         description: Package not found
 */
router.post('/purchase/:userId',
  [
    param('userId').isString().notEmpty().withMessage('User ID is required'),
    body('packageId').isString().notEmpty().withMessage('Package ID is required'),
    body('paymentMethod').optional().isString().withMessage('Payment method must be a string'),
    body('paymentId').optional().isString().withMessage('Payment ID must be a string')
  ],
  validate,
  purchaseCredits
);

/**
 * @swagger
 * /api/v1/credits/purchases/{userId}:
 *   get:
 *     summary: Get user's credit purchases
 *     tags: [Credits]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, CANCELLED, REFUNDED]
 *         description: Filter by purchase status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *     responses:
 *       200:
 *         description: Credit purchases retrieved successfully
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
 *                     purchases:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CreditPurchase'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                 message:
 *                   type: string
 *       403:
 *         description: Access denied
 */
router.get('/purchases/:userId',
  [
    param('userId').isString().notEmpty().withMessage('User ID is required'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED']).withMessage('Invalid status'),
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid date')
  ],
  validate,
  getCreditPurchases
);

// Course Enrollment with Credits
/**
 * @swagger
 * /api/v1/credits/enroll/{userId}:
 *   post:
 *     summary: Enroll in course using credits
 *     tags: [Credits]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courseId
 *               - childrenIds
 *             properties:
 *               courseId:
 *                 type: string
 *                 description: Course ID
 *               childrenIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of child user IDs
 *     responses:
 *       201:
 *         description: Course enrollment completed successfully
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
 *                     enrollments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Session'
 *                     creditBalance:
 *                       $ref: '#/components/schemas/CreditBalance'
 *                     transaction:
 *                       $ref: '#/components/schemas/CreditTransaction'
 *                     totalCreditCost:
 *                       type: number
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input or insufficient credits
 *       403:
 *         description: Access denied
 *       404:
 *         description: Course not found
 */
router.post('/enroll/:userId',
  [
    param('userId').isString().notEmpty().withMessage('User ID is required'),
    body('courseId').isString().notEmpty().withMessage('Course ID is required'),
    body('childrenIds').isArray({ min: 1 }).withMessage('At least one child ID is required'),
    body('childrenIds.*').isString().withMessage('Child ID must be a string')
  ],
  validate,
  enrollWithCredits
);

// Admin Credit Management Routes
/**
 * @swagger
 * /api/v1/credits/admin/balances:
 *   get:
 *     summary: Get all credit balances (Admin only)
 *     tags: [Credits - Admin]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by user name or email
 *       - in: query
 *         name: minBalance
 *         schema:
 *           type: number
 *         description: Minimum balance filter
 *       - in: query
 *         name: maxBalance
 *         schema:
 *           type: number
 *         description: Maximum balance filter
 *     responses:
 *       200:
 *         description: Credit balances retrieved successfully
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
 *                     creditBalances:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CreditBalance'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *                 message:
 *                   type: string
 *       403:
 *         description: Access denied
 */
router.get('/admin/balances',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isString().withMessage('Search must be a string'),
    query('minBalance').optional().isNumeric().withMessage('Min balance must be a number'),
    query('maxBalance').optional().isNumeric().withMessage('Max balance must be a number')
  ],
  validate,
  authorize('ADMIN'),
  getAllCreditBalances
);

/**
 * @swagger
 * /api/v1/credits/admin/stats:
 *   get:
 *     summary: Get credit system statistics (Admin only)
 *     tags: [Credits - Admin]
 *     responses:
 *       200:
 *         description: Credit system stats retrieved successfully
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
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalUsers:
 *                           type: integer
 *                         totalCredits:
 *                           type: number
 *                           format: decimal
 *                         totalEarned:
 *                           type: number
 *                           format: decimal
 *                         totalSpent:
 *                           type: number
 *                           format: decimal
 *                     recentTransactions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CreditTransaction'
 *                     popularPackages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           packageId:
 *                             type: string
 *                           _count:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                 message:
 *                   type: string
 *       403:
 *         description: Access denied
 */
router.get('/admin/stats',
  authorize('ADMIN'),
  getCreditSystemStats
);

export default router; 