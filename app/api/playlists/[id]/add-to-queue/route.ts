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

const MAX_QUEUE_LENGTH = parseInt(process.env.MAX_QUEUE_LENGTH || '200', 10);

// Non-destructive counterpart to .../load: appends a saved playlist's tracks
// onto the existing live queue instead of replacing it. Gated by queue:add
// (granted to MEMBER/MODERATOR/CREATOR/OWNER) rather than load's queue:clear,
// since this doesn't touch anything already queued — same permission model
// as every other add-to-queue action in this app.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const creatorId = req.nextUrl.searchParams.get('creatorId') || userId;

  const role = await getStreamRole(userId, creatorId);
  if (!hasPermission(role, 'queue:add')) {
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

  const existingActiveCount = await prismaClient.stream.count({
    where: { userId: creatorId, played: false },
  });

  if (existingActiveCount + playlist.tracks.length > MAX_QUEUE_LENGTH) {
    return NextResponse.json(
      { message: 'Adding this playlist would exceed the queue limit' },
      { status: 400 },
    );
  }

  await prismaClient.stream.createMany({
    data: playlist.tracks.map((t) => ({
      userId: creatorId,
      addedById: userId,
      url: t.url,
      extractedId: t.extractedId,
      type: t.type,
      title: t.title,
      smallImg: t.smallImg,
      bigImg: t.bigImg,
    })),
  });

  broadcastToStream(creatorId, { type: 'queue_updated' });

  return NextResponse.json({ message: 'Playlist added to queue', trackCount: playlist.tracks.length });
}
