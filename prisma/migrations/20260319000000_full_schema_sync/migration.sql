-- ─── Enums ───────────────────────────────────────────────────────────────────

-- CreateEnum (PlatformRole)
DO $$ BEGIN
    CREATE TYPE "PlatformRole" AS ENUM ('OWNER', 'MEMBER', 'CREATOR');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum (StreamRole)
DO $$ BEGIN
    CREATE TYPE "StreamRole" AS ENUM ('MODERATOR', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum (FriendStatus)
DO $$ BEGIN
    CREATE TYPE "FriendStatus" AS ENUM ('PENDING', 'ACCEPTED', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum (StreamEventType)
DO $$ BEGIN
    CREATE TYPE "StreamEventType" AS ENUM (
        'USER_BANNED_PLATFORM',
        'USER_BANNED_STREAM',
        'USER_TIMED_OUT_PLATFORM',
        'USER_TIMED_OUT_STREAM',
        'CREATOR_ROLE_REVOKED',
        'STREAM_FORCE_CLOSED',
        'MOD_PROMOTED',
        'MOD_DEMOTED',
        'SONG_REMOVED_BY_MOD',
        'SONG_SKIPPED_BY_CREATOR'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── User: Add missing columns ────────────────────────────────────────────────

ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "partyCode"             TEXT,
    ADD COLUMN IF NOT EXISTS "name"                  TEXT,
    ADD COLUMN IF NOT EXISTS "emailVerified"          TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "username"               TEXT,
    ADD COLUMN IF NOT EXISTS "displayName"            TEXT,
    ADD COLUMN IF NOT EXISTS "image"                  TEXT,
    ADD COLUMN IF NOT EXISTS "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "usernameUpdatedAt"      TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "platformRole"           "PlatformRole" NOT NULL DEFAULT 'MEMBER',
    ADD COLUMN IF NOT EXISTS "allowFriendRequests"    BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "isBanned"               BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "banReason"              TEXT,
    ADD COLUMN IF NOT EXISTS "bannedUntil"            TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "spotifyConnected"       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "spotifyAccessToken"     TEXT,
    ADD COLUMN IF NOT EXISTS "spotifyRefreshToken"    TEXT,
    ADD COLUMN IF NOT EXISTS "spotifyTokenExpiresAt"  TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "deletedAt"              TIMESTAMP(3);

-- Make email nullable (it was NOT NULL in init)
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
-- Make provider nullable (was originally NOT NULL)
ALTER TABLE "User" ALTER COLUMN "provider" DROP NOT NULL;

-- Backfill partyCode for existing users that don't have one yet
UPDATE "User" SET "partyCode" = gen_random_uuid()::TEXT WHERE "partyCode" IS NULL;

-- Unique indexes for new columns (safe: skip if already exists)
CREATE UNIQUE INDEX IF NOT EXISTS "User_partyCode_key" ON "User"("partyCode");
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- ─── Stream: Add missing columns ─────────────────────────────────────────────

ALTER TABLE "Stream"
    ADD COLUMN IF NOT EXISTS "isPublic"    BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "isLive"      BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "startedAt"   TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "endedAt"     TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "viewerCount" INTEGER NOT NULL DEFAULT 0;

-- ─── CurrentStream: Add missing columns ──────────────────────────────────────

ALTER TABLE "CurrentStream"
    ADD COLUMN IF NOT EXISTS "title"       TEXT,
    ADD COLUMN IF NOT EXISTS "genre"       TEXT,
    ADD COLUMN IF NOT EXISTS "viewerCount" INTEGER NOT NULL DEFAULT 0;

-- ─── NextAuth tables ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Account" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "type"              TEXT NOT NULL,
    "provider"          TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token"     TEXT,
    "access_token"      TEXT,
    "expires_at"        INTEGER,
    "token_type"        TEXT,
    "scope"             TEXT,
    "id_token"          TEXT,
    "session_state"     TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Session" (
    "id"           TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "expires"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "expires"    TIMESTAMP(3) NOT NULL
);

-- Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- Foreign Keys (add only if not already present)
DO $$ BEGIN
    ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── CurrentStream: add FK to User ───────────────────────────────────────────

DO $$ BEGIN
    ALTER TABLE "CurrentStream" ADD CONSTRAINT "CurrentStream_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── SessionMember ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "SessionMember" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "creatorId"   TEXT NOT NULL,
    "role"        "StreamRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isBanned"    BOOLEAN NOT NULL DEFAULT false,
    "banReason"   TEXT,
    "bannedUntil" TIMESTAMP(3),

    CONSTRAINT "SessionMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SessionMember_userId_creatorId_key" ON "SessionMember"("userId", "creatorId");

DO $$ BEGIN
    ALTER TABLE "SessionMember" ADD CONSTRAINT "SessionMember_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── Friendship ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Friendship" (
    "id"          TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status"      "FriendStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

DO $$ BEGIN
    ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey"
        FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey"
        FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── ListeningActivity ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ListeningActivity" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "songTitle" TEXT,
    "songId"    TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ListeningActivity_userId_key" ON "ListeningActivity"("userId");

DO $$ BEGIN
    ALTER TABLE "ListeningActivity" ADD CONSTRAINT "ListeningActivity_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── StreamEvent ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "StreamEvent" (
    "id"        TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "type"      "StreamEventType" NOT NULL,
    "message"   TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamEvent_pkey" PRIMARY KEY ("id")
);
