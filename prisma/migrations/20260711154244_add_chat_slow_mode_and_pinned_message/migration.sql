-- AlterTable
ALTER TABLE "CurrentStream" ADD COLUMN     "pinnedMessageId" TEXT,
ADD COLUMN     "slowModeSeconds" INTEGER NOT NULL DEFAULT 0;
