import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import fileUploadService from '../services/fileUploadService.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

// Get all videos for the authenticated coach
export const getVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    category = '',
    sortBy = 'createdAt',
    sortOrder = 'desc',
    isPublic
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = {
    coachId: req.user.coach.id,
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ]
    }),
    ...(category && { category }),
    ...(isPublic !== undefined && { isPublic: isPublic === 'true' })
  };

  // Build orderBy clause
  const orderBy = {};
  orderBy[sortBy] = sortOrder;

  const [videos, total] = await prisma.$transaction([
    prisma.video.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy,
      include: {
        course: {
          select: {
            id: true,
            title: true
          }
        }
      }
    }),
    prisma.video.count({ where })
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json(
    new ApiResponse(200, {
      videos,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        hasNextPage: parseInt(page) < totalPages,
        hasPreviousPage: parseInt(page) > 1
      }
    }, 'Videos retrieved successfully')
  );
});

// Get video details by ID
export const getVideoDetails = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      coachId: req.user.coach.id
    },
    include: {
      course: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  if (!video) {
    throw new ApiError(404, 'Video not found');
  }

  res.json(
    new ApiResponse(200, video, 'Video details retrieved successfully')
  );
});

// Upload a new video
export const uploadVideo = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    category,
    tags,
    isPublic = false,
    courseId
  } = req.body;

  // Check if video file exists
  if (!req.file) {
    throw new ApiError(400, 'Video file is required');
  }

  // Validate course ownership if courseId is provided
  if (courseId) {
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        coachId: req.user.coach.id
      }
    });

    if (!course) {
      throw new ApiError(404, 'Course not found or you do not have permission to access it');
    }
  }

  // Process video file
  const videoFile = req.file;
  const videoUrl = await fileUploadService.uploadToS3(videoFile, 'videos');
  
  // Get video duration and size
  const videoDuration = await getVideoDuration(videoFile.path);
  const videoSize = videoFile.size;

  // Create video record
  const video = await prisma.video.create({
    data: {
      title,
      description,
      url: videoUrl,
      duration: videoDuration,
      size: videoSize,
      category,
      tags: tags ? JSON.parse(tags) : [],
      isPublic,
      coachId: req.user.coach.id,
      courseId: courseId || null
    },
    include: {
      course: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  // Clean up temporary file
  if (fs.existsSync(videoFile.path)) {
    fs.unlinkSync(videoFile.path);
  }

  logger.info('Video uploaded successfully', {
    videoId: video.id,
    coachId: req.user.coach.id,
    title,
    size: videoSize
  });

  res.status(201).json(
    new ApiResponse(201, video, 'Video uploaded successfully')
  );
});

// Update video metadata
export const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const {
    title,
    description,
    category,
    tags,
    isPublic,
    thumbnail
  } = req.body;

  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      coachId: req.user.coach.id
    }
  });

  if (!video) {
    throw new ApiError(404, 'Video not found');
  }

  const updatedVideo = await prisma.video.update({
    where: { id: videoId },
    data: {
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(category && { category }),
      ...(tags && { tags }),
      ...(isPublic !== undefined && { isPublic }),
      ...(thumbnail && { thumbnail })
    },
    include: {
      course: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  logger.info('Video updated successfully', {
    videoId,
    coachId: req.user.coach.id
  });

  res.json(
    new ApiResponse(200, updatedVideo, 'Video updated successfully')
  );
});

// Delete a video
export const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      coachId: req.user.coach.id
    }
  });

  if (!video) {
    throw new ApiError(404, 'Video not found');
  }

  // Delete video file from S3
  try {
    await fileUploadService.deleteFromS3(video.url);
  } catch (error) {
    logger.error('Failed to delete video file from S3:', error);
  }

  // Delete video record
  await prisma.video.delete({
    where: { id: videoId }
  });

  logger.info('Video deleted successfully', {
    videoId,
    coachId: req.user.coach.id
  });

  res.json(
    new ApiResponse(200, null, 'Video deleted successfully')
  );
});

// Upload video thumbnail
export const uploadThumbnail = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      coachId: req.user.coach.id
    }
  });

  if (!video) {
    throw new ApiError(404, 'Video not found');
  }

  if (!req.file) {
    throw new ApiError(400, 'Thumbnail file is required');
  }

  // Upload thumbnail to S3
  const thumbnailUrl = await fileUploadService.uploadToS3(req.file, 'thumbnails');

  // Update video with thumbnail URL
  const updatedVideo = await prisma.video.update({
    where: { id: videoId },
    data: { thumbnail: thumbnailUrl }
  });

  // Clean up temporary file
  if (fs.existsSync(req.file.path)) {
    fs.unlinkSync(req.file.path);
  }

  logger.info('Video thumbnail uploaded successfully', {
    videoId,
    coachId: req.user.coach.id
  });

  res.json(
    new ApiResponse(200, { thumbnail: thumbnailUrl }, 'Thumbnail uploaded successfully')
  );
});

// Stream video content
export const streamVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      OR: [
        { coachId: req.user.coach?.id },
        { isPublic: true }
      ]
    }
  });

  if (!video) {
    throw new ApiError(404, 'Video not found');
  }

  // Get video file from S3
  try {
    const videoStream = await fileUploadService.getStreamFromS3(video.url);
    
    // Set appropriate headers for video streaming
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', video.size);

    // Handle range requests for video streaming
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : video.size - 1;
      const chunksize = (end - start) + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${video.size}`);
      res.setHeader('Content-Length', chunksize);

      videoStream.pipe(res);
    } else {
      videoStream.pipe(res);
    }
  } catch (error) {
    logger.error('Failed to stream video:', error);
    throw new ApiError(500, 'Failed to stream video');
  }
});

// Track video view
export const trackVideoView = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { watchTime, progress } = req.body;

  const video = await prisma.video.findFirst({
    where: {
      id: videoId,
      OR: [
        { coachId: req.user.coach?.id },
        { isPublic: true }
      ]
    }
  });

  if (!video) {
    throw new ApiError(404, 'Video not found');
  }

  // Create or update video view record
  await prisma.videoView.upsert({
    where: {
      videoId_userId: {
        videoId,
        userId: req.user.id
      }
    },
    update: {
      watchTime: watchTime || 0,
      progress: progress || 0,
      lastWatchedAt: new Date()
    },
    create: {
      videoId,
      userId: req.user.id,
      watchTime: watchTime || 0,
      progress: progress || 0,
      lastWatchedAt: new Date()
    }
  });

  // Update video view count
  await prisma.video.update({
    where: { id: videoId },
    data: {
      views: {
        increment: 1
      }
    }
  });

  logger.info('Video view tracked successfully', {
    videoId,
    userId: req.user.id,
    watchTime,
    progress
  });

  res.json(
    new ApiResponse(200, null, 'View tracked successfully')
  );
});

// Get video analytics for coach
export const getVideoAnalytics = asyncHandler(async (req, res) => {
  const { period = 'month' } = req.query;

  // Calculate date range based on period
  const now = new Date();
  let startDate;
  
  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
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

  const analytics = await prisma.$transaction(async (tx) => {
    // Get total views and watch time
    const totalViews = await tx.videoView.aggregate({
      where: {
        video: {
          coachId: req.user.coach.id
        },
        lastWatchedAt: {
          gte: startDate
        }
      },
      _sum: {
        watchTime: true
      },
      _count: true
    });

    // Get average watch time
    const averageWatchTime = totalViews._count > 0 
      ? totalViews._sum.watchTime / totalViews._count 
      : 0;

    // Get top videos
    const topVideos = await tx.video.findMany({
      where: {
        coachId: req.user.coach.id
      },
      select: {
        id: true,
        title: true,
        views: true,
        _count: {
          select: {
            videoViews: {
              where: {
                lastWatchedAt: {
                  gte: startDate
                }
              }
            }
          }
        }
      },
      orderBy: {
        views: 'desc'
      },
      take: 10
    });

    return {
      totalViews: totalViews._count,
      totalWatchTime: totalViews._sum.watchTime || 0,
      averageWatchTime: Math.round(averageWatchTime),
      topVideos: topVideos.map(video => ({
        videoId: video.id,
        title: video.title,
        views: video.views,
        recentViews: video._count.videoViews
      }))
    };
  });

  res.json(
    new ApiResponse(200, analytics, 'Video analytics retrieved successfully')
  );
});

// Helper function to get video duration (simplified implementation)
const getVideoDuration = async (filePath) => {
  // This is a simplified implementation
  // In production, you would use a library like ffprobe or ffmpeg
  // to get the actual video duration
  return 0; // Placeholder
}; 