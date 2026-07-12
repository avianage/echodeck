import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { ACTIVE_VIEWER_WINDOW_MS } from '@/app/lib/presence';
import { logger } from '@/lib/logger';

const MAX_VIEWERS_RETURNED = 500;

/**
 * GET /api/streams/management-panel?creatorId=...
 *
 * Combines /viewers, /restricted, and /access into one round-trip so that the
 * StreamManagement panel only needs a single poll instead of three. Auth and
 * role check happen once; the three DB queries run in parallel.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
    }

    const userId = session.user.id as string;
    const creatorId = req.nextUrl.searchParams.get('creatorId');
    if (!creatorId) {
      return NextResponse.json({ message: 'Creator ID required' }, { status: 400 });
    }

    const streamRole = await getStreamRole(userId, creatorId);
    if (!['CREATOR', 'MODERATOR', 'OWNER'].includes(streamRole)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    // Restricted members — used both to filter the viewer list and to build the restricted list.
    // Fetching it once here avoids the duplicate query that previously existed across /viewers
    // and /restricted.
    const restrictedMembers = await prismaClient.sessionMember.findMany({
      where: {
        creatorId,
        OR: [{ isBanned: true }, { bannedUntil: { gt: new Date() } }],
      },
      select: {
        userId: true,
        user: { select: { id: true, username: true, displayName: true, image: true } },
        isBanned: true,
        banReason: true,
        bannedUntil: true,
        bannedAt: true,
      },
    });

    const [activeViewerRows, moderatorRows, pendingAccessRows] = await Promise.all([
      prismaClient.listeningActivity.findMany({
        where: {
          creatorId,
          updatedAt: { gte: new Date(Date.now() - ACTIVE_VIEWER_WINDOW_MS) },
        },
        orderBy: { updatedAt: 'desc' },
        take: MAX_VIEWERS_RETURNED,
        include: {
          user: { select: { id: true, username: true, displayName: true, image: true } },
        },
      }),
      prismaClient.sessionMember.findMany({
        where: { creatorId, role: 'MODERATOR' },
        select: { userId: true },
      }),
      prismaClient.streamAccess.findMany({
        where: { streamerId: creatorId, status: 'PENDING' },
        include: { viewer: { select: { id: true, username: true } } },
      }),
    ]);

    const restrictedSet = new Set(restrictedMembers.map((r) => r.userId));
    const modSet = new Set(moderatorRows.map((m) => m.userId));

    const viewers = activeViewerRows
      .filter((av) => !restrictedSet.has(av.user.id))
      .map((av) => ({
        id: av.user.id,
        username: av.user.username,
        displayName: av.user.displayName,
        image: av.user.image,
        lastSeen: av.updatedAt,
        isModerator: modSet.has(av.user.id),
      }));

    const restricted = restrictedMembers.map((m) => ({
      id: m.user.id,
      username: m.user.username,
      displayName: m.user.displayName,
      image: m.user.image,
      isBanned: m.isBanned,
      banReason: m.banReason,
      bannedUntil: m.bannedUntil,
      bannedAt: m.bannedAt,
    }));

    return NextResponse.json({ viewers, restricted, requests: pendingAccessRows });
  } catch (e) {
    logger.error({ err: e }, '❌ Management Panel API Error:');
    return NextResponse.json({ message: 'Failed to fetch management data' }, { status: 500 });
  }
}
