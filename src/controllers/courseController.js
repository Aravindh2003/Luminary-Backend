import { prisma } from "../config/database.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import logger from "../utils/logger.js";

// Get all courses with filtering and search
export const getCourses = asyncHandler(async (req, res) => {
  // Debug: ensure coachId is integer
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
    search = "",
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
    minPrice,
    maxPrice,
    coachId,
  } = req.query;

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

  // Search filter
  if (search) {
    where.OR = [
      {
        title: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: search,
          mode: "insensitive",
        },
      },
      {
        category: {
          contains: search,
          mode: "insensitive",
        },
      },
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
                totalReviews: true,
              },
            },
          },
        },
        _count: {
          select: {
            sessions: true,
          },
        },
      },
      orderBy,
      skip,
      take,
    }),
    prisma.course.count({ where }),
  ]);

  // Format response
  const formattedCourses = courses.map((course) => ({
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
    thumbnail: course.thumbnail,
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
      totalReviews: course.coach.coach?.totalReviews || 0,
    },
    totalSessions: course._count.sessions,
  }));

  const totalPages = Math.ceil(totalCount / take);

  res.json(
    new ApiResponse(
      200,
      {
        courses: formattedCourses,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
      "Courses retrieved successfully"
    )
  );
});

// Get course by ID
export const getCourseById = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      coach: {
        select: {
          id: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              profileImageUrl: true,
            },
          },
          rating: true,
          totalReviews: true,
          totalStudents: true,
          experienceDescription: true,
          languages: true,
        },
      },
      sessions: {
        select: {
          id: true,
          title: true,
          description: true,
          startTime: true,
          endTime: true,
          status: true,
        },
        orderBy: {
          startTime: "asc",
        },
      },
      _count: {
        select: {
          sessions: true,
        },
      },
    },
  });

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Format response
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
    thumbnail: course.thumbnail,
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
      languages: course.coach.languages,
    },
    sessions: course.sessions,
    totalSessions: course._count.sessions,
  };

  res.json(
    new ApiResponse(
      200,
      formattedCourse,
      "Course details retrieved successfully"
    )
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
    currency = "USD",
    program,
    timezone = "UTC",
    weeklySchedule,
    credits,
  } = req.body;

  const coachId = req.user.id;

  // Handle file uploads
  let thumbnailUrl = null;
  let videoUrl = null;

  if (req.files) {
    try {
      if (req.files.thumbnail) {
        thumbnailUrl = `http://localhost:5000/uploads/course-thumbnail-${Date.now()}.jpg`;
        logger.info(
          `Course thumbnail uploaded: ${req.files.thumbnail[0].originalname}`
        );
      }
      if (req.files.video || req.files.introVideo) {
        videoUrl = `http://localhost:5000/uploads/course-video-${Date.now()}.mp4`;
        const uploaded = req.files.video?.[0] || req.files.introVideo?.[0];
        if (uploaded)
          logger.info(`Course video uploaded: ${uploaded.originalname}`);
      }
    } catch (error) {
      logger.error("File upload error:", error);
      throw new ApiError(500, "Failed to upload files");
    }
  }

  // Create course
  const parsedWeekly = (() => {
    try {
      if (!weeklySchedule) return [];
      return typeof weeklySchedule === "string"
        ? JSON.parse(weeklySchedule)
        : weeklySchedule;
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
      level: level || "BEGINNER",
      duration: duration ? parseInt(duration) : 0,
      courseDuration: courseDuration || null,
      price: price != null ? parseFloat(price) : 0,
      currency,
      thumbnail: thumbnailUrl,
      videoUrl,
      program: program || null,
      timezone,
      weeklySchedule: parsedWeekly,
      creditCost: credits != null ? parseFloat(credits) : 0,
      // New courses require admin approval by default
      isActive: false,
      status: "PENDING",
    },
    include: {
      coach: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  logger.info(
    `Course created: ${course.title} by coach ${course.coach.firstName} ${course.coach.lastName}`
  );

  res
    .status(201)
    .json(new ApiResponse(201, course, "Course created successfully"));
});

// Update course
export const updateCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const coachId = req.user.id;

  // Check if course exists and belongs to the coach
  const existingCourse = await prisma.course.findFirst({
    where: {
      id: courseId,
      coachId,
    },
  });

  if (!existingCourse) {
    throw new ApiError(404, "Course not found or access denied");
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
    credits,
  } = req.body;

  // Handle file uploads
  let thumbnailUrl = existingCourse.thumbnail;
  let videoUrl = existingCourse.videoUrl;

  if (req.files) {
    try {
      if (req.files.thumbnail) {
        thumbnailUrl = `http://localhost:5000/uploads/course-thumbnail-${Date.now()}.jpg`;
        logger.info(
          `Course thumbnail updated: ${req.files.thumbnail[0].originalname}`
        );
      }
      if (req.files.video || req.files.introVideo) {
        videoUrl = `http://localhost:5000/uploads/course-video-${Date.now()}.mp4`;
        const uploaded = req.files.video?.[0] || req.files.introVideo?.[0];
        if (uploaded)
          logger.info(`Course video updated: ${uploaded.originalname}`);
      }
    } catch (error) {
      logger.error("File upload error:", error);
      throw new ApiError(500, "Failed to upload files");
    }
  }

  // Update course
  const parsedWeekly = (() => {
    try {
      if (!weeklySchedule) return existingCourse.weeklySchedule;
      return typeof weeklySchedule === "string"
        ? JSON.parse(weeklySchedule)
        : weeklySchedule;
    } catch (e) {
      return existingCourse.weeklySchedule;
    }
  })();

  const updatedCourse = await prisma.course.update({
    where: { id: courseId },
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
      thumbnail: thumbnailUrl,
      videoUrl,
      program: program ?? existingCourse.program,
      timezone: timezone ?? existingCourse.timezone,
      weeklySchedule: parsedWeekly,
      creditCost:
        credits != null ? parseFloat(credits) : existingCourse.creditCost,
    },
  });

  logger.info(`Course updated: ${updatedCourse.title} by coach ${coachId}`);

  res.json(new ApiResponse(200, updatedCourse, "Course updated successfully"));
});

// Delete course
export const deleteCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const coachId = req.user.id;

  // Check if course exists and belongs to the coach
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      coachId,
    },
    include: {
      sessions: {
        where: {
          status: {
            in: ["SCHEDULED", "IN_PROGRESS"],
          },
        },
      },
    },
  });

  if (!course) {
    throw new ApiError(404, "Course not found or access denied");
  }

  // Check if course has active sessions
  if (course.sessions.length > 0) {
    throw new ApiError(400, "Cannot delete course with active sessions");
  }

  // Delete course
  await prisma.course.delete({
    where: { id: courseId },
  });

  logger.info(`Course deleted: ${course.title} by coach ${coachId}`);

  res.json(new ApiResponse(200, null, "Course deleted successfully"));
});

// Toggle course status
export const toggleCourseStatus = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const coachId = req.user.id;

  // Check if course exists and belongs to the coach
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      coachId,
    },
  });

  if (!course) {
    throw new ApiError(404, "Course not found or access denied");
  }

  // Toggle status
  const updatedCourse = await prisma.course.update({
    where: { id: courseId },
    data: {
      isActive: !course.isActive,
    },
  });

  logger.info(
    `Course status toggled: ${course.title} - ${
      updatedCourse.isActive ? "Active" : "Inactive"
    }`
  );

  res.json(
    new ApiResponse(
      200,
      updatedCourse,
      `Course ${updatedCourse.isActive ? "activated" : "deactivated"} successfully`
    )
  );
});

// Enroll in course
export const enrollInCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { childId } = req.body;
  const parentId = req.user.id;

  // Check if course exists and is active
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      isActive: true,
    },
    include: {
      coach: {
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  if (!course) {
    throw new ApiError(404, "Course not found or not available");
  }

  // Check if child belongs to parent (this would need a Child model in the schema)
  // For now, we'll assume the childId is valid

  // Check if already enrolled
  const existingEnrollment = await prisma.session.findFirst({
    where: {
      courseId,
      studentId: childId,
    },
  });

  if (existingEnrollment) {
    throw new ApiError(400, "Already enrolled in this course");
  }

  // Create enrollment (represented as a session in the current schema)
  const enrollment = await prisma.session.create({
    data: {
      courseId,
      coachId: course.coachId,
      studentId: childId,
      title: `Enrollment in ${course.title}`,
      description: `Student enrolled in ${course.title}`,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      status: "SCHEDULED",
    },
  });

  logger.info(
    `Student ${childId} enrolled in course ${course.title} by parent ${parentId}`
  );

  res.status(201).json(
    new ApiResponse(
      201,
      {
        enrollmentId: enrollment.id,
        courseTitle: course.title,
        coachName: `${course.coach.user.firstName} ${course.coach.user.lastName}`,
      },
      "Enrollment created successfully"
    )
  );
});

// Get course reviews
export const getCourseReviews = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  // Check if course exists
  const course = await prisma.course.findUnique({
    where: { id: courseId },
  });

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Get reviews
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const [reviews, totalCount] = await Promise.all([
    prisma.review.findMany({
      where: {
        session: {
          courseId,
        },
      },
      include: {
        reviewer: {
          select: {
            firstName: true,
            lastName: true,
            profileImageUrl: true,
          },
        },
        session: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take,
    }),
    prisma.review.count({
      where: {
        session: {
          courseId,
        },
      },
    }),
  ]);

  // Format reviews
  const formattedReviews = reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    isPublic: review.isPublic,
    createdAt: review.createdAt,
    reviewer: {
      name: `${review.reviewer.firstName} ${review.reviewer.lastName}`,
      avatar: review.reviewer.profileImageUrl,
    },
    sessionTitle: review.session?.title,
  }));

  const totalPages = Math.ceil(totalCount / take);

  res.json(
    new ApiResponse(
      200,
      {
        reviews: formattedReviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
      "Course reviews retrieved successfully"
    )
  );
});

// Add course review
export const addCourseReview = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { rating, comment } = req.body;
  const reviewerId = req.user.id;

  // Check if course exists
  const course = await prisma.course.findUnique({
    where: { id: courseId },
  });

  if (!course) {
    throw new ApiError(404, "Course not found");
  }

  // Check if user has completed a session for this course
  const session = await prisma.session.findFirst({
    where: {
      courseId,
      studentId: reviewerId,
      status: "COMPLETED",
    },
  });

  if (!session) {
    throw new ApiError(
      400,
      "You must complete a session before reviewing this course"
    );
  }

  // Check if already reviewed
  const existingReview = await prisma.review.findFirst({
    where: {
      sessionId: session.id,
      reviewerId,
    },
  });

  if (existingReview) {
    throw new ApiError(400, "You have already reviewed this course");
  }

  // Create review
  const review = await prisma.review.create({
    data: {
      coachId: course.coachId,
      reviewerId,
      sessionId: session.id,
      rating,
      comment: comment || null,
      isPublic: true,
    },
    include: {
      reviewer: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // Update coach rating
  await updateCoachRating(course.coachId);

  logger.info(
    `Review added for course ${course.title} by ${review.reviewer.firstName} ${review.reviewer.lastName}`
  );

  res
    .status(201)
    .json(new ApiResponse(201, review, "Review added successfully"));
});

// Helper function to update coach rating
async function updateCoachRating(coachId) {
  const reviews = await prisma.review.findMany({
    where: {
      coachId,
      isPublic: true,
    },
    select: {
      rating: true,
    },
  });

  if (reviews.length > 0) {
    const averageRating =
      reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

    await prisma.coach.update({
      where: { id: coachId },
      data: {
        rating: averageRating,
        totalReviews: reviews.length,
      },
    });
  }
}
