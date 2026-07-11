import { getServerSession } from 'next-auth';
import { prismaClient } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { broadcastToStream } from '@/app/lib/sseManager';

interface SessionUser {
  id?: string;
}

// The "swap" action for saved/swappable queues: replaces the creator's live
// queue with a saved playlist's tracks. Mirrors /api/streams/clear (same
// permission, same CurrentStream reset) plus a bulk-insert of the playlist's
// tracks as fresh Stream rows.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const role = await getStreamRole(userId, userId);
  if (!hasPermission(role, 'queue:clear')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const playlist = await prismaClient.playlist.findFirst({
    where: { id, userId },
    include: { tracks: { orderBy: { order: 'asc' } } },
  });

  if (!playlist) {
    return NextResponse.json({ message: 'Playlist not found' }, { status: 404 });
  }

  await prismaClient.$transaction([
    prismaClient.stream.deleteMany({ where: { userId, played: false } }),
    prismaClient.stream.createMany({
      data: playlist.tracks.map((t) => ({
        userId,
        addedById: userId,
        url: t.url,
        extractedId: t.extractedId,
        type: t.type,
        title: t.title,
        smallImg: t.smallImg,
        bigImg: t.bigImg,
      })),
    }),
    prismaClient.currentStream.updateMany({
      where: { userId },
      data: { streamId: null, currentTime: 0, isPaused: true, title: null, genre: null },
    }),
  ]);

  broadcastToStream(userId, { type: 'playlist_loaded', playlistId: playlist.id, name: playlist.name });

  return NextResponse.json({ message: 'Playlist loaded', trackCount: playlist.tracks.length });
}
