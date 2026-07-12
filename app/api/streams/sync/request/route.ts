export const dynamic = 'force-dynamic';
import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { broadcastToStream } from '@/app/lib/sseManager';
import { logger } from '@/lib/logger';

const RequestSyncSchema = z.object({
  creatorId: z.string(),
});

/**
 * POST /api/streams/sync/request
 * Called fire-and-forget by a listener on join.
 * Reads the current playback state from DB and pushes it to all SSE clients
 * so late-joiners converge on the correct position without waiting for the
 * next creator heartbeat.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
    }

    const body = await req.json();
    const { creatorId } = RequestSyncSchema.parse(body);

    const currentStream = await prismaClient.currentStream.findUnique({
      where: { userId: creatorId },
    });

    if (!currentStream) {
      return NextResponse.json({ message: 'No active stream' }, { status: 404 });
    }

    const serverNow = Date.now();
    const updatedAtTs = new Date(currentStream.updatedAt).getTime();
    const serverStaleness = (serverNow - updatedAtTs) / 1000;
    const computedTime = currentStream.isPaused
      ? currentStream.currentTime
      : currentStream.currentTime + serverStaleness;

    broadcastToStream(creatorId, {
      currentTime: currentStream.currentTime,
      computedTime,
      isPaused: currentStream.isPaused,
      updatedAt: currentStream.updatedAt.toISOString(),
      type: 'sync',
    });

    return NextResponse.json({ message: 'Sync broadcast sent' });
  } catch (e) {
    logger.error({ err: e }, '❌ Sync Request API Error:');
    return NextResponse.json(
      { message: 'Sync request failed: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
