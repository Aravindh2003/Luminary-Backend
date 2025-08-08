import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';

// Get all children for the authenticated parent
export const getChildren = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    sortBy = 'firstName',
    sortOrder = 'asc'
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = {
    parentId: req.user.id,
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { currentGrade: { contains: search, mode: 'insensitive' } },
        { schoolName: { contains: search, mode: 'insensitive' } }
      ]
    })
  };

  // Build orderBy clause
  const orderBy = {};
  orderBy[sortBy] = sortOrder;

  const [children, total] = await prisma.$transaction([
    prisma.child.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy
    }),
    prisma.child.count({ where })
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json(
    new ApiResponse(200, {
      children,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        hasNextPage: parseInt(page) < totalPages,
        hasPreviousPage: parseInt(page) > 1
      }
    }, 'Children retrieved successfully')
  );
});

// Get child details by ID
export const getChildDetails = asyncHandler(async (req, res) => {
  const { childId } = req.params;

  const child = await prisma.child.findFirst({
    where: {
      id: childId,
      parentId: req.user.id
    }
  });

  if (!child) {
    throw new ApiError(404, 'Child not found');
  }

  res.json(
    new ApiResponse(200, child, 'Child details retrieved successfully')
  );
});

// Add a new child to parent account
export const addChild = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    dateOfBirth,
    gender,
    currentGrade,
    schoolName,
    specialNeeds,
    interests
  } = req.body;

  // Validate date of birth (child should be under 18)
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age >= 18) {
    throw new ApiError(400, 'Child must be under 18 years old');
  }

  // Check if parent already has a child with the same name
  const existingChild = await prisma.child.findFirst({
    where: {
      parentId: req.user.id,
      firstName,
      lastName,
      dateOfBirth: birthDate
    }
  });

  if (existingChild) {
    throw new ApiError(400, 'A child with this information already exists');
  }

  // Create the child
  const child = await prisma.child.create({
    data: {
      firstName,
      lastName,
      dateOfBirth: birthDate,
      gender,
      currentGrade,
      schoolName,
      specialNeeds,
      interests: interests || [],
      parentId: req.user.id
    }
  });

  logger.info('Child added successfully', {
    childId: child.id,
    parentId: req.user.id,
    childName: `${firstName} ${lastName}`
  });

  res.status(201).json(
    new ApiResponse(201, child, 'Child added successfully')
  );
});

// Update child information
export const updateChild = asyncHandler(async (req, res) => {
  const { childId } = req.params;
  const {
    firstName,
    lastName,
    dateOfBirth,
    gender,
    currentGrade,
    schoolName,
    specialNeeds,
    interests
  } = req.body;

  // Find the child and verify ownership
  const child = await prisma.child.findFirst({
    where: {
      id: childId,
      parentId: req.user.id
    }
  });

  if (!child) {
    throw new ApiError(404, 'Child not found');
  }

  // Validate date of birth if provided
  if (dateOfBirth) {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age >= 18) {
      throw new ApiError(400, 'Child must be under 18 years old');
    }
  }

  // Update the child
  const updatedChild = await prisma.child.update({
    where: { id: childId },
    data: {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
      ...(gender && { gender }),
      ...(currentGrade !== undefined && { currentGrade }),
      ...(schoolName !== undefined && { schoolName }),
      ...(specialNeeds !== undefined && { specialNeeds }),
      ...(interests && { interests })
    }
  });

  logger.info('Child updated successfully', {
    childId,
    parentId: req.user.id,
    childName: `${updatedChild.firstName} ${updatedChild.lastName}`
  });

  res.json(
    new ApiResponse(200, updatedChild, 'Child updated successfully')
  );
});

// Remove a child from parent account
export const removeChild = asyncHandler(async (req, res) => {
  const { childId } = req.params;

  // Find the child and verify ownership
  const child = await prisma.child.findFirst({
    where: {
      id: childId,
      parentId: req.user.id
    },
    include: {
      enrollments: {
        where: {
          status: {
            in: ['active', 'in_progress']
          }
        }
      }
    }
  });

  if (!child) {
    throw new ApiError(404, 'Child not found');
  }

  // Check if child has active enrollments
  if (child.enrollments.length > 0) {
    throw new ApiError(400, 'Cannot remove child with active course enrollments. Please cancel enrollments first.');
  }

  // Delete the child
  await prisma.child.delete({
    where: { id: childId }
  });

  logger.info('Child removed successfully', {
    childId,
    parentId: req.user.id,
    childName: `${child.firstName} ${child.lastName}`
  });

  res.json(
    new ApiResponse(200, null, 'Child removed successfully')
  );
});

// Get child's learning progress
export const getChildProgress = asyncHandler(async (req, res) => {
  const { childId } = req.params;
  const { period = 'month' } = req.query;

  // Find the child and verify ownership
  const child = await prisma.child.findFirst({
    where: {
      id: childId,
      parentId: req.user.id
    }
  });

  if (!child) {
    throw new ApiError(404, 'Child not found');
  }

  // Calculate date range based on period
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const progress = await prisma.$transaction(async (tx) => {
    // Get total sessions for the child
    const totalSessions = await tx.session.count({
      where: {
        studentId: childId,
        startTime: {
          gte: startDate
        }
      }
    });

    // Get completed sessions
    const completedSessions = await tx.session.count({
      where: {
        studentId: childId,
        status: 'COMPLETED',
        startTime: {
          gte: startDate
        }
      }
    });

    // Get total hours
    const sessions = await tx.session.findMany({
      where: {
        studentId: childId,
        status: 'COMPLETED',
        startTime: {
          gte: startDate
        }
      },
      select: {
        duration: true
      }
    });

    const totalHours = sessions.reduce((total, session) => total + (session.duration || 0), 0) / 60;

    // Get average rating
    const ratings = await tx.session.findMany({
      where: {
        studentId: childId,
        status: 'COMPLETED',
        rating: {
          not: null
        },
        startTime: {
          gte: startDate
        }
      },
      select: {
        rating: true
      }
    });

    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, session) => sum + session.rating, 0) / ratings.length 
      : 0;

    // Get courses enrolled
    const coursesEnrolled = await tx.enrollment.findMany({
      where: {
        childId,
        status: {
          in: ['active', 'completed']
        }
      },
      include: {
        course: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: {
        enrolledAt: 'desc'
      }
    });

    // Calculate progress for each course
    const coursesWithProgress = await Promise.all(
      coursesEnrolled.map(async (enrollment) => {
        const courseSessions = await tx.session.count({
          where: {
            courseId: enrollment.courseId,
            studentId: childId,
            status: 'COMPLETED'
          }
        });

        const lastSession = await tx.session.findFirst({
          where: {
            courseId: enrollment.courseId,
            studentId: childId
          },
          orderBy: {
            startTime: 'desc'
          },
          select: {
            startTime: true
          }
        });

        // Calculate progress percentage (simplified - based on completed sessions)
        const progress = enrollment.course.lessons > 0 
          ? Math.min((courseSessions / enrollment.course.lessons) * 100, 100)
          : 0;

        return {
          courseId: enrollment.course.id,
          courseTitle: enrollment.course.title,
          progress: Math.round(progress),
          lastSession: lastSession?.startTime || null
        };
      })
    );

    return {
      totalSessions,
      completedSessions,
      totalHours: Math.round(totalHours * 100) / 100,
      averageRating: Math.round(averageRating * 10) / 10,
      coursesEnrolled: coursesWithProgress
    };
  });

  res.json(
    new ApiResponse(200, progress, 'Child progress retrieved successfully')
  );
});

// Get child's course enrollments
export const getChildEnrollments = asyncHandler(async (req, res) => {
  const { childId } = req.params;
  const {
    status,
    page = 1,
    limit = 10
  } = req.query;

  // Find the child and verify ownership
  const child = await prisma.child.findFirst({
    where: {
      id: childId,
      parentId: req.user.id
    }
  });

  if (!child) {
    throw new ApiError(404, 'Child not found');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = {
    childId,
    ...(status && { status })
  };

  const [enrollments, total] = await prisma.$transaction([
    prisma.enrollment.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: {
        course: {
          include: {
            coach: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        enrolledAt: 'desc'
      }
    }),
    prisma.enrollment.count({ where })
  ]);

  // Calculate progress for each enrollment
  const enrollmentsWithProgress = await Promise.all(
    enrollments.map(async (enrollment) => {
      const completedSessions = await prisma.session.count({
        where: {
          courseId: enrollment.courseId,
          studentId: childId,
          status: 'COMPLETED'
        }
      });

      const progress = enrollment.course.lessons > 0 
        ? Math.min((completedSessions / enrollment.course.lessons) * 100, 100)
        : 0;

      return {
        id: enrollment.id,
        courseId: enrollment.course.id,
        courseTitle: enrollment.course.title,
        coachName: `${enrollment.course.coach.user.firstName} ${enrollment.course.coach.user.lastName}`,
        enrolledAt: enrollment.enrolledAt,
        status: enrollment.status,
        progress: Math.round(progress)
      };
    })
  );

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json(
    new ApiResponse(200, {
      enrollments: enrollmentsWithProgress,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        hasNextPage: parseInt(page) < totalPages,
        hasPreviousPage: parseInt(page) > 1
      }
    }, 'Child enrollments retrieved successfully')
  );
}); 