-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('ONE_ON_ONE', 'GROUP', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "ScheduledSessionStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ScheduleNotificationType" AS ENUM ('SESSION_SCHEDULED', 'SESSION_APPROVED', 'SESSION_REJECTED', 'SESSION_CANCELLED', 'SESSION_REMINDER', 'AVAILABILITY_UPDATED', 'SCHEDULE_CHANGE');

-- CreateTable
CREATE TABLE "coach_availabilities" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_slots" (
    "id" TEXT NOT NULL,
    "availability_id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "max_bookings" INTEGER NOT NULL DEFAULT 1,
    "current_bookings" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(10,2),
    "sessionType" "SessionType" NOT NULL DEFAULT 'ONE_ON_ONE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_sessions" (
    "id" TEXT NOT NULL,
    "time_slot_id" TEXT NOT NULL,
    "coach_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "course_id" TEXT,
    "session_date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL,
    "sessionType" "SessionType" NOT NULL DEFAULT 'ONE_ON_ONE',
    "status" "ScheduledSessionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "price" DECIMAL(10,2) NOT NULL,
    "meeting_url" TEXT,
    "notes" TEXT,
    "admin_notes" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejection_reason" TEXT,
    "payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "type" "ScheduleNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_availabilities_coach_id_idx" ON "coach_availabilities"("coach_id");

-- CreateIndex
CREATE INDEX "coach_availabilities_day_of_week_idx" ON "coach_availabilities"("day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "coach_availabilities_coach_id_day_of_week_key" ON "coach_availabilities"("coach_id", "day_of_week");

-- CreateIndex
CREATE INDEX "time_slots_availability_id_idx" ON "time_slots"("availability_id");

-- CreateIndex
CREATE INDEX "time_slots_start_time_idx" ON "time_slots"("start_time");

-- CreateIndex
CREATE INDEX "time_slots_is_available_idx" ON "time_slots"("is_available");

-- CreateIndex
CREATE INDEX "scheduled_sessions_time_slot_id_idx" ON "scheduled_sessions"("time_slot_id");

-- CreateIndex
CREATE INDEX "scheduled_sessions_coach_id_idx" ON "scheduled_sessions"("coach_id");

-- CreateIndex
CREATE INDEX "scheduled_sessions_student_id_idx" ON "scheduled_sessions"("student_id");

-- CreateIndex
CREATE INDEX "scheduled_sessions_session_date_idx" ON "scheduled_sessions"("session_date");

-- CreateIndex
CREATE INDEX "scheduled_sessions_status_idx" ON "scheduled_sessions"("status");

-- CreateIndex
CREATE INDEX "schedule_notifications_user_id_idx" ON "schedule_notifications"("user_id");

-- CreateIndex
CREATE INDEX "schedule_notifications_session_id_idx" ON "schedule_notifications"("session_id");

-- CreateIndex
CREATE INDEX "schedule_notifications_type_idx" ON "schedule_notifications"("type");

-- CreateIndex
CREATE INDEX "schedule_notifications_is_read_idx" ON "schedule_notifications"("is_read");

-- CreateIndex
CREATE INDEX "schedule_notifications_scheduled_at_idx" ON "schedule_notifications"("scheduled_at");

-- AddForeignKey
ALTER TABLE "coach_availabilities" ADD CONSTRAINT "coach_availabilities_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "coach_availabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "scheduled_sessions_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "time_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "scheduled_sessions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "scheduled_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "scheduled_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "scheduled_sessions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "scheduled_sessions_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_sessions" ADD CONSTRAINT "scheduled_sessions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_notifications" ADD CONSTRAINT "schedule_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_notifications" ADD CONSTRAINT "schedule_notifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "scheduled_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
