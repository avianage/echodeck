import SpotifyWebApi from 'spotify-web-api-node';
import { logger } from '@/lib/logger';

interface SpotifyApiSingleton {
  api: SpotifyWebApi | null;
  expiresAt: number | null;
}

const spotifyConfig: SpotifyApiSingleton = {
  api: null,
  expiresAt: null,
};

export async function getSpotifyApi(): Promise<SpotifyWebApi | null> {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
     
    logger.warn('Spotify credentials are not set.');
    return null;
  }

  if (!spotifyConfig.api) {
    spotifyConfig.api = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    });
  }

  const now = Date.now();
  // If we have an expiration time and it's less than 5 minutes away, or if we don't have one, refresh the token
  if (!spotifyConfig.expiresAt || spotifyConfig.expiresAt - now < 5 * 60 * 1000) {
    try {
      const data = await spotifyConfig.api.clientCredentialsGrant();
      spotifyConfig.api.setAccessToken(data.body['access_token']);
      spotifyConfig.expiresAt = now + data.body['expires_in'] * 1000;
       
      logger.info('Spotify access token refreshed.');
    } catch (error) {
       
      logger.error({ err: error }, 'Error refreshing Spotify access token:');
      return null;
    }
  }

  return spotifyConfig.api;
}

export function getUserSpotifyApi(accessToken: string): SpotifyWebApi | null {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return null;
  }

  const api = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  });
  api.setAccessToken(accessToken);

  return api;
}
