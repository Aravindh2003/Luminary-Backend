import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';

// Get all sessions with filtering
export const getSessions = asyncHandler(async (req, res) => {
  const {
    status,
    courseId,
    coachId,
    studentId,
    startDate,
    endDate,
    page = 1,
    limit = 10,
    sortBy = 'startTime',
    sortOrder = 'asc'
  } = req.query;

  const userId = req.user.id;
  const userRole = req.user.role;

  // Build where clause for filtering
  const where = {};

  // Role-based filtering
  if (userRole === 'COACH') {
    where.coachId = userId;
  } else if (userRole === 'PARENT') {
    where.studentId = userId;
  }

  // Status filter
  if (status) {
    where.status = status;
  }

  // Course filter
  if (courseId) {
    where.courseId = courseId;
  }

  // Coach filter (admin can filter by any coach)
  if (coachId && userRole === 'ADMIN') {
    where.coachId = coachId;
  }

  // Student filter (admin can filter by any student)
  if (studentId && userRole === 'ADMIN') {
    where.studentId = studentId;
  }

  // Date range filter
  if (startDate || endDate) {
    where.startTime = {};
    if (startDate) where.startTime.gte = new Date(startDate);
    if (endDate) where.startTime.lte = new Date(endDate);
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  // Sort order
  const orderBy = {};
  orderBy[sortBy] = sortOrder;

  const [sessions, totalCount] = await Promise.all([
    prisma.session.findMany({
      where,
      include: {
        course: {
          select: {
            id: true,
            title: true,
            category: true,
            level: true
          }
        },
        coach: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                profileImageUrl: true
              }
            }
          }
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true
          }
        }
      },
      orderBy,
      skip,
      take
    }),
    prisma.session.count({ where })
  ]);

  // Format response
  const formattedSessions = sessions.map(session => ({
    id: session.id,
    title: session.title,
    description: session.description,
    startTime: session.startTime,
    endTime: session.endTime,
    duration: session.duration,
    status: session.status,
    meetingUrl: session.meetingUrl,
    notes: session.notes,
    recordingUrl: session.recordingUrl,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    course: {
      id: session.course.id,
      title: session.course.title,
      category: session.course.category,
      level: session.course.level
    },
    coach: {
      id: session.coach.id,
      name: `${session.coach.user.firstName} ${session.coach.user.lastName}`,
      avatar: session.coach.user.profileImageUrl
    },
    student: {
      id: session.student.id,
      name: `${session.student.firstName} ${session.student.lastName}`,
      avatar: session.student.profileImageUrl
    }
  }));

  const totalPages = Math.ceil(totalCount / take);

  res.json(
    new ApiResponse(200, {
      sessions: formattedSessions,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    }, 'Sessions retrieved successfully')
  );
});

// Get session by ID
export const getSessionById = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  // Build where clause based on user role
  const where = { id: sessionId };

  if (userRole === 'COACH') {
    where.coachId = userId;
  } else if (userRole === 'PARENT') {
    where.studentId = userId;
  }
  // Admin can access any session

  const session = await prisma.session.findFirst({
    where,
    include: {
      course: {
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          level: true,
          duration: true,
          price: true,
          currency: true
        }
      },
      coach: {
        select: {
          id: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              profileImageUrl: true,
              email: true,
              phone: true
            }
          },
          rating: true,
          totalReviews: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImageUrl: true,
          email: true,
          phone: true
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
    }
  });

  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  // Format response
  const formattedSession = {
    id: session.id,
    title: session.title,
    description: session.description,
    startTime: session.startTime,
    endTime: session.endTime,
    duration: session.duration,
    status: session.status,
    meetingUrl: session.meetingUrl,
    notes: session.notes,
    recordingUrl: session.recordingUrl,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    course: session.course,
    coach: {
      id: session.coach.id,
      name: `${session.coach.user.firstName} ${session.coach.user.lastName}`,
      avatar: session.coach.user.profileImageUrl,
      email: session.coach.user.email,
      phone: session.coach.user.phone,
      rating: session.coach.rating,
      totalReviews: session.coach.totalReviews
    },
    student: {
      id: session.student.id,
      name: `${session.student.firstName} ${session.student.lastName}`,
      avatar: session.student.profileImageUrl,
      email: session.student.email,
      phone: session.student.phone
    },
    payment: session.payment
  };

  res.json(
    new ApiResponse(200, formattedSession, 'Session details retrieved successfully')
  );
});

// Create new session
export const createSession = asyncHandler(async (req, res) => {
  const {
    courseId,
    studentId,
    title,
    description,
    startTime,
    endTime,
    duration,
    meetingUrl
  } = req.body;

  const coachId = req.user.id;

  // Check if course exists and belongs to the coach
  const course = await prisma.course.findFirst({
    where: {
      id: courseId,
      coachId
    }
  });

  if (!course) {
    throw new ApiError(404, 'Course not found or access denied');
  }

  // Check for scheduling conflicts
  const conflictingSession = await prisma.session.findFirst({
    where: {
      coachId,
      status: {
        in: ['SCHEDULED', 'IN_PROGRESS']
      },
      OR: [
        {
          startTime: {
            lt: new Date(endTime),
            gte: new Date(startTime)
          }
        },
        {
          endTime: {
            gt: new Date(startTime),
            lte: new Date(endTime)
          }
        }
      ]
    }
  });

  if (conflictingSession) {
    throw new ApiError(400, 'Session time conflicts with existing session');
  }

  // Create session
  const session = await prisma.session.create({
    data: {
      courseId,
      coachId,
      studentId,
      title,
      description,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      duration: parseInt(duration),
      meetingUrl,
      status: 'SCHEDULED'
    },
    include: {
      course: {
        select: {
          title: true
        }
      },
      student: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  });

  logger.info(`Session created: ${session.title} by coach ${coachId} for student ${session.student.firstName} ${session.student.lastName}`);

  res.status(201).json(
    new ApiResponse(201, session, 'Session created successfully')
  );
});

// Update session
export const updateSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const coachId = req.user.id;

  // Check if session exists and belongs to the coach
  const existingSession = await prisma.session.findFirst({
    where: {
      id: sessionId,
      coachId
    }
  });

  if (!existingSession) {
    throw new ApiError(404, 'Session not found or access denied');
  }

  // Check if session can be updated
  if (existingSession.status === 'COMPLETED' || existingSession.status === 'CANCELLED') {
    throw new ApiError(400, 'Cannot update completed or cancelled session');
  }

  const {
    title,
    description,
    startTime,
    endTime,
    duration,
    meetingUrl,
    notes
  } = req.body;

  // Check for scheduling conflicts if time is being changed
  if (startTime || endTime) {
    const newStartTime = startTime ? new Date(startTime) : existingSession.startTime;
    const newEndTime = endTime ? new Date(endTime) : existingSession.endTime;

    const conflictingSession = await prisma.session.findFirst({
      where: {
        coachId,
        id: { not: sessionId },
        status: {
          in: ['SCHEDULED', 'IN_PROGRESS']
        },
        OR: [
          {
            startTime: {
              lt: newEndTime,
              gte: newStartTime
            }
          },
          {
            endTime: {
              gt: newStartTime,
              lte: newEndTime
            }
          }
        ]
      }
    });

    if (conflictingSession) {
      throw new ApiError(400, 'Session time conflicts with existing session');
    }
  }

  // Update session
  const updatedSession = await prisma.session.update({
    where: { id: sessionId },
    data: {
      title: title || existingSession.title,
      description: description || existingSession.description,
      startTime: startTime ? new Date(startTime) : existingSession.startTime,
      endTime: endTime ? new Date(endTime) : existingSession.endTime,
      duration: duration ? parseInt(duration) : existingSession.duration,
      meetingUrl: meetingUrl || existingSession.meetingUrl,
      notes: notes || existingSession.notes
    }
  });

  logger.info(`Session updated: ${updatedSession.title} by coach ${coachId}`);

  res.json(
    new ApiResponse(200, updatedSession, 'Session updated successfully')
  );
});

// Cancel session
export const cancelSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const coachId = req.user.id;

  // Check if session exists and belongs to the coach
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      coachId
    }
  });

  if (!session) {
    throw new ApiError(404, 'Session not found or access denied');
  }

  // Check if session can be cancelled
  if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
    throw new ApiError(400, 'Session is already completed or cancelled');
  }

  // Cancel session
  const cancelledSession = await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: 'CANCELLED'
    }
  });

  logger.info(`Session cancelled: ${cancelledSession.title} by coach ${coachId}`);

  res.json(
    new ApiResponse(200, cancelledSession, 'Session cancelled successfully')
  );
});

// Start session
export const startSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const coachId = req.user.id;

  // Check if session exists and belongs to the coach
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      coachId
    }
  });

  if (!session) {
    throw new ApiError(404, 'Session not found or access denied');
  }

  // Check if session can be started
  if (session.status !== 'SCHEDULED') {
    throw new ApiError(400, 'Session cannot be started');
  }

  const now = new Date();
  const sessionStartTime = new Date(session.startTime);
  const timeDiff = Math.abs(now - sessionStartTime) / (1000 * 60); // minutes

  // Allow starting session 5 minutes before or after scheduled time
  if (timeDiff > 5) {
    throw new ApiError(400, 'Session can only be started within 5 minutes of scheduled time');
  }

  // Start session
  const startedSession = await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: 'IN_PROGRESS'
    }
  });

  logger.info(`Session started: ${startedSession.title} by coach ${coachId}`);

  res.json(
    new ApiResponse(200, startedSession, 'Session started successfully')
  );
});

// Complete session
export const completeSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { notes, recordingUrl } = req.body;
  const coachId = req.user.id;

  // Check if session exists and belongs to the coach
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      coachId
    }
  });

  if (!session) {
    throw new ApiError(404, 'Session not found or access denied');
  }

  // Check if session can be completed
  if (session.status !== 'IN_PROGRESS') {
    throw new ApiError(400, 'Session is not in progress');
  }

  // Complete session
  const completedSession = await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      notes: notes || session.notes,
      recordingUrl: recordingUrl || session.recordingUrl
    }
  });

  logger.info(`Session completed: ${completedSession.title} by coach ${coachId}`);

  res.json(
    new ApiResponse(200, completedSession, 'Session completed successfully')
  );
});

// Join session
export const joinSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  // Check if session exists and user is the student
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      studentId: userId
    },
    include: {
      course: {
        select: {
          title: true
        }
      },
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

  if (!session) {
    throw new ApiError(404, 'Session not found or access denied');
  }

  // Check if session can be joined
  if (session.status !== 'SCHEDULED' && session.status !== 'IN_PROGRESS') {
    throw new ApiError(400, 'Session is not available for joining');
  }

  const now = new Date();
  const sessionStartTime = new Date(session.startTime);
  const sessionEndTime = new Date(session.endTime);

  // Check if it's time to join
  if (now < sessionStartTime) {
    throw new ApiError(400, 'Session has not started yet');
  }

  if (now > sessionEndTime) {
    throw new ApiError(400, 'Session has already ended');
  }

  // Generate meeting URL if not provided
  let meetingUrl = session.meetingUrl;
  if (!meetingUrl) {
    meetingUrl = `https://meet.google.com/${generateMeetingId()}`;
    
    // Update session with meeting URL
    await prisma.session.update({
      where: { id: sessionId },
      data: { meetingUrl }
    });
  }

  logger.info(`Session joined: ${session.title} by student ${userId}`);

  res.json(
    new ApiResponse(200, {
      meetingUrl,
      sessionInfo: {
        id: session.id,
        title: session.title,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        courseTitle: session.course.title,
        coachName: `${session.coach.user.firstName} ${session.coach.user.lastName}`
      }
    }, 'Session joined successfully')
  );
});

// Update session notes
export const updateSessionNotes = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { notes } = req.body;
  const coachId = req.user.id;

  // Check if session exists and belongs to the coach
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      coachId
    }
  });

  if (!session) {
    throw new ApiError(404, 'Session not found or access denied');
  }

  // Update notes
  const updatedSession = await prisma.session.update({
    where: { id: sessionId },
    data: { notes }
  });

  logger.info(`Session notes updated: ${updatedSession.title} by coach ${coachId}`);

  res.json(
    new ApiResponse(200, updatedSession, 'Session notes updated successfully')
  );
});

// Get upcoming sessions for current user
export const getUpcomingSessions = asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;
  const userId = req.user.id;
  const userRole = req.user.role;

  // Build where clause based on user role
  const where = {
    status: {
      in: ['SCHEDULED', 'IN_PROGRESS']
    },
    startTime: {
      gte: new Date()
    }
  };

  if (userRole === 'COACH') {
    where.coachId = userId;
  } else if (userRole === 'PARENT') {
    where.studentId = userId;
  }

  const sessions = await prisma.session.findMany({
    where,
    include: {
      course: {
        select: {
          id: true,
          title: true,
          category: true
        }
      },
      coach: {
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              profileImageUrl: true
            }
          }
        }
      },
      student: {
        select: {
          firstName: true,
          lastName: true,
          profileImageUrl: true
        }
      }
    },
    orderBy: {
      startTime: 'asc'
    },
    take: parseInt(limit)
  });

  // Format response
  const formattedSessions = sessions.map(session => ({
    id: session.id,
    title: session.title,
    startTime: session.startTime,
    endTime: session.endTime,
    duration: session.duration,
    status: session.status,
    meetingUrl: session.meetingUrl,
    course: {
      id: session.course.id,
      title: session.course.title,
      category: session.course.category
    },
    coach: {
      name: `${session.coach.user.firstName} ${session.coach.user.lastName}`,
      avatar: session.coach.user.profileImageUrl
    },
    student: {
      name: `${session.student.firstName} ${session.student.lastName}`,
      avatar: session.student.profileImageUrl
    }
  }));

  res.json(
    new ApiResponse(200, formattedSessions, 'Upcoming sessions retrieved successfully')
  );
});

// Get calendar sessions
export const getCalendarSessions = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const userId = req.user.id;
  const userRole = req.user.role;

  // Build where clause based on user role
  const where = {
    startTime: {
      gte: new Date(startDate),
      lte: new Date(endDate)
    }
  };

  if (userRole === 'COACH') {
    where.coachId = userId;
  } else if (userRole === 'PARENT') {
    where.studentId = userId;
  }

  const sessions = await prisma.session.findMany({
    where,
    include: {
      course: {
        select: {
          title: true,
          category: true
        }
      },
      coach: {
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      },
      student: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: {
      startTime: 'asc'
    }
  });

  // Format for calendar
  const calendarSessions = sessions.map(session => ({
    id: session.id,
    title: session.title,
    start: session.startTime,
    end: session.endTime,
    status: session.status,
    courseTitle: session.course.title,
    courseCategory: session.course.category,
    coachName: `${session.coach.user.firstName} ${session.coach.user.lastName}`,
    studentName: `${session.student.firstName} ${session.student.lastName}`,
    backgroundColor: getStatusColor(session.status),
    borderColor: getStatusColor(session.status)
  }));

  res.json(
    new ApiResponse(200, calendarSessions, 'Calendar sessions retrieved successfully')
  );
});

// Helper function to generate meeting ID
function generateMeetingId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  result += '-';
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  result += '-';
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper function to get status color for calendar
function getStatusColor(status) {
  switch (status) {
    case 'SCHEDULED':
      return '#3B82F6'; // Blue
    case 'IN_PROGRESS':
      return '#10B981'; // Green
    case 'COMPLETED':
      return '#6B7280'; // Gray
    case 'CANCELLED':
      return '#EF4444'; // Red
    case 'NO_SHOW':
      return '#F59E0B'; // Yellow
    default:
      return '#6B7280'; // Gray
  }
} 