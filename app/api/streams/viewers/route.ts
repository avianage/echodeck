import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
    }

    const userId = session.user.id;
    const creatorId = req.nextUrl.searchParams.get('creatorId');
    if (!creatorId) {
      return NextResponse.json({ message: 'Creator ID required' }, { status: 400 });
    }

    const streamRole = await getStreamRole(userId, creatorId);
    const canView = ['CREATOR', 'MODERATOR', 'OWNER'].includes(streamRole);

    if (!canView) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    // Fetch restricted users for this stream to filter them out
    const restricted = await prismaClient.sessionMember.findMany({
      where: {
        creatorId,
        OR: [{ isBanned: true }, { bannedUntil: { gt: new Date() } }],
      },
      select: { userId: true },
    });
    const restrictedSet = new Set(restricted.map((r) => r.userId));

    // Fetch users who updated their heartbeat in the last 20 seconds
    const activeViewers = await prismaClient.listeningActivity.findMany({
      where: {
        creatorId,
        updatedAt: { gte: new Date(Date.now() - 20000) },
        userId: { notIn: Array.from(restrictedSet) },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            image: true,
          },
        },
      },
    });

    // Fetch all moderators for this creator's stream
    const moderators = await prismaClient.sessionMember.findMany({
      where: { creatorId, role: 'MODERATOR' },
      select: { userId: true },
    });
    const modSet = new Set(moderators.map((m) => m.userId));

    const viewers = activeViewers.map((av) => ({
      id: av.user.id,
      username: av.user.username,
      displayName: av.user.displayName,
      image: av.user.image,
      lastSeen: av.updatedAt,
      isModerator: modSet.has(av.user.id),
    }));

    return NextResponse.json({ viewers });
  } catch (e) {
     
    logger.error({ err: e }, '❌ Viewers API Error:');
    return NextResponse.json({ message: 'Failed to fetch viewers' }, { status: 500 });
  }
}
