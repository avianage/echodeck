export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { prismaClient } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { resolveMixedTrackLines } from '@/app/lib/playlistResolve';

interface SessionUser {
  id?: string;
}

const CreatePlaylistSchema = z.object({
  name: z.string().min(1).max(100),
  manualTracks: z.array(z.string()).max(100).optional(),
});

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const playlists = await prismaClient.playlist.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { tracks: true } } },
  });

  return NextResponse.json({ playlists });
}

// Saves the creator's current live queue (unplayed tracks) as a new named
// playlist. Distinct from /api/streams/playlist, which imports an external
// Spotify/YouTube playlist directly into the live queue rather than saving
// anything.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const parsed = CreatePlaylistSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
  }

  if (parsed.data.manualTracks?.length) {
    const resolved = await resolveMixedTrackLines(parsed.data.manualTracks);
    if (resolved.length === 0) {
      return NextResponse.json(
        { message: 'None of those tracks could be found' },
        { status: 400 },
      );
    }

    const playlist = await prismaClient.playlist.create({
      data: {
        userId,
        name: parsed.data.name,
        tracks: {
          create: resolved.map((t, index) => ({
            url: t.url,
            extractedId: t.extractedId,
            type: t.type,
            title: t.title,
            smallImg: t.thumbnail,
            bigImg: t.thumbnail,
            order: index,
          })),
        },
      },
      include: { _count: { select: { tracks: true } } },
    });

    return NextResponse.json({ playlist }, { status: 201 });
  }

  const queuedTracks = await prismaClient.stream.findMany({
    where: { userId, played: false },
    orderBy: { createdAt: 'asc' },
  });

  if (queuedTracks.length === 0) {
    return NextResponse.json({ message: 'Queue is empty — nothing to save' }, { status: 400 });
  }

  const playlist = await prismaClient.playlist.create({
    data: {
      userId,
      name: parsed.data.name,
      tracks: {
        create: queuedTracks.map((t, index) => ({
          url: t.url,
          extractedId: t.extractedId,
          type: t.type,
          title: t.title,
          smallImg: t.smallImg,
          bigImg: t.bigImg,
          order: index,
        })),
      },
    },
    include: { _count: { select: { tracks: true } } },
  });

  return NextResponse.json({ playlist }, { status: 201 });
}
