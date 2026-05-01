export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { create as createYtDlp } from 'yt-dlp-exec';
import { authOptions } from '@/app/lib/auth';
import { getServerSession } from 'next-auth';
import { isRateLimited } from '@/app/lib/rateLimit';

interface CacheEntry {
  url: string;
  format: string;
  expiresAt: number;
}

const streamCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_HOURS || '4', 10) * 60 * 60 * 1000;

function getCached(videoId: string): CacheEntry | null {
  const entry = streamCache.get(videoId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    streamCache.delete(videoId);
    return null;
  }
  return entry;
}

function _setCache(videoId: string, url: string, format: string): void {
  streamCache.set(videoId, {
    url,
    format,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// Use the system yt-dlp binary (installed via apk in Docker or present in PATH locally)
// If yt-dlp-exec is passed undefined, it defaults to searching for 'yt-dlp' in PATH
const _ytDlp = createYtDlp(process.env.NODE_ENV === 'production' ? 'yt-dlp' : undefined);

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

  const cached = getCached(videoId);
  if (cached) {
     
    logger.info(`✅ Cache hit for ${videoId}`);
    return NextResponse.json({ url: cached.url, format: cached.format });
  }

  try {
     
    logger.info(`📡 Resolving stream for: ${videoId} using yt-dlp`);
    // Note: The actual resolution logic would go here,
    // using ytDlp instance which is now correctly configured.
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
