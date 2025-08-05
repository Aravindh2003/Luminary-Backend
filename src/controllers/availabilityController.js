import { PrismaClient } from '@prisma/client';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';
import resendEmailService from '../services/resendEmailService.js';

const prisma = new PrismaClient();

// Coach Availability Management
export const setCoachAvailability = asyncHandler(async (req, res) => {
  const { coachId } = req.params;
  const { availability } = req.body;

  // Validate that the user is the coach or an admin
  if (req.user.role !== 'ADMIN' && req.user.id !== coachId) {
    throw new ApiError(403, 'Access denied. You can only set your own availability.');
  }

  // Validate availability data
  if (!availability || !Array.isArray(availability)) {
    throw new ApiError(400, 'Availability data is required and must be an array');
  }

  // Validate each day's availability
  for (const day of availability) {
    if (typeof day.dayOfWeek !== 'number' || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
      throw new ApiError(400, 'Invalid day of week. Must be 0-6 (Sunday-Saturday)');
    }
    if (!Array.isArray(day.timeSlots)) {
      throw new ApiError(400, 'Time slots must be an array');
    }
    for (const slot of day.timeSlots) {
      if (!slot.startTime || !slot.endTime) {
        throw new ApiError(400, 'Start time and end time are required for each time slot');
      }
      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        throw new ApiError(400, 'Invalid time format. Use HH:MM format');
      }
    }
  }

  // Delete existing availability for this coach
  await prisma.coachAvailability.deleteMany({
    where: { coachId }
  });

  // Create new availability
  const createdAvailability = [];
  for (const day of availability) {
    const coachAvailability = await prisma.coachAvailability.create({
      data: {
        coachId,
        dayOfWeek: day.dayOfWeek,
        isActive: day.isActive !== false,
        timeSlots: {
          create: day.timeSlots.map(slot => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            isAvailable: slot.isAvailable !== false,
            maxBookings: slot.maxBookings || 1,
            price: slot.price ? parseFloat(slot.price) : null,
            sessionType: slot.sessionType || 'ONE_ON_ONE'
          }))
        }
      },
      include: {
        timeSlots: true
      }
    });
    createdAvailability.push(coachAvailability);
  }

  // Send notification to admin about availability update
  if (req.user.role !== 'ADMIN') {
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' }
    });

    for (const admin of adminUsers) {
      await resendEmailService.sendEmail({
        to: admin.email,
        subject: 'Coach Availability Updated',
        html: `
          <h2>Coach Availability Update</h2>
          <p>Coach ${req.user.firstName} ${req.user.lastName} has updated their availability.</p>
          <p>Please review the new schedule in the admin dashboard.</p>
        `
      });
    }
  }

  logger.info(`Coach availability updated for coach ${coachId}`);

  res.status(200).json(new ApiResponse(200, {
    availability: createdAvailability
  }, 'Coach availability updated successfully'));
});

export const getCoachAvailability = asyncHandler(async (req, res) => {
  const { coachId } = req.params;
  const { date } = req.query;

  // Validate that the user can access this coach's availability
  if (req.user.role !== 'ADMIN' && req.user.id !== coachId) {
    throw new ApiError(403, 'Access denied');
  }

  const availability = await prisma.coachAvailability.findMany({
    where: { coachId },
    include: {
      timeSlots: {
        include: {
          scheduledSessions: {
            where: date ? {
              sessionDate: {
                gte: new Date(date),
                lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
              }
            } : undefined,
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              },
              course: {
                select: {
                  id: true,
                  title: true
                }
              }
            }
          }
        },
        orderBy: { startTime: 'asc' }
      }
    },
    orderBy: { dayOfWeek: 'asc' }
  });

  res.status(200).json(new ApiResponse(200, {
    availability
  }, 'Coach availability retrieved successfully'));
});

export const getAvailableTimeSlots = asyncHandler(async (req, res) => {
  const { coachId, date, sessionType = 'ONE_ON_ONE' } = req.query;

  if (!coachId || !date) {
    throw new ApiError(400, 'Coach ID and date are required');
  }

  const sessionDate = new Date(date);
  const dayOfWeek = sessionDate.getDay();

  const availability = await prisma.coachAvailability.findFirst({
    where: {
      coachId,
      dayOfWeek,
      isActive: true
    },
    include: {
      timeSlots: {
        where: {
          isAvailable: true,
          sessionType: sessionType.toUpperCase(),
          OR: [
            { currentBookings: { lt: prisma.timeSlot.fields.maxBookings } },
            { maxBookings: { gt: 0 } }
          ]
        },
        include: {
          scheduledSessions: {
            where: {
              sessionDate: {
                gte: sessionDate,
                lt: new Date(sessionDate.setDate(sessionDate.getDate() + 1))
              },
              status: {
                in: ['PENDING_APPROVAL', 'APPROVED']
              }
            }
          }
        },
        orderBy: { startTime: 'asc' }
      }
    }
  });

  if (!availability) {
    return res.status(200).json(new ApiResponse(200, {
      availableSlots: []
    }, 'No availability found for this date'));
  }

  // Filter out fully booked slots
  const availableSlots = availability.timeSlots.filter(slot => 
    slot.scheduledSessions.length < slot.maxBookings
  );

  res.status(200).json(new ApiResponse(200, {
    availableSlots
  }, 'Available time slots retrieved successfully'));
});

// Admin Availability Management
export const getAllCoachAvailabilities = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    search, 
    status = 'all',
    dayOfWeek 
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = {};
  
  if (search) {
    where.coach = {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    };
  }

  if (dayOfWeek !== undefined) {
    where.dayOfWeek = parseInt(dayOfWeek);
  }

  if (status === 'active') {
    where.isActive = true;
  } else if (status === 'inactive') {
    where.isActive = false;
  }

  const [availabilities, total] = await Promise.all([
    prisma.coachAvailability.findMany({
      where,
      include: {
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        timeSlots: {
          orderBy: { startTime: 'asc' }
        }
      },
      orderBy: [
        { coach: { firstName: 'asc' } },
        { dayOfWeek: 'asc' }
      ],
      skip,
      take: parseInt(limit)
    }),
    prisma.coachAvailability.count({ where })
  ]);

  res.status(200).json(new ApiResponse(200, {
    availabilities,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  }, 'Coach availabilities retrieved successfully'));
});

export const approveCoachAvailability = asyncHandler(async (req, res) => {
  const { availabilityId } = req.params;
  const { adminNotes } = req.body;

  const availability = await prisma.coachAvailability.findUnique({
    where: { id: availabilityId },
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

  if (!availability) {
    throw new ApiError(404, 'Availability not found');
  }

  // Update availability status (if needed) and send notification
  await prisma.coachAvailability.update({
    where: { id: availabilityId },
    data: {
      isActive: true
    }
  });

  // Send notification to coach
  await resendEmailService.sendEmail({
    to: availability.coach.email,
    subject: 'Your Availability Has Been Approved',
    html: `
      <h2>Availability Approval</h2>
      <p>Dear ${availability.coach.firstName},</p>
      <p>Your availability schedule has been approved by the admin.</p>
      ${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}
      <p>You can now receive bookings for your available time slots.</p>
    `
  });

  logger.info(`Coach availability approved: ${availabilityId} by admin ${req.user.id}`);

  res.status(200).json(new ApiResponse(200, {
    availability
  }, 'Coach availability approved successfully'));
});

export const rejectCoachAvailability = asyncHandler(async (req, res) => {
  const { availabilityId } = req.params;
  const { rejectionReason, adminNotes } = req.body;

  if (!rejectionReason) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  const availability = await prisma.coachAvailability.findUnique({
    where: { id: availabilityId },
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

  if (!availability) {
    throw new ApiError(404, 'Availability not found');
  }

  // Deactivate availability
  await prisma.coachAvailability.update({
    where: { id: availabilityId },
    data: {
      isActive: false
    }
  });

  // Send notification to coach
  await resendEmailService.sendEmail({
    to: availability.coach.email,
    subject: 'Your Availability Needs Revision',
    html: `
      <h2>Availability Revision Required</h2>
      <p>Dear ${availability.coach.firstName},</p>
      <p>Your availability schedule requires revision.</p>
      <p><strong>Reason:</strong> ${rejectionReason}</p>
      ${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}
      <p>Please update your availability and resubmit for approval.</p>
    `
  });

  logger.info(`Coach availability rejected: ${availabilityId} by admin ${req.user.id}`);

  res.status(200).json(new ApiResponse(200, {
    availability
  }, 'Coach availability rejected successfully'));
});

// Schedule Management
export const scheduleSession = asyncHandler(async (req, res) => {
  const { 
    timeSlotId, 
    studentId, 
    courseId, 
    sessionDate, 
    title, 
    description, 
    duration, 
    sessionType, 
    price,
    notes 
  } = req.body;

  // Validate required fields
  if (!timeSlotId || !studentId || !sessionDate || !title || !duration || !price) {
    throw new ApiError(400, 'Missing required fields');
  }

  // Check if time slot is available
  const timeSlot = await prisma.timeSlot.findUnique({
    where: { id: timeSlotId },
    include: {
      availability: {
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
      },
      scheduledSessions: {
        where: {
          sessionDate: new Date(sessionDate),
          status: {
            in: ['PENDING_APPROVAL', 'APPROVED']
          }
        }
      }
    }
  });

  if (!timeSlot) {
    throw new ApiError(404, 'Time slot not found');
  }

  if (!timeSlot.isAvailable) {
    throw new ApiError(400, 'Time slot is not available');
  }

  if (timeSlot.scheduledSessions.length >= timeSlot.maxBookings) {
    throw new ApiError(400, 'Time slot is fully booked');
  }

  // Create scheduled session
  const scheduledSession = await prisma.scheduledSession.create({
    data: {
      timeSlotId,
      coachId: timeSlot.availability.coachId,
      studentId,
      courseId,
      sessionDate: new Date(sessionDate),
      title,
      description,
      duration: parseInt(duration),
      sessionType: sessionType?.toUpperCase() || 'ONE_ON_ONE',
      price: parseFloat(price),
      notes,
      status: 'PENDING_APPROVAL'
    },
    include: {
      coach: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      course: {
        select: {
          id: true,
          title: true
        }
      },
      timeSlot: true
    }
  });

  // Update time slot booking count
  await prisma.timeSlot.update({
    where: { id: timeSlotId },
    data: {
      currentBookings: {
        increment: 1
      }
    }
  });

  // Send notifications
  await Promise.all([
    // Notify coach
    resendEmailService.sendEmail({
      to: timeSlot.availability.coach.email,
      subject: 'New Session Scheduled',
      html: `
        <h2>New Session Scheduled</h2>
        <p>You have a new session scheduled:</p>
        <p><strong>Title:</strong> ${title}</p>
        <p><strong>Date:</strong> ${new Date(sessionDate).toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${timeSlot.startTime} - ${timeSlot.endTime}</p>
        <p><strong>Student:</strong> ${scheduledSession.student.firstName} ${scheduledSession.student.lastName}</p>
        <p>Please review and approve this session.</p>
      `
    }),
    // Notify student
    resendEmailService.sendEmail({
      to: scheduledSession.student.email,
      subject: 'Session Scheduled - Pending Approval',
      html: `
        <h2>Session Scheduled</h2>
        <p>Your session has been scheduled and is pending coach approval:</p>
        <p><strong>Title:</strong> ${title}</p>
        <p><strong>Date:</strong> ${new Date(sessionDate).toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${timeSlot.startTime} - ${timeSlot.endTime}</p>
        <p><strong>Coach:</strong> ${scheduledSession.coach.firstName} ${scheduledSession.coach.lastName}</p>
        <p>You will be notified once the coach approves the session.</p>
      `
    })
  ]);

  logger.info(`Session scheduled: ${scheduledSession.id} by user ${req.user.id}`);

  res.status(201).json(new ApiResponse(201, {
    session: scheduledSession
  }, 'Session scheduled successfully'));
});

export const approveSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { adminNotes } = req.body;

  const session = await prisma.scheduledSession.findUnique({
    where: { id: sessionId },
    include: {
      coach: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      course: {
        select: {
          id: true,
          title: true
        }
      },
      timeSlot: true
    }
  });

  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  if (session.status !== 'PENDING_APPROVAL') {
    throw new ApiError(400, 'Session is not pending approval');
  }

  // Update session status
  const updatedSession = await prisma.scheduledSession.update({
    where: { id: sessionId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedBy: req.user.id,
      adminNotes
    },
    include: {
      coach: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      course: {
        select: {
          id: true,
          title: true
        }
      },
      timeSlot: true
    }
  });

  // Send notifications
  await Promise.all([
    // Notify coach
    resendEmailService.sendEmail({
      to: session.coach.email,
      subject: 'Session Approved',
      html: `
        <h2>Session Approved</h2>
        <p>Your session has been approved:</p>
        <p><strong>Title:</strong> ${session.title}</p>
        <p><strong>Date:</strong> ${session.sessionDate.toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${session.timeSlot.startTime} - ${session.timeSlot.endTime}</p>
        <p><strong>Student:</strong> ${session.student.firstName} ${session.student.lastName}</p>
        ${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}
      `
    }),
    // Notify student
    resendEmailService.sendEmail({
      to: session.student.email,
      subject: 'Session Confirmed',
      html: `
        <h2>Session Confirmed</h2>
        <p>Your session has been confirmed:</p>
        <p><strong>Title:</strong> ${session.title}</p>
        <p><strong>Date:</strong> ${session.sessionDate.toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${session.timeSlot.startTime} - ${session.timeSlot.endTime}</p>
        <p><strong>Coach:</strong> ${session.coach.firstName} ${session.coach.lastName}</p>
        ${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}
      `
    })
  ]);

  logger.info(`Session approved: ${sessionId} by admin ${req.user.id}`);

  res.status(200).json(new ApiResponse(200, {
    session: updatedSession
  }, 'Session approved successfully'));
});

export const rejectSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { rejectionReason, adminNotes } = req.body;

  if (!rejectionReason) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  const session = await prisma.scheduledSession.findUnique({
    where: { id: sessionId },
    include: {
      coach: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      timeSlot: true
    }
  });

  if (!session) {
    throw new ApiError(404, 'Session not found');
  }

  if (session.status !== 'PENDING_APPROVAL') {
    throw new ApiError(400, 'Session is not pending approval');
  }

  // Update session status
  const updatedSession = await prisma.scheduledSession.update({
    where: { id: sessionId },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectedBy: req.user.id,
      rejectionReason,
      adminNotes
    },
    include: {
      coach: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      timeSlot: true
    }
  });

  // Update time slot booking count
  await prisma.timeSlot.update({
    where: { id: session.timeSlotId },
    data: {
      currentBookings: {
        decrement: 1
      }
    }
  });

  // Send notifications
  await Promise.all([
    // Notify coach
    resendEmailService.sendEmail({
      to: session.coach.email,
      subject: 'Session Rejected',
      html: `
        <h2>Session Rejected</h2>
        <p>Your session has been rejected:</p>
        <p><strong>Title:</strong> ${session.title}</p>
        <p><strong>Date:</strong> ${session.sessionDate.toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${session.timeSlot.startTime} - ${session.timeSlot.endTime}</p>
        <p><strong>Student:</strong> ${session.student.firstName} ${session.student.lastName}</p>
        <p><strong>Reason:</strong> ${rejectionReason}</p>
        ${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}
      `
    }),
    // Notify student
    resendEmailService.sendEmail({
      to: session.student.email,
      subject: 'Session Cancelled',
      html: `
        <h2>Session Cancelled</h2>
        <p>Your session has been cancelled:</p>
        <p><strong>Title:</strong> ${session.title}</p>
        <p><strong>Date:</strong> ${session.sessionDate.toLocaleDateString()}</p>
        <p><strong>Time:</strong> ${session.timeSlot.startTime} - ${session.timeSlot.endTime}</p>
        <p><strong>Coach:</strong> ${session.coach.firstName} ${session.coach.lastName}</p>
        <p><strong>Reason:</strong> ${rejectionReason}</p>
        ${adminNotes ? `<p><strong>Admin Notes:</strong> ${adminNotes}</p>` : ''}
      `
    })
  ]);

  logger.info(`Session rejected: ${sessionId} by admin ${req.user.id}`);

  res.status(200).json(new ApiResponse(200, {
    session: updatedSession
  }, 'Session rejected successfully'));
});

export const getScheduledSessions = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status, 
    coachId, 
    studentId, 
    startDate, 
    endDate,
    sessionType 
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build where clause
  const where = {};

  if (status) {
    where.status = status.toUpperCase();
  }

  if (coachId) {
    where.coachId = coachId;
  }

  if (studentId) {
    where.studentId = studentId;
  }

  if (startDate && endDate) {
    where.sessionDate = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  if (sessionType) {
    where.sessionType = sessionType.toUpperCase();
  }

  const [sessions, total] = await Promise.all([
    prisma.scheduledSession.findMany({
      where,
      include: {
        coach: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        course: {
          select: {
            id: true,
            title: true
          }
        },
        timeSlot: true,
        approvedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        rejectedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { sessionDate: 'asc' },
      skip,
      take: parseInt(limit)
    }),
    prisma.scheduledSession.count({ where })
  ]);

  res.status(200).json(new ApiResponse(200, {
    sessions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  }, 'Scheduled sessions retrieved successfully'));
});

// Notification Management
export const getScheduleNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, isRead } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = { userId: req.user.id };

  if (isRead !== undefined) {
    where.isRead = isRead === 'true';
  }

  const [notifications, total] = await Promise.all([
    prisma.scheduleNotification.findMany({
      where,
      include: {
        session: {
          include: {
            coach: {
              select: {
                firstName: true,
                lastName: true
              }
            },
            student: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    prisma.scheduleNotification.count({ where })
  ]);

  res.status(200).json(new ApiResponse(200, {
    notifications,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  }, 'Schedule notifications retrieved successfully'));
});

export const markNotificationAsRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  const notification = await prisma.scheduleNotification.findUnique({
    where: { id: notificationId }
  });

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  if (notification.userId !== req.user.id) {
    throw new ApiError(403, 'Access denied');
  }

  await prisma.scheduleNotification.update({
    where: { id: notificationId },
    data: { isRead: true }
  });

  res.status(200).json(new ApiResponse(200, {}, 'Notification marked as read'));
});

export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  await prisma.scheduleNotification.updateMany({
    where: { 
      userId: req.user.id,
      isRead: false
    },
    data: { isRead: true }
  });

  res.status(200).json(new ApiResponse(200, {}, 'All notifications marked as read'));
}); 