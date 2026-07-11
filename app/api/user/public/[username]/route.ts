import { NextRequest, NextResponse } from 'next/server';
import { prismaClient } from '@/app/lib/db';
import { logger } from '@/lib/logger';
import { isRecentlyActive } from '@/app/lib/presence';

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
        isPublic: true,
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

    // Previously this route ignored isPublic entirely, so the privacy
    // toggle in /api/user/privacy did nothing here — a private profile's
    // full details (live status, partyCode, etc.) were still served to
    // anyone. Return only the minimal public-facing fields when private.
    if (!user.isPublic) {
      return NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          image: user.image,
          isPublic: false,
        },
      });
    }

    const isLive = !!user.currentStream && isRecentlyActive(user.currentStream.updatedAt);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        image: user.image,
        platformRole: user.platformRole,
        allowFriendRequests: user.allowFriendRequests,
        partyCode: user.partyCode,
        isPublic: true,
        isLive: !!isLive,
      },
    });
  } catch {
     
    logger.error('Error fetching public profile:');
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
