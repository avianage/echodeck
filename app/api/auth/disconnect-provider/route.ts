export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { isRateLimited } from '@/app/lib/rateLimit';
import { logger } from '@/lib/logger';

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id;

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const rateKey = `disconnect-provider:${userId}`;
  if (isRateLimited(rateKey, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { provider } = await req.json();

    if (provider === 'google') {
      // Delete the NextAuth Account record for Google
      await prismaClient.account.deleteMany({
        where: {
          userId,
          provider: 'google',
        },
      });
      return new Response(null, { status: 204 }); // was: 200, now: 204 (deletion)
    }

    if (provider === 'spotify') {
      // Delete the NextAuth Account record for Spotify
      await prismaClient.account.deleteMany({
        where: {
          userId,
          provider: 'spotify',
        },
      });
      // Clear Spotify fields on the User record
      await prismaClient.user.update({
        where: { id: userId },
        data: {
          spotifyConnected: false,
          spotifyAccessToken: null,
          spotifyRefreshToken: null,
          spotifyTokenExpiresAt: null,
        },
      });
      return new Response(null, { status: 204 }); // was: 200, now: 204 (deletion)
    }

    return NextResponse.json({ message: 'Invalid provider' }, { status: 400 });
  } catch (error) {
    logger.error({ err: error }, 'Error disconnecting provider');
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
