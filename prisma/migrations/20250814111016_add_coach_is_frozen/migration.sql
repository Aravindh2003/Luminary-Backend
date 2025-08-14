-- AlterTable
ALTER TABLE "coaches" ADD COLUMN     "is_frozen" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "coaches_is_frozen_idx" ON "coaches"("is_frozen");
