import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { broadcastToStream } from '@/app/lib/sseManager';
import { ACTIVE_VIEWER_WINDOW_MS } from '@/app/lib/presence';
import { logger } from '@/lib/logger';

type CurrentStreamWithStream = Prisma.CurrentStreamGetPayload<{ include: { stream: true } }>;

const HeartbeatSchema = z.object({
  creatorId: z.string(),
  currentTime: z.number().min(0).finite().optional(),
  isPaused: z.boolean().optional(),
});

/**
 * POST /api/streams/heartbeat
 * Used by streamers to push state and listeners to pull state.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
    }

    const userId = session.user?.id as string;

    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      select: { id: true, isBanned: true, bannedUntil: true, platformRole: true },
    });

    if (user?.isBanned) {
      const isPermanent = !user.bannedUntil;
      const isActive = user.bannedUntil ? new Date(user.bannedUntil) > new Date() : false;
      if (isPermanent || isActive) {
        return NextResponse.json({ message: 'Account is banned' }, { status: 403 });
      }
    }

    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

    const body = await req.json();
    const data = HeartbeatSchema.parse(body);

    // Fast path: the literal creator/owner pushing a state update never needs
    // a role or mode lookup — preserve the original single-query cost for
    // the hot creator-heartbeat path. Anything else (including the creator
    // falling through to listener logic when their player isn't ready yet)
    // takes the full fetch below so streamRole/creator stay correct.
    const isCreatorOrOwner = userId === data.creatorId || user?.platformRole === 'OWNER';
    const takeFastPath = isCreatorOrOwner && data.currentTime !== undefined;

    let currentStream: CurrentStreamWithStream | null = null;
    let listenerActivity: Awaited<ReturnType<typeof prismaClient.listeningActivity.findUnique>> =
      null;
    let creator: { isPublic: boolean } | null = null;
    let streamRole: Awaited<ReturnType<typeof getStreamRole>> = 'GUEST';
    let canPushState = isCreatorOrOwner;

    if (takeFastPath) {
      currentStream = await prismaClient.currentStream.findUnique({
        where: { userId: data.creatorId },
        include: { stream: true },
      });
    } else {
      [currentStream, listenerActivity, creator, streamRole] = await Promise.all([
        prismaClient.currentStream.findUnique({
          where: { userId: data.creatorId },
          include: { stream: true },
        }),
        prismaClient.listeningActivity.findUnique({
          where: { userId: user.id },
        }),
        prismaClient.user.findUnique({
          where: { id: data.creatorId },
          select: { isPublic: true },
        }),
        getStreamRole(user.id, data.creatorId),
      ]);

      const mode = (currentStream?.mode as 'BROADCAST' | 'JAM' | undefined) ?? 'BROADCAST';
      canPushState =
        isCreatorOrOwner || (mode === 'JAM' && hasPermission(streamRole, 'playback:play', mode));
    }

    // If it's the creator/owner, or a jam member with playback rights, push state
    if (canPushState && data.currentTime !== undefined) {
      // Always update updatedAt to prevent listener staleness during pause
      await prismaClient.currentStream.upsert({
        where: { userId: data.creatorId },
        update: {
          currentTime: data.currentTime,
          isPaused: data.isPaused ?? false,
          updatedAt: new Date(),
        },
        create: {
          userId: data.creatorId,
          currentTime: data.currentTime,
          isPaused: data.isPaused ?? false,
        },
      });

      // Push state immediately to all connected SSE viewers
      broadcastToStream(data.creatorId, {
        currentTime: data.currentTime,
        computedTime: data.currentTime,
        isPaused: data.isPaused ?? false,
        updatedAt: new Date().toISOString(),
        type: 'sync',
      });

      return NextResponse.json({ message: 'Heartbeat updated' });
    }

    // --- LISTENER / VIEWER LOGIC ---
    if (streamRole === 'BANNED') {
      return NextResponse.json({ message: 'Access restricted' }, { status: 403 });
    }

    if (streamRole === 'GUEST' && creator && !creator.isPublic) {
      // If private and guest (no access), block sync
      return NextResponse.json({ message: 'Access restricted' }, { status: 403 });
    }

    if (!currentStream) {
      return NextResponse.json({ message: 'No active stream' }, { status: 404 });
    }

    // 2. Fetch pending events since last heartbeat
    const timeoutMs = parseInt(process.env.HEARTBEAT_TIMEOUT_MS || '30000', 10);
    const lastSeen = listenerActivity?.updatedAt ?? new Date(Date.now() - timeoutMs);
    const pendingEvents = await prismaClient.streamEvent.findMany({
      where: {
        creatorId: data.creatorId,
        createdAt: { gt: lastSeen },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 3. Update activity and viewer count (if not OWNER)
    if (user?.platformRole !== 'OWNER') {
      const activeStream = currentStream?.stream;

      await Promise.all([
        prismaClient.listeningActivity.upsert({
          where: { userId: user.id },
          update: {
            creatorId: data.creatorId,
            songTitle: activeStream?.title ?? null,
            songId: activeStream?.extractedId ?? null,
            updatedAt: new Date(),
          },
          create: {
            userId: user.id,
            creatorId: data.creatorId,
            songTitle: activeStream?.title ?? null,
            songId: activeStream?.extractedId ?? null,
          },
        }),
        // Track every viewer who has ever watched this creator (not just mods/banned
        // users) so past viewers can be found and managed even after they go offline.
        prismaClient.sessionMember.upsert({
          where: { userId_creatorId: { userId: user.id, creatorId: data.creatorId } },
          update: { lastSeenAt: new Date() },
          create: { userId: user.id, creatorId: data.creatorId, lastSeenAt: new Date() },
        }),
      ]);

      const activeCount = await prismaClient.listeningActivity.count({
        where: {
          creatorId: data.creatorId,
          updatedAt: {
            gte: new Date(Date.now() - ACTIVE_VIEWER_WINDOW_MS),
          },
        },
      });

      // Only write viewerCount/peakViewerCount when the count actually
      // changed — otherwise every single listener heartbeat writes this row.
      const peakViewerCount = Math.max(activeCount, currentStream?.peakViewerCount ?? 0);
      if (
        activeCount !== currentStream?.viewerCount ||
        peakViewerCount !== currentStream?.peakViewerCount
      ) {
        await prismaClient.currentStream.update({
          where: { userId: data.creatorId },
          data: {
            viewerCount: activeCount,
            // peakViewerCount has no historical record otherwise — viewerCount
            // is overwritten every heartbeat with only the live value.
            peakViewerCount: { set: peakViewerCount },
          },
        });
      }
    }

    // 4. Return sync data and events
    const serverNow = Date.now();
    const updatedAtTs = new Date(currentStream.updatedAt).getTime();
    const serverStaleness = (serverNow - updatedAtTs) / 1000;
    const serverComputedTime = currentStream.isPaused
      ? currentStream.currentTime
      : currentStream.currentTime + serverStaleness;

    return NextResponse.json({
      currentTime: currentStream.currentTime,
      computedTime: serverComputedTime,
      isPaused: currentStream.isPaused,
      updatedAt: currentStream.updatedAt,
      viewerCount: currentStream.viewerCount,
      actualViewerCount: currentStream.viewerCount,
      stream: currentStream.stream,
      isPublic: creator?.isPublic ?? true,
      events: pendingEvents,
    });
  } catch (e) {
     
    logger.error({ err: e }, '❌ Heartbeat API Error:');
    return NextResponse.json({ message: 'Heartbeat failed' }, { status: 500 });
  }
}
