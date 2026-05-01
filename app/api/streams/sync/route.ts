export const dynamic = 'force-dynamic';
import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { broadcastToStream } from '@/app/lib/sseManager';
import { logger } from '@/lib/logger';

const SyncSchema = z.object({
  creatorId: z.string(),
  type: z.enum(['play', 'pause']),
  currentTime: z.number(),
});

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
       
      logger.warn('Sync API: Unauthenticated request');
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
    }

    const userId = (session.user as SessionUser).id;

    const body = await req.json();
    const data = SyncSchema.parse(body);

    const role = await getStreamRole(userId as string, data.creatorId);
    const permissionRequired = data.type === 'play' ? 'playback:play' : 'playback:pause';

    if (!hasPermission(role, permissionRequired)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    // Update the CurrentStream record as the source of truth for sync
    await prismaClient.currentStream.upsert({
      where: { userId: data.creatorId },
      update: {
        currentTime: data.currentTime,
        isPaused: data.type === 'pause',
        updatedAt: new Date(),
      },
      create: {
        userId: data.creatorId,
        currentTime: data.currentTime,
        isPaused: data.type === 'pause',
      },
    });

    // Push the state change immediately to all connected SSE viewers
    broadcastToStream(data.creatorId, {
      currentTime: data.currentTime,
      computedTime: data.currentTime, // no staleness — just written
      isPaused: data.type === 'pause',
      updatedAt: new Date().toISOString(),
      type: 'sync',
    });

    return NextResponse.json({ message: 'Sync successful' });
  } catch (e) {
     
    logger.error({ err: e }, '❌ Sync API Error:');
    return NextResponse.json(
      { message: 'Sync failed: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
