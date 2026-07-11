import { getServerSession } from 'next-auth';
import { prismaClient } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { broadcastToStream } from '@/app/lib/sseManager';

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Clear is typically for the streamer's own queue
  const role = await getStreamRole(userId, userId);

  if (!hasPermission(role, 'queue:clear')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  await prismaClient.stream.deleteMany({
    where: {
      userId: userId,
    },
  });

  // Clearing the queue also wipes whatever track CurrentStream points at
  // (the FK is ON DELETE SET NULL), which previously left stale
  // currentTime/title fields behind and gave listeners no signal that
  // playback died vs. just stalled. Reset it explicitly and notify.
  await prismaClient.currentStream.updateMany({
    where: { userId },
    data: { streamId: null, currentTime: 0, isPaused: true, title: null, genre: null },
  });
  broadcastToStream(userId, { type: 'queue_cleared' });

  return new Response(null, { status: 204 }); // was: 200, now: 204 (deletion)
}
