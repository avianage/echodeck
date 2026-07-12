export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth';
import { getServerSession } from 'next-auth';
import { isRateLimited } from '@/app/lib/rateLimit';
import { resolveAudioUrl, resolveVideoUrl } from '@/app/lib/ytdlp';

import { z } from 'zod';
import { logger } from '@/lib/logger';

const VideoIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{11}$/, 'Invalid videoId format');

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');
  // Defaults to audio for backward compat with the Discord bot's own
  // /api/bot/resolve caller, which should always stay audio-only.
  const format = searchParams.get('format') === 'video' ? 'video' : 'audio';

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  // Validate videoId format before it's used anywhere (rate-limit key, yt-dlp)
  try {
    VideoIdSchema.parse(videoId);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid videoId format' }, { status: 400 });
  }

  // Keyed per (user, videoId), not just per user: this is now called on
  // every track load and every video/disk mode toggle (not the occasional
  // ad-hoc resolve it was originally sized for), so a burst of activity on
  // one track shouldn't also block resolving a completely different track
  // the moment Skip/auto-advance happens.
  const limitKey = `resolve:${session.user.email}:${videoId}`;
  const resolveLimit = parseInt(process.env.RATE_LIMIT_RESOLVE || '60', 10);
  if (isRateLimited(limitKey, resolveLimit, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {

    logger.info(`📡 Resolving ${format} stream for: ${videoId} using yt-dlp`);
    const url = format === 'video' ? await resolveVideoUrl(videoId) : await resolveAudioUrl(videoId);
    return NextResponse.json({ url, format: format === 'video' ? 'best' : 'bestaudio' });
  } catch (e) {
     
    logger.error({ err: e }, '❌ Stream Resolution Error:');
    return NextResponse.json(
      {
        error: 'Failed to resolve stream',
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
