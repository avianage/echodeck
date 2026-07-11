export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveAudioUrl } from '@/app/lib/ytdlp';
import { logger } from '@/lib/logger';

const VideoIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{11}$/, 'Invalid videoId format');

// Internal, service-to-service endpoint for the Discord bot's voice player
// (see /bot). Gated by a shared secret rather than a NextAuth session, since
// the bot has no user session — the resolved googlevideo URL is sensitive
// (a bandwidth-hotlinking vector) so this must not be reachable publicly.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-bot-secret');
  if (!secret || secret !== process.env.BOT_INTERNAL_SECRET) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const videoId = req.nextUrl.searchParams.get('videoId');
  if (!videoId) {
    return NextResponse.json({ message: 'videoId query param is required' }, { status: 400 });
  }

  const parsed = VideoIdSchema.safeParse(videoId);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid videoId format' }, { status: 400 });
  }

  try {
    const url = await resolveAudioUrl(videoId);
    return NextResponse.json({ url });
  } catch (e) {
    logger.error({ err: e }, 'Bot resolve API error');
    return NextResponse.json({ message: 'Failed to resolve audio URL' }, { status: 500 });
  }
}
