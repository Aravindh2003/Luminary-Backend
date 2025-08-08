-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "admin_notes" TEXT,
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "rejected_at" TIMESTAMP(3),
ADD COLUMN     "rejection_reason" TEXT,
ALTER COLUMN "is_active" SET DEFAULT false;
