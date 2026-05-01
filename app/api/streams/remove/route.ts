import { NextRequest, NextResponse } from 'next/server';
import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { broadcastEvent } from '@/app/lib/broadcastEvent';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  try {
    const { streamId } = await req.json();

    if (!streamId) {
      return NextResponse.json({ message: 'Invalid stream ID' }, { status: 400 });
    }

    const stream = await prismaClient.stream.findUnique({
      where: { id: streamId },
    });

    if (!stream) {
      return NextResponse.json({ message: 'Stream not found' }, { status: 404 });
    }

    const role = await getStreamRole(userId, stream.userId);
    const canRemoveAny = hasPermission(role, 'queue:remove:any');
    const canRemoveOwn = hasPermission(role, 'queue:remove:own') && stream.addedById === userId;

    if (!canRemoveAny && !canRemoveOwn) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    await prismaClient.stream.delete({
      where: { id: streamId },
    });

    if (role === 'MODERATOR') {
      await broadcastEvent(
        stream.userId,
        'SONG_REMOVED_BY_MOD',
        'A song was removed by a moderator',
      );
    }

    return new Response(null, { status: 204 }); // was: 200, now: 204 (deletion)
  } catch {
    return NextResponse.json({ message: 'Error removing stream' }, { status: 500 });
  }
}
