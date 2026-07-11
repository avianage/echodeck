import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { ACTIVE_VIEWER_WINDOW_MS } from '@/app/lib/presence';
import { logger } from '@/lib/logger';

const DEFAULT_TAKE = 25;

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

    const search = req.nextUrl.searchParams.get('search')?.trim();
    const role = req.nextUrl.searchParams.get('role');
    const cursor = req.nextUrl.searchParams.get('cursor') || undefined;
    const takeParam = parseInt(req.nextUrl.searchParams.get('take') || '', 10);
    const take = Number.isFinite(takeParam) && takeParam > 0 ? Math.min(takeParam, 100) : DEFAULT_TAKE;

    const where: Prisma.SessionMemberWhereInput = {
      creatorId,
      ...(role === 'MODERATOR' ? { role: 'MODERATOR' as const } : {}),
      ...(search
        ? {
            user: {
              OR: [
                { username: { contains: search, mode: 'insensitive' } },
                { displayName: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const currentStream = await prismaClient.currentStream.findUnique({
      where: { userId: creatorId },
      select: { mode: true, slowModeSeconds: true },
    });
    const sessionMode = currentStream?.mode === 'JAM' ? 'JAM' : 'BROADCAST';

    const members = await prismaClient.sessionMember.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        role: true,
        joinedAt: true,
        lastSeenAt: true,
        isBanned: true,
        bannedUntil: true,
        banReason: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            image: true,
            listeningActivity: {
              select: { creatorId: true, updatedAt: true },
            },
          },
        },
      },
    });

    const page = members.slice(0, take);
    const nextCursor = members.length > take ? members[take].id ?? null : null;

    const activeSince = Date.now() - ACTIVE_VIEWER_WINDOW_MS;
    const result = page.map((m) => {
      const activity = m.user.listeningActivity;
      const isLive =
        !!activity &&
        activity.creatorId === creatorId &&
        activity.updatedAt.getTime() >= activeSince;

      return {
        id: m.user.id,
        username: m.user.username,
        displayName: m.user.displayName,
        image: m.user.image,
        isModerator: m.role === 'MODERATOR',
        isBanned: m.isBanned,
        bannedUntil: m.bannedUntil,
        banReason: m.banReason,
        joinedAt: m.joinedAt,
        lastSeenAt: m.lastSeenAt,
        isLive,
        hasPlaybackRights: sessionMode === 'JAM' && m.role === 'MEMBER',
      };
    });

    return NextResponse.json({
      members: result,
      nextCursor,
      sessionMode,
      slowModeSeconds: currentStream?.slowModeSeconds ?? 0,
    });
  } catch (e) {

    logger.error({ err: e }, '❌ Members API Error:');
    return NextResponse.json({ message: 'Failed to fetch members' }, { status: 500 });
  }
}
