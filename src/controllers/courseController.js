import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';

// Get all courses with filtering and search
export const getCourses = asyncHandler(async (req, res) => {

   if (req.query.coachId !== undefined) {
    req.query.coachId = parseInt(req.query.coachId, 10);
    console.log(
      "coachId value:",
      req.query.coachId,
      "type:",
      typeof req.query.coachId
    );
  }

  const {
    category,
    level,
    search = '',
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    minPrice,
    maxPrice,
    coachId
  } = req.query;

  // Build where clause for filtering
  // const where = {
  //   isActive: true,
  //   status: 'APPROVED'
  // };


    // Build where clause for filtering
  let where = {};
  if (coachId) {
    // If coachId is provided, show all courses for that coach (all statuses)
    where.coachId = coachId;
    // Optionally, allow filtering by status via query param if needed
    // if (req.query.status) where.status = req.query.status;
  } else {
    // Default: show only active and approved courses
    where.isActive = true;
    where.status = "APPROVED";
  }


  // Category filter
  if (category) {
    where.category = category;
  }

  // Level filter
  if (level) {
    where.level = level;
  }

  // Price range filter
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = parseFloat(minPrice);
    if (maxPrice) where.price.lte = parseFloat(maxPrice);
  }

  // Coach filter
  if (coachId) {
    where.coachId = coachId;
  }

  // Search filter
  if (search) {
    where.OR = [
      {
        title: {
          contains: search,
          mode: 'insensitive'
        }
      },
      {
        description: {
          contains: search,
          mode: 'insensitive'
        }
      },
      {
        category: {
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
  orderBy[sortBy] = sortOrder;

  const [courses, totalCount] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true,
            coach: {
              select: {
                rating: true,
                totalReviews: true
              }
            }
          }
        },
        _count: {
          select: {
            sessions: true
          }
        }
      },
      orderBy,
      skip,
      take
    }),
    prisma.course.count({ where })
  ]);

  // Format response
  const apiBase = `${req.protocol}://${req.get('host')}${req.baseUrl}`;
  const formattedCourses = courses.map(course => ({
    id: course.id,
    title: course.title,
    description: course.description,
    benefits: course.benefits,
    category: course.category,
    level: course.level,
    duration: course.duration,
    courseDuration: course.courseDuration,
    price: course.price,
    currency: course.currency,
    thumbnail: course.thumbnail || (course.thumbnailData ? `${apiBase}/${course.id}/thumbnail` : null),
    videoUrl: course.videoUrl,
    program: course.program,
    timezone: course.timezone,
    weeklySchedule: course.weeklySchedule,
    isActive: course.isActive,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
    coach: {
      id: course.coach.id,
      name: `${course.coach.firstName} ${course.coach.lastName}`,
      avatar: course.coach.profileImageUrl,
      rating: course.coach.coach?.rating || 0,
      totalReviews: course.coach.coach?.totalReviews || 0
    },
    totalSessions: course._count.sessions
  }));

  const totalPages = Math.ceil(totalCount / take);

  res.json(
    new ApiResponse(200, {
      courses: formattedCourses,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    }, 'Courses retrieved successfully')
  );
});

// Get course by ID
export const getCourseById = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  const id = Number(courseId);
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      coach: {
        select: {
          id: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              profileImageUrl: true
            }
          },
          rating: true,
          totalReviews: true,
          totalStudents: true,
          experienceDescription: true,
          languages: true
        }
      },
      sessions: {
        select: {
          id: true,
          title: true,
          description: true,
          startTime: true,
          endTime: true,
          status: true
        },
        orderBy: {
          startTime: 'asc'
        }
      },
      _count: {
        select: {
          sessions: true
        }
      }
    }
  });

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  // Format response
  const apiBase = `${req.protocol}://${req.get('host')}${req.baseUrl}`;
  const formattedCourse = {
    id: course.id,
    title: course.title,
    description: course.description,
    benefits: course.benefits,
    category: course.category,
    level: course.level,
    duration: course.duration,
    courseDuration: course.courseDuration,
    price: course.price,
    currency: course.currency,
    thumbnail: course.thumbnail || (course.thumbnailData ? `${apiBase}/${course.id}/thumbnail` : null),
    videoUrl: course.videoUrl,
    program: course.program,
    timezone: course.timezone,
    weeklySchedule: course.weeklySchedule,
    isActive: course.isActive,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
    coach: {
      id: course.coach.id,
      name: `${course.coach.user.firstName} ${course.coach.user.lastName}`,
      avatar: course.coach.user.profileImageUrl,
      rating: course.coach.rating,
      totalReviews: course.coach.totalReviews,
      totalStudents: course.coach.totalStudents,
      experience: course.coach.experienceDescription,
      languages: course.coach.languages
    },
    sessions: course.sessions,
    totalSessions: course._count.sessions
  };

  res.json(
    new ApiResponse(200, formattedCourse, 'Course details retrieved successfully')
  );
});

// Create new course
export const createCourse = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    benefits,
    category,
    level,
    duration, // minutes (legacy)
    courseDuration, // string label
    price,
    currency = 'USD',
    program,
    timezone = 'UTC',
    weeklySchedule,
    credits
  } = req.body;

  const coachId = req.user.id;

  // Handle file uploads
  let thumbnailBinary = null;
  let thumbnailMimeType = null;
  let videoUrl = null;

  if (req.files) {
    try {
      if (req.files.thumbnail) {
        const uploadedThumb = req.files.thumbnail[0];
        // memoryStorage provides buffer
        thumbnailBinary = uploadedThumb.buffer;
        thumbnailMimeType = uploadedThumb.mimetype || 'image/jpeg';
        logger.info(`Course thumbnail received: ${uploadedThumb.originalname}`);
      }
      if (req.files.video || req.files.introVideo) {
        // Placeholder: persist videos via separate upload flow/storage
        // Keep null or implement storage as needed
        const uploaded = req.files.video?.[0] || req.files.introVideo?.[0];
        if (uploaded) logger.info(`Course video received: ${uploaded.originalname}`);
      }
    } catch (error) {
      logger.error('File upload error:', error);
      throw new ApiError(500, 'Failed to upload files');
    }
  }

  // Create course
  const parsedWeekly = (() => {
    try {
      if (!weeklySchedule) return [];
      return typeof weeklySchedule === 'string' ? JSON.parse(weeklySchedule) : weeklySchedule;
    } catch (e) {
      return [];
    }
  })();

  const course = await prisma.course.create({
    data: {
      coachId,
      title,
      description,
      benefits: benefits || null,
      category,
      level: level || 'BEGINNER',
      duration: duration ? parseInt(duration) : 0,
      courseDuration: courseDuration || null,
      price: price != null ? parseFloat(price) : 0,
      currency,
      // Persist thumbnail binary if provided
      thumbnail: null,
      thumbnailData: thumbnailBinary,
      thumbnailMimeType,
      videoUrl,
      program: program || null,
      timezone,
      weeklySchedule: parsedWeekly,
      creditCost: credits != null ? parseFloat(credits) : 0,
      // New courses require admin approval by default
      isActive: false,
      status: 'PENDING'
    },
    include: {
      coach: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  });

  logger.info(`Course created: ${course.title} by coach ${course.coach.firstName} ${course.coach.lastName}`);

  // Prepare response with computed thumbnail URL
  const { thumbnailData, thumbnailMimeType: _omitMime, ...courseSafe } = course;
  const apiBase = `${req.protocol}://${req.get('host')}${req.baseUrl}`;
  const responseCourse = {
    ...courseSafe,
    thumbnail: course.thumbnail || (thumbnailBinary ? `${apiBase}/${course.id}/thumbnail` : null)
  };

  res.status(201).json(
    new ApiResponse(201, responseCourse, 'Course created successfully')
  );
});

// Update course
export const updateCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const coachId = req.user.id;
  const id = Number(courseId);

  // Check if course exists and belongs to the coach
  const existingCourse = await prisma.course.findFirst({
    where: {
      id,
      coachId
    }
  });

  if (!existingCourse) {
    throw new ApiError(404, 'Course not found or access denied');
  }

  const {
    title,
    description,
    benefits,
    category,
    level,
    duration,
    courseDuration,
    price,
    currency,
    program,
    timezone,
    weeklySchedule,
    credits
  } = req.body;

  // Handle file uploads
  let thumbnailBinary = null;
  let thumbnailMimeType = null;
  let videoUrl = existingCourse.videoUrl;

  if (req.files) {
    try {
      if (req.files.thumbnail) {
        const uploadedThumb = req.files.thumbnail[0];
        thumbnailBinary = uploadedThumb.buffer;
        thumbnailMimeType = uploadedThumb.mimetype || 'image/jpeg';
        logger.info(`Course thumbnail updated: ${uploadedThumb.originalname}`);
      }
      if (req.files.video || req.files.introVideo) {
        // Placeholder: implement real video persistence as needed
        const uploaded = req.files.video?.[0] || req.files.introVideo?.[0];
        if (uploaded) logger.info(`Course video updated: ${uploaded.originalname}`);
      }
    } catch (error) {
      logger.error('File upload error:', error);
      throw new ApiError(500, 'Failed to upload files');
    }
  }

  // Update course
  const parsedWeekly = (() => {
    try {
      if (!weeklySchedule) return existingCourse.weeklySchedule;
      return typeof weeklySchedule === 'string' ? JSON.parse(weeklySchedule) : weeklySchedule;
    } catch (e) {
      return existingCourse.weeklySchedule;
    }
  })();

  const updatedCourse = await prisma.course.update({
    where: { id },
    data: {
      title: title || existingCourse.title,
      description: description || existingCourse.description,
      benefits: benefits ?? existingCourse.benefits,
      category: category || existingCourse.category,
      level: level || existingCourse.level,
      duration: duration ? parseInt(duration) : existingCourse.duration,
      courseDuration: courseDuration ?? existingCourse.courseDuration,
      price: price != null ? parseFloat(price) : existingCourse.price,
      currency: currency || existingCourse.currency,
      // Update thumbnail binary if provided
      ...(thumbnailBinary ? { thumbnailData: thumbnailBinary, thumbnailMimeType } : {}),
      videoUrl,
      program: program ?? existingCourse.program,
      timezone: timezone ?? existingCourse.timezone,
      weeklySchedule: parsedWeekly,
      creditCost: credits != null ? parseFloat(credits) : existingCourse.creditCost
    }
  });

  logger.info(`Course updated: ${updatedCourse.title} by coach ${coachId}`);

  const { thumbnailData: _td2, thumbnailMimeType: _tm2, ...updatedSafe } = updatedCourse;
  const apiBase2 = `${req.protocol}://${req.get('host')}${req.baseUrl}`;
  const responseCourse = {
    ...updatedSafe,
    thumbnail: updatedCourse.thumbnail || (updatedCourse.thumbnailData ? `${apiBase2}/${updatedCourse.id}/thumbnail` : existingCourse.thumbnail)
  };

  res.json(
    new ApiResponse(200, responseCourse, 'Course updated successfully')
  );
});

// Delete course
export const deleteCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const coachId = req.user.id;
  const id = Number(courseId);

  // Check if course exists and belongs to the coach
  const course = await prisma.course.findFirst({
    where: {
      id,
      coachId
    },
    include: {
      sessions: {
        where: {
          status: {
            in: ['SCHEDULED', 'IN_PROGRESS']
          }
        }
      }
    }
  });

  if (!course) {
    throw new ApiError(404, 'Course not found or access denied');
  }

  // Check if course has active sessions
  if (course.sessions.length > 0) {
    throw new ApiError(400, 'Cannot delete course with active sessions');
  }

  // Delete course
  await prisma.course.delete({
    where: { id }
  });

  logger.info(`Course deleted: ${course.title} by coach ${coachId}`);

  res.json(
    new ApiResponse(200, null, 'Course deleted successfully')
  );
});

// Toggle course status
export const toggleCourseStatus = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const coachId = req.user.id;
  const id = Number(courseId);

  // Check if course exists and belongs to the coach
  const course = await prisma.course.findFirst({
    where: {
      id,
      coachId
    }
  });

  if (!course) {
    throw new ApiError(404, 'Course not found or access denied');
  }

  // Toggle status
  const updatedCourse = await prisma.course.update({
    where: { id },
    data: {
      isActive: !course.isActive
    }
  });

  logger.info(`Course status toggled: ${course.title} - ${updatedCourse.isActive ? 'Active' : 'Inactive'}`);

  res.json(
    new ApiResponse(200, updatedCourse, `Course ${updatedCourse.isActive ? 'activated' : 'deactivated'} successfully`)
  );
});

// Enroll in course
export const enrollInCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { childId } = req.body;
  const parentId = req.user.id;
  const id = Number(courseId);

  // Check if course exists and is active
  const course = await prisma.course.findFirst({
    where: {
      id,
      isActive: true
    },
    include: {
      coach: {
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  });

  if (!course) {
    throw new ApiError(404, 'Course not found or not available');
  }

  // Check if child belongs to parent (this would need a Child model in the schema)
  // For now, we'll assume the childId is valid

  // Check if already enrolled
  const existingEnrollment = await prisma.session.findFirst({
    where: {
      courseId: id,
      studentId: childId
    }
  });

  if (existingEnrollment) {
    throw new ApiError(400, 'Already enrolled in this course');
  }

  // Create enrollment (represented as a session in the current schema)
  const enrollment = await prisma.session.create({
    data: {
      courseId: id,
      coachId: course.coachId,
      studentId: childId,
      title: `Enrollment in ${course.title}`,
      description: `Student enrolled in ${course.title}`,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      status: 'SCHEDULED'
    }
  });

  logger.info(`Student ${childId} enrolled in course ${course.title} by parent ${parentId}`);

  res.status(201).json(
    new ApiResponse(201, {
      enrollmentId: enrollment.id,
      courseTitle: course.title,
      coachName: `${course.coach.user.firstName} ${course.coach.user.lastName}`
    }, 'Enrollment created successfully')
  );
});

// Get course reviews
export const getCourseReviews = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  // Check if course exists
  const course = await prisma.course.findUnique({
    where: { id: courseId }
  });

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  // Get reviews
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const [reviews, totalCount] = await Promise.all([
    prisma.review.findMany({
      where: {
        session: {
          courseId
        }
      },
      include: {
        reviewer: {
          select: {
            firstName: true,
            lastName: true,
            profileImageUrl: true
          }
        },
        session: {
          select: {
            title: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take
    }),
    prisma.review.count({
      where: {
        session: {
          courseId
        }
      }
    })
  ]);

  // Format reviews
  const formattedReviews = reviews.map(review => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    isPublic: review.isPublic,
    createdAt: review.createdAt,
    reviewer: {
      name: `${review.reviewer.firstName} ${review.reviewer.lastName}`,
      avatar: review.reviewer.profileImageUrl
    },
    sessionTitle: review.session?.title
  }));

  const totalPages = Math.ceil(totalCount / take);

  res.json(
    new ApiResponse(200, {
      reviews: formattedReviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    }, 'Course reviews retrieved successfully')
  );
});

// Serve course thumbnail binary
export const getCourseThumbnail = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const id = Number(courseId);
  const course = await prisma.course.findUnique({
    where: { id: id }
  });

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  if (course.thumbnailData) {
    const mime = course.thumbnailMimeType || 'image/jpeg';
    res.setHeader('Content-Type', mime);
    // Cache for a short period
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(Buffer.from(course.thumbnailData));
  }

  // Fallback: if an external thumbnail URL exists
  if (course.thumbnail) {
    return res.redirect(course.thumbnail);
  }

  throw new ApiError(404, 'Thumbnail not available');
});

// Add course review
export const addCourseReview = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { rating, comment } = req.body;
  const reviewerId = req.user.id;

  // Check if course exists
  const course = await prisma.course.findUnique({
    where: { id: courseId }
  });

  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  // Check if user has completed a session for this course
  const session = await prisma.session.findFirst({
    where: {
      courseId,
      studentId: reviewerId,
      status: 'COMPLETED'
    }
  });

  if (!session) {
    throw new ApiError(400, 'You must complete a session before reviewing this course');
  }

  // Check if already reviewed
  const existingReview = await prisma.review.findFirst({
    where: {
      sessionId: session.id,
      reviewerId
    }
  });

  if (existingReview) {
    throw new ApiError(400, 'You have already reviewed this course');
  }

  // Create review
  const review = await prisma.review.create({
    data: {
      coachId: course.coachId,
      reviewerId,
      sessionId: session.id,
      rating,
      comment: comment || null,
      isPublic: true
    },
    include: {
      reviewer: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  });

  // Update coach rating
  await updateCoachRating(course.coachId);

  logger.info(`Review added for course ${course.title} by ${review.reviewer.firstName} ${review.reviewer.lastName}`);

  res.status(201).json(
    new ApiResponse(201, review, 'Review added successfully')
  );
});

// Helper function to update coach rating
async function updateCoachRating(coachId) {
  const reviews = await prisma.review.findMany({
    where: {
      coachId,
      isPublic: true
    },
    select: {
      rating: true
    }
  });

  if (reviews.length > 0) {
    const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
    
    await prisma.coach.update({
      where: { id: coachId },
      data: {
        rating: averageRating,
        totalReviews: reviews.length
      }
    });
  }
} 