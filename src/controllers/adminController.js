import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import emailService from '../services/emailService.js';
import logger from '../utils/logger.js';

// Get admin dashboard statistics - matches frontend AdminDashboard stats
export const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await prisma.$transaction(async (tx) => {
    const totalCoaches = await tx.coach.count();
    const pendingCoaches = await tx.coach.count({
      where: { status: 'PENDING' }
    });
    const approvedCoaches = await tx.coach.count({
      where: { status: 'APPROVED' }
    });
    const rejectedCoaches = await tx.coach.count({
      where: { status: 'REJECTED' }
    });

    // Additional stats for admin dashboard
    const totalParents = await tx.user.count({
      where: { role: 'PARENT' }
    });
    const totalSessions = await tx.session.count();
    const totalRevenue = await tx.payment.aggregate({
      where: { status: 'SUCCEEDED' },
      _sum: { amount: true }
    });

    return {
      totalCoaches,
      pendingCoaches,
      approvedCoaches,
      rejectedCoaches,
      totalParents,
      totalSessions,
      totalRevenue: totalRevenue._sum.amount || 0
    };
  });

  res.json(
    new ApiResponse(200, stats, 'Dashboard statistics retrieved successfully')
  );
});

// Get admin dashboard data - matches frontend AdminDashboard interface
export const getDashboard = asyncHandler(async (req, res) => {
  const stats = await prisma.$transaction(async (tx) => {
    const totalCoaches = await tx.coach.count();
    const pendingCoaches = await tx.coach.count({
      where: { status: 'PENDING' }
    });
    const approvedCoaches = await tx.coach.count({
      where: { status: 'APPROVED' }
    });
    const rejectedCoaches = await tx.coach.count({
      where: { status: 'REJECTED' }
    });

    // Additional stats for admin dashboard
    const totalParents = await tx.user.count({
      where: { role: 'PARENT' }
    });
    const totalSessions = await tx.session.count();
    const totalRevenue = await tx.payment.aggregate({
      where: { status: 'SUCCEEDED' },
      _sum: { amount: true }
    });

    // Get total users (parents + coaches)
    const totalUsers = totalParents + totalCoaches;
    
    // Get total courses
    const totalCourses = await tx.course.count();
    
    // Get pending course approvals (courses that are not active)
    const pendingCourseApprovals = await tx.course.count({
      where: { isActive: false }
    });

    // Get recent activity (last 10 activities)
    const recentActivity = await tx.coach.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Get monthly stats (current month)
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const monthlyStats = await prisma.$transaction(async (tx) => {
      const newUsers = await tx.user.count({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      });

      const newCoaches = await tx.coach.count({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      });

      const newCourses = await tx.course.count({
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      });

      const revenue = await tx.payment.aggregate({
        where: {
          status: 'SUCCEEDED',
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        },
        _sum: { amount: true }
      });

      return {
        newUsers,
        newCoaches,
        newCourses,
        revenue: revenue._sum.amount || 0
      };
    });

    return {
      totalUsers,
      totalCoaches,
      totalCourses,
      totalSessions,
      totalRevenue: totalRevenue._sum.amount || 0,
      pendingCoachApprovals: pendingCoaches,
      pendingCourseApprovals,
      recentActivity,
      monthlyStats
    };
  });

  res.json(
    new ApiResponse(200, { dashboard: stats }, 'Dashboard data retrieved successfully')
  );
});

// Get all coaches with filtering and search - matches frontend AdminDashboard
export const getCoaches = asyncHandler(async (req, res) => {
  const {
    status = 'all',
    search = '',
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build where clause for filtering
  const where = {};
  
  // Status filter
  if (status !== 'all') {
    where.status = status.toUpperCase();
  }

  // Search filter - matches frontend search functionality
  if (search) {
    where.OR = [
      {
        user: {
          firstName: {
            contains: search,
            mode: 'insensitive'
          }
        }
      },
      {
        user: {
          lastName: {
            contains: search,
            mode: 'insensitive'
          }
        }
      },
      {
        user: {
          email: {
            contains: search,
            mode: 'insensitive'
          }
        }
      },
      {
        domain: {
          contains: search,
          mode: 'insensitive'
        }
      }
    ];
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  // Sort order
  const orderBy = {};
  if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
    orderBy[sortBy] = sortOrder;
  } else if (sortBy === 'name') {
    orderBy.user = { firstName: sortOrder };
  } else if (sortBy === 'email') {
    orderBy.user = { email: sortOrder };
  } else {
    orderBy[sortBy] = sortOrder;
  }

  const [coaches, totalCount] = await Promise.all([
    prisma.coach.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isVerified: true,
            createdAt: true,
            lastLogin: true
          }
        },
        approvedByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        rejectedByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy,
      skip,
      take
    }),
    prisma.coach.count({ where })
  ]);

  // Format response to match frontend expectations
  const formattedCoaches = coaches.map(coach => ({
    id: coach.id,
    firstName: coach.user.firstName,
    lastName: coach.user.lastName,
    email: coach.user.email,
    phone: coach.user.phone,
    domain: coach.domain,
    experienceDescription: coach.experienceDescription,
    address: coach.address,
    languages: coach.languages,
    status: coach.status,
    rating: coach.rating,
    totalReviews: coach.totalReviews,
    totalStudents: coach.totalStudents,
    licenseFileUrl: coach.licenseFileUrl,
    resumeFileUrl: coach.resumeFileUrl,
    introVideoUrl: coach.introVideoUrl,
    adminNotes: coach.adminNotes,
    registrationDate: coach.createdAt,
    approvedAt: coach.approvedAt,
    rejectedAt: coach.rejectedAt,
    approvedBy: coach.approvedByUser,
    rejectedBy: coach.rejectedByUser,
    rejectionReason: coach.rejectionReason,
    isVerified: coach.user.isVerified,
    lastLogin: coach.user.lastLogin
  }));

  const totalPages = Math.ceil(totalCount / take);

  res.json(
    new ApiResponse(200, {
      coaches: formattedCoaches,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    }, 'Coaches retrieved successfully')
  );
});

// Get single coach details - matches frontend coach profile modal
export const getCoachDetails = asyncHandler(async (req, res) => {
  const { coachId } = req.params;

  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isVerified: true,
          createdAt: true,
          lastLogin: true,
          profileImageUrl: true
        }
      },
      approvedByUser: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      },
      rejectedByUser: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      },
      courses: {
        select: {
          id: true,
          title: true,
          category: true,
          level: true,
          price: true,
          isActive: true
        }
      },
      coachSessions: {
        select: {
          id: true,
          title: true,
          status: true,
          startTime: true,
          endTime: true
        },
        orderBy: {
          startTime: 'desc'
        },
        take: 5
      }
    }
  });

  if (!coach) {
    throw new ApiError(404, 'Coach not found');
  }

  // Format response to match frontend expectations
  const formattedCoach = {
    id: coach.id,
    user: coach.user,
    domain: coach.domain,
    experienceDescription: coach.experienceDescription,
    address: coach.address,
    languages: coach.languages,
    hourlyRate: coach.hourlyRate,
    bio: coach.bio,
    education: coach.education,
    certifications: coach.certifications,
    specializations: coach.specializations,
    status: coach.status,
    rating: coach.rating,
    totalReviews: coach.totalReviews,
    totalStudents: coach.totalStudents,
    totalEarnings: coach.totalEarnings,
    licenseFileUrl: coach.licenseFileUrl,
    resumeFileUrl: coach.resumeFileUrl,
    introVideoUrl: coach.introVideoUrl,
    adminNotes: coach.adminNotes,
    registrationDate: coach.createdAt,
    approvedAt: coach.approvedAt,
    rejectedAt: coach.rejectedAt,
    approvedBy: coach.approvedByUser,
    rejectedBy: coach.rejectedByUser,
    rejectionReason: coach.rejectionReason,
    courses: coach.courses,
    recentSessions: coach.coachSessions
  };

  res.json(
    new ApiResponse(200, formattedCoach, 'Coach details retrieved successfully')
  );
});

// Approve coach - matches frontend approval workflow
export const approveCoach = asyncHandler(async (req, res) => {
  const { coachId } = req.params;
  const { adminNotes } = req.body;
  const adminId = req.user.id;

  // Check if coach exists and is pending
  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    include: {
      user: true
    }
  });

  if (!coach) {
    throw new ApiError(404, 'Coach not found');
  }

  if (coach.status !== 'PENDING') {
    throw new ApiError(400, `Coach is already ${coach.status.toLowerCase()}`);
  }

  // Update coach status to approved
  const updatedCoach = await prisma.coach.update({
    where: { id: coachId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: adminId,
      adminNotes: adminNotes || null,
      // Clear any previous rejection data
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null
    },
    include: {
      user: true,
      approvedByUser: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  // Send approval notification email using Resend
  try {
    await emailService.sendCoachApprovalNotification(updatedCoach.user, adminNotes);
    logger.info(`Coach approval notification sent to ${updatedCoach.user.email} via Resend`);
  } catch (error) {
    logger.error('Failed to send coach approval notification via Resend:', error);
    // Don't fail the approval if email fails
  }

  // Log admin action
  logger.info(`Coach approved by admin`, {
    coachId,
    coachEmail: coach.user.email,
    adminId,
    adminNotes
  });

  res.json(
    new ApiResponse(200, {
      id: updatedCoach.id,
      status: updatedCoach.status,
      approvedAt: updatedCoach.approvedAt,
      approvedBy: updatedCoach.approvedByUser,
      adminNotes: updatedCoach.adminNotes
    }, 'Coach approved successfully')
  );
});

// Reject coach - matches frontend rejection workflow
export const rejectCoach = asyncHandler(async (req, res) => {
  const { coachId } = req.params;
  const { rejectionReason, adminNotes } = req.body;
  const adminId = req.user.id;

  // Check if coach exists and is pending
  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    include: {
      user: true
    }
  });

  if (!coach) {
    throw new ApiError(404, 'Coach not found');
  }

  if (coach.status !== 'PENDING') {
    throw new ApiError(400, `Coach is already ${coach.status.toLowerCase()}`);
  }

  // Update coach status to rejected
  const updatedCoach = await prisma.coach.update({
    where: { id: coachId },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectedBy: adminId,
      rejectionReason: rejectionReason || 'No specific reason provided',
      adminNotes: adminNotes || null,
      // Clear any previous approval data
      approvedAt: null,
      approvedBy: null
    },
    include: {
      user: true,
      rejectedByUser: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  // Send rejection notification email using Resend
  try {
    await emailService.sendCoachRejectionNotification(updatedCoach.user, rejectionReason);
    logger.info(`Coach rejection notification sent to ${updatedCoach.user.email} via Resend`);
  } catch (error) {
    logger.error('Failed to send coach rejection notification via Resend:', error);
    // Don't fail the rejection if email fails
  }

  // Log admin action
  logger.info(`Coach rejected by admin`, {
    coachId,
    coachEmail: coach.user.email,
    adminId,
    rejectionReason,
    adminNotes
  });

  res.json(
    new ApiResponse(200, {
      id: updatedCoach.id,
      status: updatedCoach.status,
      rejectedAt: updatedCoach.rejectedAt,
      rejectedBy: updatedCoach.rejectedByUser,
      rejectionReason: updatedCoach.rejectionReason,
      adminNotes: updatedCoach.adminNotes
    }, 'Coach rejected successfully')
  );
});

// Suspend coach - additional admin functionality
export const suspendCoach = asyncHandler(async (req, res) => {
  const { coachId } = req.params;
  const { reason, adminNotes } = req.body;
  const adminId = req.user.id;

  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    include: { user: true }
  });

  if (!coach) {
    throw new ApiError(404, 'Coach not found');
  }

  if (coach.status !== 'APPROVED') {
    throw new ApiError(400, 'Only approved coaches can be suspended');
  }

  const updatedCoach = await prisma.coach.update({
    where: { id: coachId },
    data: {
      status: 'SUSPENDED',
      adminNotes: adminNotes || null,
      // Store suspension info in a JSON field if needed
      // suspensionReason: reason
    }
  });

  // Also deactivate the user account
  await prisma.user.update({
    where: { id: coach.userId },
    data: { isActive: false }
  });

  logger.info(`Coach suspended by admin`, {
    coachId,
    coachEmail: coach.user.email,
    adminId,
    reason,
    adminNotes
  });

  res.json(
    new ApiResponse(200, {
      id: updatedCoach.id,
      status: updatedCoach.status,
      adminNotes: updatedCoach.adminNotes
    }, 'Coach suspended successfully')
  );
});

// Reactivate suspended coach
export const reactivateCoach = asyncHandler(async (req, res) => {
  const { coachId } = req.params;
  const { adminNotes } = req.body;
  const adminId = req.user.id;

  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    include: { user: true }
  });

  if (!coach) {
    throw new ApiError(404, 'Coach not found');
  }

  if (coach.status !== 'SUSPENDED') {
    throw new ApiError(400, 'Coach is not suspended');
  }

  const updatedCoach = await prisma.coach.update({
    where: { id: coachId },
    data: {
      status: 'APPROVED',
      adminNotes: adminNotes || null
    }
  });

  // Reactivate the user account
  await prisma.user.update({
    where: { id: coach.userId },
    data: { isActive: true }
  });

  logger.info(`Coach reactivated by admin`, {
    coachId,
    coachEmail: coach.user.email,
    adminId,
    adminNotes
  });

  res.json(
    new ApiResponse(200, {
      id: updatedCoach.id,
      status: updatedCoach.status,
      adminNotes: updatedCoach.adminNotes
    }, 'Coach reactivated successfully')
  );
});

// Update admin notes for a coach
export const updateCoachNotes = asyncHandler(async (req, res) => {
  const { coachId } = req.params;
  const { adminNotes } = req.body;
  const adminId = req.user.id;

  const coach = await prisma.coach.findUnique({
    where: { id: coachId }
  });

  if (!coach) {
    throw new ApiError(404, 'Coach not found');
  }

  const updatedCoach = await prisma.coach.update({
    where: { id: coachId },
    data: {
      adminNotes: adminNotes || null
    }
  });

  logger.info(`Coach notes updated by admin`, {
    coachId,
    adminId,
    adminNotes
  });

  res.json(
    new ApiResponse(200, {
      id: updatedCoach.id,
      adminNotes: updatedCoach.adminNotes
    }, 'Coach notes updated successfully')
  );
});

// Get recent admin activities (for audit trail)
export const getAdminActivities = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  // Get recent coach status changes
  const activities = await prisma.coach.findMany({
    where: {
      OR: [
        { approvedAt: { not: null } },
        { rejectedAt: { not: null } }
      ]
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      },
      approvedByUser: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      },
      rejectedByUser: {
        select: {
          firstName: true,
          lastName: true,
          email: true
        }
      }
    },
    orderBy: [
      { approvedAt: 'desc' },
      { rejectedAt: 'desc' }
    ],
    skip,
    take
  });

  // Format activities for frontend
  const formattedActivities = activities.map(coach => {
    const isApproval = coach.status === 'APPROVED' && coach.approvedAt;
    return {
      id: coach.id,
      type: isApproval ? 'APPROVAL' : 'REJECTION',
      coachName: `${coach.user.firstName} ${coach.user.lastName}`,
      coachEmail: coach.user.email,
      adminName: isApproval 
        ? `${coach.approvedByUser?.firstName} ${coach.approvedByUser?.lastName}`
        : `${coach.rejectedByUser?.firstName} ${coach.rejectedByUser?.lastName}`,
      timestamp: isApproval ? coach.approvedAt : coach.rejectedAt,
      notes: coach.adminNotes,
      reason: coach.rejectionReason
    };
  });

  res.json(
    new ApiResponse(200, {
      activities: formattedActivities,
      pagination: {
        currentPage: parseInt(page),
        hasNextPage: activities.length === take
      }
    }, 'Admin activities retrieved successfully')
  );
});

// Course Approval Controllers

// Get all courses for approval with filtering and pagination
export const getCourses = asyncHandler(async (req, res) => {
  const {
    status = 'all',
    search = '',
    page = 1,
    limit = 10,
    sortBy = 'submittedAt',
    sortOrder = 'desc',
    category = '',
    priceRange = ''
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = {
    ...(status !== 'all' && { status: status.toUpperCase() }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { coach: { user: { firstName: { contains: search, mode: 'insensitive' } } } },
        { coach: { user: { lastName: { contains: search, mode: 'insensitive' } } } },
        { category: { contains: search, mode: 'insensitive' } }
      ]
    }),
    ...(category && { category }),
    ...(priceRange && {
      price: {
        gte: parseFloat(priceRange.split('-')[0]) || 0,
        lte: parseFloat(priceRange.split('-')[1]) || 999999
      }
    })
  };

  // Build orderBy clause
  const orderBy = {};
  if (sortBy === 'coachName') {
    orderBy.coach = { user: { firstName: sortOrder } };
  } else if (sortBy === 'courseTitle') {
    orderBy.title = sortOrder;
  } else {
    orderBy[sortBy] = sortOrder;
  }

  const [courses, total] = await prisma.$transaction([
    prisma.course.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy,
      include: {
        coach: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profilePicture: true
              }
            }
          }
        },
        weeklySchedule: {
          include: {
            timeSlots: true
          }
        }
      }
    }),
    prisma.course.count({ where })
  ]);

  // Transform data to match frontend expectations
  const transformedCourses = courses.map(course => ({
    id: course.id,
    coachName: `${course.coach.user.firstName} ${course.coach.user.lastName}`,
    coachEmail: course.coach.user.email,
    coachPhoto: course.coach.user.profilePicture || '',
    courseTitle: course.title,
    courseDescription: course.description,
    category: course.category,
    price: course.price,
    duration: course.duration,
    lessons: course.lessons || 0,
    thumbnail: course.thumbnail || '',
    videoUrl: course.introVideo || '',
    weeklySchedule: course.weeklySchedule.map(schedule => ({
      day: schedule.day,
      isActive: schedule.isActive,
      timeSlots: schedule.timeSlots.map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime
      }))
    })),
    submittedAt: course.createdAt,
    status: course.status.toLowerCase(),
    rejectionReason: course.rejectionReason
  }));

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json(
    new ApiResponse(200, {
      courses: transformedCourses,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        hasNextPage: parseInt(page) < totalPages,
        hasPreviousPage: parseInt(page) > 1
      }
    }, 'Courses retrieved successfully')
  );
});

// Get course details for approval
export const getCourseDetails = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      coach: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              profilePicture: true
            }
          }
        }
      },
      weeklySchedule: {
        include: {
          timeSlots: true
        }
      }
    }
  });

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  // Transform data to match frontend expectations
  const transformedCourse = {
    id: course.id,
    coachName: `${course.coach.user.firstName} ${course.coach.user.lastName}`,
    coachEmail: course.coach.user.email,
    coachPhoto: course.coach.user.profilePicture || '',
    courseTitle: course.title,
    courseDescription: course.description,
    category: course.category,
    price: course.price,
    duration: course.duration,
    lessons: course.lessons || 0,
    thumbnail: course.thumbnail || '',
    videoUrl: course.introVideo || '',
    weeklySchedule: course.weeklySchedule.map(schedule => ({
      day: schedule.day,
      isActive: schedule.isActive,
      timeSlots: schedule.timeSlots.map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime
      }))
    })),
    submittedAt: course.createdAt,
    status: course.status.toLowerCase(),
    rejectionReason: course.rejectionReason
  };

  res.json(
    new ApiResponse(200, transformedCourse, 'Course details retrieved successfully')
  );
});

// Approve a course
export const approveCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { adminNotes } = req.body;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      coach: {
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
      }
    }
  });

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  if (course.status === 'APPROVED') {
    throw new ApiError(400, 'Course is already approved');
  }

  // Update course status
  const updatedCourse = await prisma.course.update({
    where: { id: courseId },
    data: {
      status: 'APPROVED',
      isActive: true,
      approvedAt: new Date(),
      adminNotes: adminNotes || course.adminNotes
    }
  });

  // Send approval email to coach
  try {
    await emailService.sendCourseApprovalEmail({
      email: course.coach.user.email,
      firstName: course.coach.user.firstName,
      courseTitle: course.title
    });
  } catch (error) {
    logger.error('Failed to send course approval email:', error);
  }

  // Log admin activity
  await prisma.adminActivity.create({
    data: {
      adminId: req.user.id,
      action: 'COURSE_APPROVED',
      targetType: 'COURSE',
      targetId: courseId,
      details: {
        courseTitle: course.title,
        coachName: `${course.coach.user.firstName} ${course.coach.user.lastName}`,
        adminNotes
      }
    }
  });

  res.json(
    new ApiResponse(200, updatedCourse, 'Course approved successfully')
  );
});

// Reject a course
export const rejectCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { rejectionReason, adminNotes } = req.body;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      coach: {
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
      }
    }
  });

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  if (course.status === 'REJECTED') {
    throw new ApiError(400, 'Course is already rejected');
  }

  // Update course status
  const updatedCourse = await prisma.course.update({
    where: { id: courseId },
    data: {
      status: 'REJECTED',
      isActive: false,
      rejectedAt: new Date(),
      rejectionReason,
      adminNotes: adminNotes || course.adminNotes
    }
  });

  // Send rejection email to coach
  try {
    await emailService.sendCourseRejectionEmail({
      email: course.coach.user.email,
      firstName: course.coach.user.firstName,
      courseTitle: course.title,
      rejectionReason
    });
  } catch (error) {
    logger.error('Failed to send course rejection email:', error);
  }

  // Log admin activity
  await prisma.adminActivity.create({
    data: {
      adminId: req.user.id,
      action: 'COURSE_REJECTED',
      targetType: 'COURSE',
      targetId: courseId,
      details: {
        courseTitle: course.title,
        coachName: `${course.coach.user.firstName} ${course.coach.user.lastName}`,
        rejectionReason,
        adminNotes
      }
    }
  });

  res.json(
    new ApiResponse(200, updatedCourse, 'Course rejected successfully')
  );
});
