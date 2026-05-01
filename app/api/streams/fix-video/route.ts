import { NextRequest, NextResponse } from 'next/server';
import youtubesearchapi from 'youtube-search-api';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { isRateLimited } from '@/app/lib/rateLimit';
import type { YouTubeVideoDetails, YouTubeThumbnail } from '@/types/youtube-api';
import { logger } from '@/lib/logger';

const FixVideoApplySchema = z.object({
  streamId: z.string(),
  newId: z.string(),
  title: z.string().optional(),
});

/**
 * POST /api/streams/fix-video
 * Applies a fixed video to an existing Stream entry so that
 * all listeners see the non-restricted alternative.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
    }

    const rateKey = `fix-video:${session.user.email}`;
    if (isRateLimited(rateKey, 10, 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { streamId, newId, title } = FixVideoApplySchema.parse(await req.json());

    const user = await prismaClient.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }, // was: 403, now: 404 (not found)
      );
    }

    const existingStream = await prismaClient.stream.findUnique({
      where: { id: streamId },
    });

    if (!existingStream) {
      return NextResponse.json({ message: 'Stream not found' }, { status: 404 });
    }

    // Only the creator of the stream is allowed to apply a fix.
    if (existingStream.userId !== user.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    let smallImg = existingStream.smallImg;
    let bigImg = existingStream.bigImg;

    try {
      const details: YouTubeVideoDetails = await youtubesearchapi.GetVideoDetails(newId);
      const thumbnails = details?.thumbnail?.thumbnails || details?.thumbnails || [];

      if (thumbnails.length > 0) {
        const sorted = [...thumbnails].sort((a: YouTubeThumbnail, b: YouTubeThumbnail) =>
          (a?.width || 0) < (b?.width || 0) ? -1 : 1,
        );
        smallImg = sorted.length > 1 ? sorted[sorted.length - 2]?.url : sorted[0]?.url;
        bigImg = sorted[sorted.length - 1]?.url;
      }
    } catch (thumbErr) {
      logger.warn(
        { err: thumbErr },
        'Fix-video: Failed to fetch thumbnails for replacement video, using defaults.',
      );
      smallImg = `https://img.youtube.com/vi/${newId}/mqdefault.jpg`;
      bigImg = `https://img.youtube.com/vi/${newId}/maxresdefault.jpg`;
    }

    const updated = await prismaClient.stream.update({
      where: { id: streamId },
      data: {
        extractedId: newId,
        url: `https://www.youtube.com/watch?v=${newId}`,
        title: title ?? existingStream.title,
        smallImg,
        bigImg,
      },
    });

    // Notify all connected clients to refresh their queues/current video.

    return NextResponse.json({ stream: updated });
  } catch (err: unknown) {
    logger.error({ err: err }, 'Fix-video POST: Unexpected error:');
    return NextResponse.json(
      { message: 'Failed to apply fixed video', error: (err as Error)?.message ?? String(err) },
      { status: 500 },
    );
  }
}
