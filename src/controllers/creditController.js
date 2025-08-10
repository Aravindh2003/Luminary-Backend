import { PrismaClient } from '@prisma/client';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';
import resendEmailService from '../services/resendEmailService.js';

const prisma = new PrismaClient();

// Credit Balance Management
export const getCreditBalance = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Validate that the user can access this balance
  if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
    throw new ApiError(403, 'Access denied');
  }

  let creditBalance = await prisma.creditBalance.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  // Create balance if it doesn't exist
  if (!creditBalance) {
    creditBalance = await prisma.creditBalance.create({
      data: {
        userId,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });
  }

  res.status(200).json(new ApiResponse(200, {
    creditBalance
  }, 'Credit balance retrieved successfully'));
});

export const updateCreditBalance = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { amount, type, description, referenceId, referenceType, metadata = {} } = req.body;

  // Only admins can manually update credit balances
  if (req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Access denied. Only admins can update credit balances.');
  }

  if (!amount || !type || !description) {
    throw new ApiError(400, 'Amount, type, and description are required');
  }

  // Validate amount
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount === 0) {
    throw new ApiError(400, 'Invalid amount');
  }

  // Get or create credit balance
  let creditBalance = await prisma.creditBalance.findUnique({
    where: { userId }
  });

  if (!creditBalance) {
    creditBalance = await prisma.creditBalance.create({
      data: {
        userId,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0
      }
    });
  }

  // Calculate new balance
  const currentBalance = parseFloat(creditBalance.balance);
  let newBalance = currentBalance;

  // Update balance based on transaction type
  switch (type.toUpperCase()) {
    case 'PURCHASE':
    case 'EARNED':
    case 'BONUS':
    case 'REFUND':
      newBalance += numAmount;
      break;
    case 'SPENT':
    case 'EXPIRED':
      newBalance -= Math.abs(numAmount);
      break;
    default:
      throw new ApiError(400, 'Invalid transaction type');
  }

  // Ensure balance doesn't go negative (except for admins)
  if (newBalance < 0) {
    throw new ApiError(400, 'Insufficient credits');
  }

  // Update balance and create transaction
  const [updatedBalance, transaction] = await prisma.$transaction([
    prisma.creditBalance.update({
      where: { userId },
      data: {
        balance: newBalance,
        totalEarned: type.toUpperCase() === 'EARNED' || type.toUpperCase() === 'BONUS' 
          ? parseFloat(creditBalance.totalEarned) + Math.abs(numAmount)
          : creditBalance.totalEarned,
        totalSpent: type.toUpperCase() === 'SPENT' 
          ? parseFloat(creditBalance.totalSpent) + Math.abs(numAmount)
          : creditBalance.totalSpent,
        lastUpdated: new Date()
      }
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        type: type.toUpperCase(),
        amount: numAmount,
        balance: newBalance,
        description,
        referenceId,
        referenceType,
        metadata
      }
    })
  ]);

  logger.info(`Credit balance updated for user ${userId}: ${type} ${numAmount} credits`);

  res.status(200).json(new ApiResponse(200, {
    creditBalance: updatedBalance,
    transaction
  }, 'Credit balance updated successfully'));
});

// Credit Transactions
export const getCreditTransactions = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { 
    page = 1, 
    limit = 10, 
    type, 
    startDate, 
    endDate,
    referenceType 
  } = req.query;

  // Validate that the user can access these transactions
  if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
    throw new ApiError(403, 'Access denied');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = { userId };

  if (type) {
    where.type = type.toUpperCase();
  }

  if (referenceType) {
    where.referenceType = referenceType.toUpperCase();
  }

  if (startDate && endDate) {
    where.createdAt = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  const [transactions, total] = await Promise.all([
    prisma.creditTransaction.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    prisma.creditTransaction.count({ where })
  ]);

  res.status(200).json(new ApiResponse(200, {
    transactions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  }, 'Credit transactions retrieved successfully'));
});

// Credit Packages
export const getCreditPackages = asyncHandler(async (req, res) => {
  const { isActive = true } = req.query;

  const where = {};
  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  const packages = await prisma.creditPackage.findMany({
    where,
    orderBy: [
      { isPopular: 'desc' },
      { credits: 'asc' }
    ]
  });

  res.status(200).json(new ApiResponse(200, {
    packages
  }, 'Credit packages retrieved successfully'));
});

export const createCreditPackage = asyncHandler(async (req, res) => {
  const { 
    name, 
    description, 
    credits, 
    price, 
    currency = 'USD',
    isActive = true,
    isPopular = false,
    bonusCredits = 0,
    validDays 
  } = req.body;

  // Only admins can create credit packages
  if (req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Access denied. Only admins can create credit packages.');
  }

  if (!name || !description || !credits || !price) {
    throw new ApiError(400, 'Name, description, credits, and price are required');
  }

  const packageData = {
    name,
    description,
    credits: parseFloat(credits),
    price: parseFloat(price),
    currency,
    isActive,
    isPopular,
    bonusCredits: parseFloat(bonusCredits),
    validDays: validDays ? parseInt(validDays) : null
  };

  const creditPackage = await prisma.creditPackage.create({
    data: packageData
  });

  logger.info(`Credit package created: ${name} by admin ${req.user.id}`);

  res.status(201).json(new ApiResponse(201, {
    creditPackage
  }, 'Credit package created successfully'));
});

export const updateCreditPackage = asyncHandler(async (req, res) => {
  const { packageId } = req.params;
  const updateData = req.body;

  // Only admins can update credit packages
  if (req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Access denied. Only admins can update credit packages.');
  }

  // Remove undefined values
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  // Convert numeric fields
  if (updateData.credits) updateData.credits = parseFloat(updateData.credits);
  if (updateData.price) updateData.price = parseFloat(updateData.price);
  if (updateData.bonusCredits) updateData.bonusCredits = parseFloat(updateData.bonusCredits);
  if (updateData.validDays) updateData.validDays = parseInt(updateData.validDays);

  const creditPackage = await prisma.creditPackage.update({
    where: { id: packageId },
    data: updateData
  });

  logger.info(`Credit package updated: ${packageId} by admin ${req.user.id}`);

  res.status(200).json(new ApiResponse(200, {
    creditPackage
  }, 'Credit package updated successfully'));
});

export const deleteCreditPackage = asyncHandler(async (req, res) => {
  const { packageId } = req.params;

  // Only admins can delete credit packages
  if (req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Access denied. Only admins can delete credit packages.');
  }

  await prisma.creditPackage.delete({
    where: { id: packageId }
  });

  logger.info(`Credit package deleted: ${packageId} by admin ${req.user.id}`);

  res.status(200).json(new ApiResponse(200, {}, 'Credit package deleted successfully'));
});

// Credit Purchases
export const purchaseCredits = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { packageId, paymentMethod, paymentId } = req.body;

  // Validate that the user can make this purchase
  if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
    throw new ApiError(403, 'Access denied');
  }

  if (!packageId) {
    throw new ApiError(400, 'Package ID is required');
  }

  // Get credit package
  const creditPackage = await prisma.creditPackage.findUnique({
    where: { id: packageId }
  });

  if (!creditPackage) {
    throw new ApiError(404, 'Credit package not found');
  }

  if (!creditPackage.isActive) {
    throw new ApiError(400, 'Credit package is not available');
  }

  // Calculate total credits (including bonus)
  const totalCredits = parseFloat(creditPackage.credits) + parseFloat(creditPackage.bonusCredits);
  const expiresAt = creditPackage.validDays 
    ? new Date(Date.now() + creditPackage.validDays * 24 * 60 * 60 * 1000)
    : null;

  // Create credit purchase
  const creditPurchase = await prisma.creditPurchase.create({
    data: {
      userId,
      packageId,
      packageName: creditPackage.name,
      credits: totalCredits,
      amount: parseFloat(creditPackage.price),
      currency: creditPackage.currency,
      paymentId,
      status: paymentId ? 'SUCCEEDED' : 'PENDING',
      expiresAt
    }
  });

  // If payment is completed, add credits to balance
  if (creditPurchase.status === 'SUCCEEDED') {
    await addCreditsToBalance(userId, totalCredits, 'PURCHASE', 
      `Purchased ${creditPackage.name} package`, creditPurchase.id, 'PURCHASE');
  }

  logger.info(`Credit purchase created: ${creditPurchase.id} for user ${userId}`);

  res.status(201).json(new ApiResponse(201, {
    creditPurchase
  }, 'Credit purchase created successfully'));
});

export const getCreditPurchases = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { 
    page = 1, 
    limit = 10, 
    status, 
    startDate, 
    endDate 
  } = req.query;

  // Validate that the user can access these purchases
  if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
    throw new ApiError(403, 'Access denied');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = { userId };

  if (status) {
    where.status = status.toUpperCase();
  }

  if (startDate && endDate) {
    where.purchasedAt = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  const [purchases, total] = await Promise.all([
    prisma.creditPurchase.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true
          }
        }
      },
      orderBy: { purchasedAt: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    prisma.creditPurchase.count({ where })
  ]);

  res.status(200).json(new ApiResponse(200, {
    purchases,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  }, 'Credit purchases retrieved successfully'));
});

// Helper function to add credits to balance
async function addCreditsToBalance(userId, amount, type, description, referenceId, referenceType, metadata = {}) {
  // Get or create credit balance
  let creditBalance = await prisma.creditBalance.findUnique({
    where: { userId }
  });

  if (!creditBalance) {
    creditBalance = await prisma.creditBalance.create({
      data: {
        userId,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0
      }
    });
  }

  const currentBalance = parseFloat(creditBalance.balance);
  const newBalance = currentBalance + parseFloat(amount);

  // Update balance and create transaction
  const [updatedBalance, transaction] = await prisma.$transaction([
    prisma.creditBalance.update({
      where: { userId },
      data: {
        balance: newBalance,
        totalEarned: type === 'EARNED' || type === 'BONUS' || type === 'PURCHASE'
          ? parseFloat(creditBalance.totalEarned) + Math.abs(parseFloat(amount))
          : creditBalance.totalEarned,
        totalSpent: type === 'SPENT'
          ? parseFloat(creditBalance.totalSpent) + Math.abs(parseFloat(amount))
          : creditBalance.totalSpent,
        lastUpdated: new Date()
      }
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        type: type.toUpperCase(),
        amount: parseFloat(amount),
        balance: newBalance,
        description,
        referenceId,
        referenceType,
        metadata
      }
    })
  ]);

  return { updatedBalance, transaction };
}

// Course Enrollment with Credits
export const enrollWithCredits = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { courseId, childrenIds = [] } = req.body;

  // Validate that the user can make this enrollment
  if (req.user.role !== 'ADMIN' && req.user.id !== userId) {
    throw new ApiError(403, 'Access denied');
  }

  if (!courseId || !childrenIds.length) {
    throw new ApiError(400, 'Course ID and children IDs are required');
  }

  // Get course details
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      coach: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  if (!course.isActive) {
    throw new ApiError(400, 'Course is not available');
  }

  // Calculate total credit cost
  const creditCostPerChild = parseFloat(course.creditCost);
  const totalCreditCost = creditCostPerChild * childrenIds.length;

  if (totalCreditCost <= 0) {
    throw new ApiError(400, 'Course has no credit cost set');
  }

  // Check user's credit balance
  let creditBalance = await prisma.creditBalance.findUnique({
    where: { userId }
  });

  if (!creditBalance) {
    creditBalance = await prisma.creditBalance.create({
      data: {
        userId,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0
      }
    });
  }

  const currentBalance = parseFloat(creditBalance.balance);
  if (currentBalance < totalCreditCost) {
    throw new ApiError(400, `Insufficient credits. Required: ${totalCreditCost}, Available: ${currentBalance}`);
  }

  // Deduct credits and create enrollment
  const newBalance = currentBalance - totalCreditCost;

  const [updatedBalance, transaction] = await prisma.$transaction([
    prisma.creditBalance.update({
      where: { userId },
      data: {
        balance: newBalance,
        totalSpent: parseFloat(creditBalance.totalSpent) + totalCreditCost,
        lastUpdated: new Date()
      }
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        type: 'SPENT',
        amount: -totalCreditCost,
        balance: newBalance,
        description: `Enrolled ${childrenIds.length} child(ren) in ${course.title}`,
        referenceId: courseId,
        referenceType: 'COURSE',
        metadata: {
          courseId,
          courseTitle: course.title,
          childrenIds,
          creditCostPerChild,
          totalCreditCost
        }
      }
    })
  ]);

  // Create enrollment records (you may need to adjust this based on your enrollment model)
  const enrollments = [];
  for (const childId of childrenIds) {
    // Create enrollment record - adjust based on your actual enrollment model
    const enrollment = await prisma.session.create({
      data: {
        courseId,
        coachId: course.coachId,
        studentId: childId, // Assuming childId maps to a user
        title: `Enrollment in ${course.title}`,
        description: `Enrolled using ${creditCostPerChild} credits`,
        startTime: new Date(),
        endTime: new Date(),
        duration: course.duration,
        status: 'SCHEDULED'
      }
    });
    enrollments.push(enrollment);
  }

  // Send notification to coach
  await resendEmailService.sendEmail({
    to: course.coach.email,
    subject: 'New Course Enrollment',
    html: `
      <h2>New Course Enrollment</h2>
      <p>You have a new enrollment in your course: ${course.title}</p>
      <p><strong>Students:</strong> ${childrenIds.length}</p>
      <p><strong>Credits Used:</strong> ${totalCreditCost}</p>
      <p>Please review and prepare for the upcoming sessions.</p>
    `
  });

  logger.info(`Course enrollment completed: ${courseId} for user ${userId} with ${totalCreditCost} credits`);

  res.status(201).json(new ApiResponse(201, {
    enrollments,
    creditBalance: updatedBalance,
    transaction,
    totalCreditCost
  }, 'Course enrollment completed successfully'));
});

// Admin Credit Management
export const getAllCreditBalances = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    search, 
    minBalance, 
    maxBalance 
  } = req.query;

  // Only admins can view all credit balances
  if (req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Access denied. Only admins can view all credit balances.');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = {};

  if (search) {
    where.user = {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    };
  }

  if (minBalance !== undefined || maxBalance !== undefined) {
    where.balance = {};
    if (minBalance !== undefined) where.balance.gte = parseFloat(minBalance);
    if (maxBalance !== undefined) where.balance.lte = parseFloat(maxBalance);
  }

  const [creditBalances, total] = await Promise.all([
    prisma.creditBalance.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: [
        { balance: 'desc' },
        { lastUpdated: 'desc' }
      ],
      skip,
      take: parseInt(limit)
    }),
    prisma.creditBalance.count({ where })
  ]);

  res.status(200).json(new ApiResponse(200, {
    creditBalances,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  }, 'Credit balances retrieved successfully'));
});

export const getCreditSystemStats = asyncHandler(async (req, res) => {
  // Only admins can view system stats
  if (req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Access denied. Only admins can view system stats.');
  }

  const [
    totalUsers,
    totalCredits,
    totalEarned,
    totalSpent,
    recentTransactions,
    popularPackages
  ] = await Promise.all([
    prisma.creditBalance.count(),
    prisma.creditBalance.aggregate({
      _sum: { balance: true }
    }),
    prisma.creditBalance.aggregate({
      _sum: { totalEarned: true }
    }),
    prisma.creditBalance.aggregate({
      _sum: { totalSpent: true }
    }),
    prisma.creditTransaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    }),
    prisma.creditPurchase.groupBy({
      by: ['packageId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    })
  ]);

  res.status(200).json(new ApiResponse(200, {
    stats: {
      totalUsers,
      totalCredits: totalCredits._sum.balance || 0,
      totalEarned: totalEarned._sum.totalEarned || 0,
      totalSpent: totalSpent._sum.totalSpent || 0
    },
    recentTransactions,
    popularPackages
  }, 'Credit system stats retrieved successfully'));
}); 