export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { logger } from '@/lib/logger';
import { encryptToken } from '@/app/lib/tokenCrypto';
import { verifyOAuthState } from '@/app/lib/oauthState';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');

  const verifiedState = state ? verifyOAuthState(state) : null;

  if (!code || !verifiedState) {
    return NextResponse.redirect(
      new URL(
        '/account?error=spotify_link_failed',
        process.env.NEXTAUTH_URL || 'https://echodeck.avianage.in',
      ),
    );
  }

  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;

  if (!sessionUserId || sessionUserId !== verifiedState.userId) {
    return NextResponse.redirect(
      new URL(
        '/account?error=spotify_link_failed',
        process.env.NEXTAUTH_URL || 'https://echodeck.avianage.in',
      ),
    );
  }

  const userId = sessionUserId;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/spotify-callback`,
      }),
    });

    const tokens = await tokenRes.json();

    if (tokens.error) {
       
      logger.error({ error: tokens.error, description: tokens.error_description }, 'Spotify token error');
      throw new Error(tokens.error_description || tokens.error);
    }

    await prismaClient.user.update({
      where: { id: userId },
      data: {
        spotifyConnected: true,
        spotifyAccessToken: encryptToken(tokens.access_token),
        spotifyRefreshToken: encryptToken(tokens.refresh_token),
        spotifyTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return NextResponse.redirect(
      new URL(
        '/account?spotify=connected',
        process.env.NEXTAUTH_URL || 'https://echodeck.avianage.in',
      ),
    );
  } catch (err) {
     
    logger.error({ err: err }, 'Spotify callback error:');
    return NextResponse.redirect(
      new URL(
        '/account?error=spotify_link_failed',
        process.env.NEXTAUTH_URL || 'https://echodeck.avianage.in',
      ),
    );
  }
}
