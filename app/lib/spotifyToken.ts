import { prismaClient } from '@/app/lib/db';
import { logger } from '@/lib/logger';

export async function getValidSpotifyToken(userId: string): Promise<string | null> {
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: {
      spotifyConnected: true,
      spotifyAccessToken: true,
      spotifyRefreshToken: true,
      spotifyTokenExpiresAt: true,
    },
  });

  if (!user?.spotifyConnected || !user.spotifyAccessToken) return null;

  // If token is still valid (with 60s buffer), return it
  const expiresAt = user.spotifyTokenExpiresAt?.getTime() ?? 0;
  if (Date.now() < expiresAt - 60000) return user.spotifyAccessToken;

  // Refresh the token
  if (!user.spotifyRefreshToken) return null;

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.spotifyRefreshToken!,
      }),
    });

    const data = await res.json();
    if (!data.access_token) {
       
      logger.error({ error: data.error, description: data.error_description }, 'Spotify refresh failed');
      return null;
    }

    await prismaClient.user.update({
      where: { id: userId },
      data: {
        spotifyAccessToken: data.access_token,
        spotifyTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    });

    return data.access_token;
  } catch (err) {
     
    logger.error({ err }, 'Spotify token refresh error');
    return null;
  }
}
