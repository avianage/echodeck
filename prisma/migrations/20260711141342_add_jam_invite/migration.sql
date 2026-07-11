-- CreateEnum
CREATE TYPE "JamInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "JamInvite" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "JamInviteStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "JamInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JamInvite_inviteeId_status_idx" ON "JamInvite"("inviteeId", "status");

-- AddForeignKey
ALTER TABLE "JamInvite" ADD CONSTRAINT "JamInvite_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JamInvite" ADD CONSTRAINT "JamInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JamInvite" ADD CONSTRAINT "JamInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
