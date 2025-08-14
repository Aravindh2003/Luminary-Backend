import { prisma } from "../config/database.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// Publicly fetch coach profile for Parent dashboard (by coachId)
// Fetch coach profile by courseId for Parent dashboard
export const getCoachProfileByCourseId = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const id = parseInt(courseId, 10);

  if (isNaN(id)) {
    throw new ApiError(400, "Invalid course ID");
  }

  console.log("Backend received courseId:", typeof id, id);

  // Find course with its coach (User) information
  const course = await prisma.course.findUnique({
    where: { id },
    select: {
      coachId: true,
      coach: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profileImageUrl: true,
          phone: true,
          coach: {
            select: {
              id: true,
              domain: true,
              experienceDescription: true,
              address: true,
              languages: true,
              hourlyRate: true,
              rating: true,
              totalReviews: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!course || !course.coach || !course.coach.coach) {
    throw new ApiError(404, "Course or coach not found");
  }

  // Get all active courses by this coach (using User.id as coachId)
  const courses = await prisma.course.findMany({
    where: {
      coachId: course.coachId, // This is User.id
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      category: true,
      thumbnail: true,
    },
  });

  const user = course.coach;
  const coachData = course.coach.coach;

  const profile = {
    id: coachData.id, // Coach.id
    userId: user.id, // User.id
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    avatar: user.profileImageUrl,
    domain: coachData.domain,
    experience: coachData.experienceDescription,
    address: coachData.address,
    languages: coachData.languages,
    hourlyRate: coachData.hourlyRate,
    rating: coachData.rating,
    totalReviews: coachData.totalReviews,
    status: coachData.status,
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      thumbnail: c.thumbnail,
    })),
  };

  res.json(
    new ApiResponse(200, profile, "Coach profile retrieved successfully")
  );
});

export const getCoachProfileForParent = asyncHandler(async (req, res) => {
  const { coachId } = req.params;

  // Try to parse as integer first, if it fails, treat as string
  let id;
  const parsedId = parseInt(coachId, 10);
  if (!isNaN(parsedId)) {
    id = parsedId;
  } else {
    // If it's not a number, it might be a User.id (string)
    // In this case, we need to find the coach by User.id
    const user = await prisma.user.findUnique({
      where: { id: coachId },
      select: {
        coach: {
          select: { id: true },
        },
      },
    });

    if (!user || !user.coach) {
      throw new ApiError(404, "Coach not found");
    }

    id = user.coach.id;
  }

  const coach = await prisma.coach.findUnique({
    where: { id },
    select: {
      id: true,
      domain: true,
      experienceDescription: true,
      address: true,
      languages: true,
      hourlyRate: true,
      rating: true,
      totalReviews: true,
      status: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profileImageUrl: true,
          phone: true,
        },
      },
    },
  });

  // Fetch active courses taught by this coach (coachId on Course model refers to User.id)
  const courses = await prisma.course.findMany({
    where: {
      coachId: coach.user.id, // Use User.id, not Coach.id
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      category: true,
      thumbnail: true,
    },
  });

  if (!coach) {
    throw new ApiError(404, "Coach not found");
  }

  const profile = {
    id: coach.id,
    firstName: coach.user.firstName,
    lastName: coach.user.lastName,
    email: coach.user.email,
    phone: coach.user.phone,
    avatar: coach.user.profileImageUrl,
    domain: coach.domain,
    experience: coach.experienceDescription,
    address: coach.address,
    languages: coach.languages,
    hourlyRate: coach.hourlyRate,
    rating: coach.rating,
    totalReviews: coach.totalReviews,
    status: coach.status,
    courses: courses.map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      thumbnail: c.thumbnail,
    })),
  };

  res.json(
    new ApiResponse(200, profile, "Coach profile retrieved successfully")
  );
});
