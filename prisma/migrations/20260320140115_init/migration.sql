-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('MEMBER', 'CREATOR', 'OWNER');

-- CreateEnum
CREATE TYPE "StreamRole" AS ENUM ('MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "FriendStatus" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "StreamType" AS ENUM ('Spotify', 'Youtube');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('Google', 'Spotify');

-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StreamEventType" AS ENUM ('USER_BANNED_PLATFORM', 'USER_BANNED_STREAM', 'USER_TIMED_OUT_PLATFORM', 'USER_TIMED_OUT_STREAM', 'CREATOR_ROLE_REVOKED', 'STREAM_FORCE_CLOSED', 'MOD_PROMOTED', 'MOD_DEMOTED', 'SONG_REMOVED_BY_MOD', 'SONG_SKIPPED_BY_CREATOR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "displayName" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usernameUpdatedAt" TIMESTAMP(3),
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'MEMBER',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "bannedUntil" TIMESTAMP(3),
    "bannedAt" TIMESTAMP(3),
    "spotifyConnected" BOOLEAN NOT NULL DEFAULT false,
    "spotifyAccessToken" TEXT,
    "spotifyRefreshToken" TEXT,
    "spotifyTokenExpiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "provider" "Provider",
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "allowFriendRequests" BOOLEAN NOT NULL DEFAULT true,
    "partyCode" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Stream" (
    "id" TEXT NOT NULL,
    "type" "StreamType" NOT NULL,
    "url" TEXT NOT NULL,
    "extractedId" TEXT NOT NULL,
    "smallImg" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "bigImg" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "played" BOOLEAN NOT NULL DEFAULT false,
    "playedTs" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "viewerCount" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,

    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrentStream" (
    "userId" TEXT NOT NULL,
    "streamId" TEXT,
    "currentTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "viewerCount" INTEGER NOT NULL DEFAULT 0,
    "genre" TEXT,
    "title" TEXT,

    CONSTRAINT "CurrentStream_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SessionMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "role" "StreamRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "bannedUntil" TIMESTAMP(3),
    "bannedAt" TIMESTAMP(3),

    CONSTRAINT "SessionMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" "FriendStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListeningActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "songTitle" TEXT,
    "songId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListeningActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "favoriteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamAccess" (
    "id" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "status" "AccessStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upvote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "streamId" TEXT NOT NULL,

    CONSTRAINT "Upvote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreamEvent" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "type" "StreamEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceMode" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceMode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_partyCode_key" ON "User"("partyCode");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "CurrentStream_streamId_key" ON "CurrentStream"("streamId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMember_userId_creatorId_key" ON "SessionMember"("userId", "creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE UNIQUE INDEX "ListeningActivity_userId_key" ON "ListeningActivity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_favoriteId_key" ON "Favorite"("userId", "favoriteId");

-- CreateIndex
CREATE UNIQUE INDEX "StreamAccess_streamerId_viewerId_key" ON "StreamAccess"("streamerId", "viewerId");

-- CreateIndex
CREATE UNIQUE INDEX "Upvote_userId_streamId_key" ON "Upvote"("userId", "streamId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentStream" ADD CONSTRAINT "CurrentStream_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentStream" ADD CONSTRAINT "CurrentStream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMember" ADD CONSTRAINT "SessionMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningActivity" ADD CONSTRAINT "ListeningActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_favoriteId_fkey" FOREIGN KEY ("favoriteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamAccess" ADD CONSTRAINT "StreamAccess_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StreamAccess" ADD CONSTRAINT "StreamAccess_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upvote" ADD CONSTRAINT "Upvote_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upvote" ADD CONSTRAINT "Upvote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
