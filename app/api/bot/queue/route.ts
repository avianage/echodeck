import { NextRequest, NextResponse } from 'next/server';
import { prismaClient } from '@/app/lib/db';
import { logger } from '@/lib/logger';

const MAX_QUEUE_RETURNED = 10;

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-bot-secret');
  if (!secret || secret !== process.env.BOT_INTERNAL_SECRET) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

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

    const queue = await prismaClient.stream.findMany({
      where: { userId: user.id, played: false },
      orderBy: [{ upvotes: { _count: 'desc' } }, { createdAt: 'asc' }],
      take: MAX_QUEUE_RETURNED,
      select: {
        title: true,
        type: true,
        url: true,
        smallImg: true,
        _count: { select: { upvotes: true } },
      },
    });

    return NextResponse.json({
      username: user.username,
      queue: queue.map((s) => ({
        title: s.title,
        type: s.type,
        url: s.url,
        thumbnail: s.smallImg,
        upvotes: s._count.upvotes,
      })),
    });
  } catch (e) {
    logger.error({ err: e }, 'Bot queue API error');
    return NextResponse.json({ message: 'Failed to fetch queue' }, { status: 500 });
  }
}
