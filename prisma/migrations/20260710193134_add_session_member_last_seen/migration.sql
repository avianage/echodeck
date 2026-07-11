-- AlterTable
ALTER TABLE "SessionMember" ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "SessionMember_creatorId_lastSeenAt_idx" ON "SessionMember"("creatorId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "SessionMember_creatorId_role_idx" ON "SessionMember"("creatorId", "role");
