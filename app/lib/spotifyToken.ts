import { prismaClient } from '@/app/lib/db';
import { logger } from '@/lib/logger';
import { encryptToken, decryptToken } from '@/app/lib/tokenCrypto';

// Concurrent requests needing a fresh token for the same user must await one
// shared refresh instead of each calling Spotify's refresh endpoint — Spotify
// rotates refresh tokens, so two parallel refreshes can each invalidate the
// other's rotated token and leave the connection broken.
const inFlightRefreshes = new Map<string, Promise<string | null>>();

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

  const accessToken = decryptToken(user.spotifyAccessToken);
  const refreshToken = decryptToken(user.spotifyRefreshToken);
  if (!accessToken) return null;

  // If token is still valid (with 60s buffer), return it
  const expiresAt = user.spotifyTokenExpiresAt?.getTime() ?? 0;
  if (Date.now() < expiresAt - 60000) return accessToken;

  // Refresh the token
  if (!refreshToken) return null;

  const existing = inFlightRefreshes.get(userId);
  if (existing) return existing;

  const refreshPromise = refreshSpotifyToken(userId, refreshToken).finally(() => {
    inFlightRefreshes.delete(userId);
  });
  inFlightRefreshes.set(userId, refreshPromise);
  return refreshPromise;
}

async function refreshSpotifyToken(userId: string, refreshToken: string): Promise<string | null> {
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
        refresh_token: refreshToken,
      }),
    });

    const data = await res.json();
    if (!data.access_token) {

      logger.error({ error: data.error, description: data.error_description }, 'Spotify refresh failed');

      if (data.error === 'invalid_grant') {
        await prismaClient.user.update({
          where: { id: userId },
          data: {
            spotifyConnected: false,
            spotifyAccessToken: null,
            spotifyRefreshToken: null,
            spotifyTokenExpiresAt: null,
          },
        });
      }

      return null;
    }

    await prismaClient.user.update({
      where: { id: userId },
      data: {
        spotifyAccessToken: encryptToken(data.access_token),
        // Spotify may rotate the refresh token on refresh; persist it when
        // it does, otherwise the previously stored one keeps working.
        ...(data.refresh_token ? { spotifyRefreshToken: encryptToken(data.refresh_token) } : {}),
        spotifyTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      },
    });

    return data.access_token;
  } catch (err) {

    logger.error({ err }, 'Spotify token refresh error');
    return null;
  }
}
