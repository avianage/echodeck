import { getServerSession } from 'next-auth';
import { prismaClient } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { broadcastEvent } from '@/app/lib/broadcastEvent';
import { broadcastToStream } from '@/app/lib/sseManager';

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

// There was previously no explicit "end stream" action: a creator going
// offline just let their `CurrentStream` row age out of the public listing
// after the 2-minute staleness window, while the row itself (and the frozen
// viewer count) lingered until some unrelated admin action cleaned it up.
// This gives creators (and OWNER) an explicit, immediate way to end a
// session: delete the CurrentStream row and notify any connected listeners.
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const role = await getStreamRole(userId, userId);
  if (!hasPermission(role, 'stream:end')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const current = await prismaClient.currentStream.findUnique({ where: { userId } });
  if (current?.streamId) {
    await prismaClient.stream.update({
      where: { id: current.streamId },
      data: { isLive: false, endedAt: new Date() },
    });
  }
  await prismaClient.currentStream.deleteMany({ where: { userId } });
  // Otherwise these linger and can inflate the next session's "active
  // viewer" count until each viewer's next heartbeat naturally overwrites it.
  await prismaClient.listeningActivity.deleteMany({ where: { creatorId: userId } });

  broadcastToStream(userId, { type: 'stream_ended' });
  await broadcastEvent(userId, 'STREAM_FORCE_CLOSED', 'Stream ended by creator');

  return new Response(null, { status: 204 });
}
