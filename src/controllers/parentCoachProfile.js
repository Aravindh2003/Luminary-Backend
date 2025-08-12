import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

// Publicly fetch coach profile for Parent dashboard (by coachId)
// Fetch coach profile by courseId for Parent dashboard
export const getCoachProfileByCourseId = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  // Find course and its coachId
  const course = await prisma.course.findUnique({
    where: { id: Number(courseId) },
    select: { coachId: true }
  });
  if (!course || !course.coachId) {
    throw new ApiError(404, 'Course or coach not found');
  }

  // Reuse the same logic as getCoachProfileForParent
  const coach = await prisma.coach.findUnique({
    where: { id: course.coachId },
    select: {
      id: true,
      domain: true,
      experienceDescription: true,
      address: true,
      languages: true,
      hourlyRate: true,
      rating: true,
      totalReviews: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profileImageUrl: true,
          phone: true
        }
      }
    }
  });
  const courses = await prisma.course.findMany({
    where: {
      coachId: course.coachId,
      isActive: true
    },
    select: {
      id: true,
      title: true,
      category: true,
      thumbnail: true
    }
  });
  if (!coach) {
    throw new ApiError(404, 'Coach not found');
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
    courses: courses.map(c => ({
      id: c.id,
      title: c.title,
      category: c.category,
      thumbnail: c.thumbnail
    }))
  };
  res.json(new ApiResponse(200, profile, 'Coach profile retrieved successfully'));
});

export const getCoachProfileForParent = asyncHandler(async (req, res) => {
  const { coachId } = req.params;

  const coach = await prisma.coach.findUnique({
    where: { id: Number(coachId) },
    select: {
      id: true,
      domain: true,
      experienceDescription: true,
      address: true,
      languages: true,
      hourlyRate: true,
      rating: true,
      totalReviews: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          profileImageUrl: true,
          phone: true
        }
      }
    }
  });

  // Fetch active courses taught by this coach (coachId on Course model)
  const courses = await prisma.course.findMany({
    where: {
      coachId: Number(coachId),
      isActive: true
    },
    select: {
      id: true,
      title: true,
      category: true,
      thumbnail: true
    }
  });

  if (!coach) {
    throw new ApiError(404, 'Coach not found');
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
    courses: courses.map(c => ({
      id: c.id,
      title: c.title,
      category: c.category,
      thumbnail: c.thumbnail
    }))
  };

  res.json(new ApiResponse(200, profile, 'Coach profile retrieved successfully'));
});
