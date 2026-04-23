-- CreateTable
CREATE TABLE "BlockedVideo" (
    "videoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedVideo_pkey" PRIMARY KEY ("videoId")
);
