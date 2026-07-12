import YouTubeSearchApi from 'youtube-search-api';
import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { z } from 'zod';

interface SessionUser {
  id?: string;
}

const BodySchema = z.object({
  excludeIds: z.array(z.string()).max(20).optional(),
});

// A song's official upload may have embedding disabled by its owner (YouTube
// error 101/150), but that only rules out that one specific video — other
// uploads of the same title (lyric videos, audio uploads, alternate channels)
// are usually embeddable. This searches for one of those alternates instead
// of giving up on the song entirely, and updates the existing Stream row in
// place so the track's queue position/id is preserved.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { streamId } = await params;
  const stream = await prismaClient.stream.findUnique({ where: { id: streamId } });
  if (!stream) {
    return NextResponse.json({ message: 'Stream not found' }, { status: 404 });
  }

  const [role, currentStream] = await Promise.all([
    getStreamRole(userId, stream.userId),
    prismaClient.currentStream.findUnique({
      where: { userId: stream.userId },
      select: { mode: true },
    }),
  ]);
  const mode = (currentStream?.mode as 'BROADCAST' | 'JAM' | undefined) ?? 'BROADCAST';

  if (!hasPermission(role, 'playback:skip', mode)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const { excludeIds = [] } = BodySchema.parse(await req.json().catch(() => ({})));
  const excludeSet = new Set([...excludeIds, stream.extractedId]);

  const blocked = await prismaClient.blockedVideo.findMany({ select: { videoId: true } });
  const blockedSet = new Set(blocked.map((b) => b.videoId));

  let results;
  try {
    results = await YouTubeSearchApi.GetListByKeyword(stream.title, false, 8, [{ type: 'video' }]);
  } catch {
    return NextResponse.json({ message: 'Search failed' }, { status: 502 });
  }

  const candidate = (results?.items || []).find(
    (item: { id?: string }) => item?.id && !excludeSet.has(item.id) && !blockedSet.has(item.id),
  );

  if (!candidate) {
    return NextResponse.json({ message: 'No alternate video found' }, { status: 404 });
  }

  const thumbnails = candidate.thumbnail?.thumbnails || candidate.thumbnails || [];
  const smallImg = thumbnails[0]?.url || stream.smallImg;
  const bigImg = thumbnails[thumbnails.length - 1]?.url || stream.bigImg;

  const updated = await prismaClient.stream.update({
    where: { id: stream.id },
    data: {
      extractedId: candidate.id,
      url: `https://www.youtube.com/watch?v=${candidate.id}`,
      smallImg,
      bigImg,
    },
  });

  return NextResponse.json({ stream: updated });
}
