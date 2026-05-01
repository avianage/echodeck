import { NextRequest, NextResponse } from 'next/server';
import { prismaClient } from '@/app/lib/db';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  if (!username) {
    return NextResponse.json({ message: 'Username is required' }, { status: 400 });
  }

  try {
    const user = await prismaClient.user.findUnique({
      where: { username: username.toLowerCase() },
      select: {
        id: true,
        username: true,
        displayName: true,
        image: true,
        platformRole: true,
        allowFriendRequests: true,
        partyCode: true,
        currentStream: {
          select: {
            updatedAt: true,
            streamId: true,
            title: true,
            genre: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Consistent live detection (15s heartbeat window)
    const isLive =
      user.currentStream && Date.now() - new Date(user.currentStream.updatedAt).getTime() < 15000;

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        image: user.image,
        platformRole: user.platformRole,
        allowFriendRequests: user.allowFriendRequests,
        partyCode: user.partyCode,
        isLive: !!isLive,
      },
    });
  } catch {
     
    logger.error('Error fetching public profile:');
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
