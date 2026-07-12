import { NextRequest, NextResponse } from 'next/server';
import { prismaClient } from '@/app/lib/db';
import { logger } from '@/lib/logger';

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
      select: {
        username: true,
        displayName: true,
        isPublic: true,
        currentStream: {
          select: {
            title: true,
            genre: true,
            updatedAt: true,
            stream: {
              select: { title: true, type: true, url: true, smallImg: true, isLive: true },
            },
          },
        },
      },
    });

    if (!user || !user.isPublic) {
      return NextResponse.json({ message: 'Stream not found or private' }, { status: 404 });
    }

    if (!user.currentStream?.stream) {
      return NextResponse.json({ message: 'Nothing is currently playing' }, { status: 404 });
    }

    return NextResponse.json({
      username: user.username,
      displayName: user.displayName,
      title: user.currentStream.stream.title || user.currentStream.title,
      genre: user.currentStream.genre,
      type: user.currentStream.stream.type,
      url: user.currentStream.stream.url,
      thumbnail: user.currentStream.stream.smallImg,
    });
  } catch (e) {
    logger.error({ err: e }, 'Bot nowplaying API error');
    return NextResponse.json({ message: 'Failed to fetch now playing' }, { status: 500 });
  }
}
