export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth';
import { getServerSession } from 'next-auth';
import { isRateLimited } from '@/app/lib/rateLimit';
import { resolveAudioUrl } from '@/app/lib/ytdlp';

import { z } from 'zod';
import { logger } from '@/lib/logger';

const VideoIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{11}$/, 'Invalid videoId format');

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
  }

  const limitKey = `resolve:${session.user.email}`;
  const resolveLimit = parseInt(process.env.RATE_LIMIT_RESOLVE || '10', 10);
  if (isRateLimited(limitKey, resolveLimit, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
  }

  // Validate videoId format before passing to yt-dlp
  try {
    VideoIdSchema.parse(videoId);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid videoId format' }, { status: 400 });
  }

  try {

    logger.info(`📡 Resolving stream for: ${videoId} using yt-dlp`);
    const url = await resolveAudioUrl(videoId);
    return NextResponse.json({ url, format: 'bestaudio' });
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
