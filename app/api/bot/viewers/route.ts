import { NextRequest, NextResponse } from 'next/server';
import { prismaClient } from '@/app/lib/db';
import { ACTIVE_VIEWER_WINDOW_MS } from '@/app/lib/presence';
import { logger } from '@/lib/logger';

// Public, unauthenticated read endpoint for the Discord bot (see /bot).
// Returns only a count, not the viewer list — unlike /api/streams/viewers
// (session-authenticated, moderator-only), this must not leak who's watching.
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')?.toLowerCase();
  if (!username) {
    return NextResponse.json({ message: 'username query param is required' }, { status: 400 });
  }

  try {
    const user = await prismaClient.user.findUnique({
      where: { username },
      select: { id: true, username: true, isPublic: true },
    });

    if (!user || !user.isPublic) {
      return NextResponse.json({ message: 'Stream not found or private' }, { status: 404 });
    }

    const count = await prismaClient.listeningActivity.count({
      where: {
        creatorId: user.id,
        updatedAt: { gte: new Date(Date.now() - ACTIVE_VIEWER_WINDOW_MS) },
      },
    });

    return NextResponse.json({ username: user.username, viewerCount: count });
  } catch (e) {
    logger.error({ err: e }, 'Bot viewers API error');
    return NextResponse.json({ message: 'Failed to fetch viewer count' }, { status: 500 });
  }
}
