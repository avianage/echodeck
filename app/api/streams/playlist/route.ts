export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import YouTubeSearchApi from 'youtube-search-api';
import { z } from 'zod';
import { PLAYLIST_REGEX, SPOTIFY_PLAYLIST_REGEX } from '@/app/lib/utils';
import { getSpotifyApi, getUserSpotifyApi } from '@/app/lib/spotify';
import { getValidSpotifyToken } from '@/app/lib/spotifyToken';
import { authOptions } from '@/app/lib/auth';
import { isRateLimited } from '@/app/lib/rateLimit';
import type { SpotifyTrack } from '@/types/spotify';

import * as spotifyUrlInfoModule from 'spotify-url-info';
import { logger } from '@/lib/logger';

const spotifyUrlInfo = spotifyUrlInfoModule as unknown as (fetch: typeof globalThis.fetch) => {
  getTracks: (url: string, opts?: RequestInit) => Promise<SpotifyTrack[]>;
  getPreview: (url: string, opts?: RequestInit) => Promise<unknown>;
  getData: (url: string, opts?: RequestInit) => Promise<unknown>;
};
const { getTracks } = spotifyUrlInfo(fetch);

function formatDurationMs(durationMs: number | null | undefined) {
  if (!durationMs || durationMs <= 0) return '';
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function spotifyTrackUrlFromUri(uri: string | null | undefined) {
  if (!uri) return '';
  // Expected: spotify:track:<id>
  const parts = uri.split(':');
  if (parts.length >= 3 && parts[0] === 'spotify' && parts[1] === 'track') {
    return `https://open.spotify.com/track/${parts[2]}`;
  }
  return '';
}

async function getAllSpotifyPlaylistTracks(playlistId: string, sessionAccessToken?: string) {
  const _allTracks: SpotifyTrack[] = [];
  const _title = 'Spotify Playlist';

  // helper to fetch via an API instance
  const tryApi = async (api: {
    getPlaylist: (id: string) => Promise<unknown>;
    getPlaylistTracks: (id: string, opts?: { limit?: number; offset?: number }) => Promise<unknown>;
  }) => {
    const response = (await api.getPlaylist(playlistId)) as {
      body?: { name?: string } | null;
    } | null;
    const playlistTitle = response?.body?.name || 'Spotify Playlist';

    const tracksRes = (await api.getPlaylistTracks(playlistId)) as {
      body?: { items?: Array<{ track?: SpotifyTrack } | null> | null; total?: number } | null;
    } | null;
    const tracks = tracksRes?.body?.items ?? [];
    const total = tracksRes?.body?.total ?? tracks.length;

    const fetchedTracks = [...tracks];
    let offset = tracks.length;
    const limit = 100;

    while (fetchedTracks.length < total) {
      const page = (await api.getPlaylistTracks(playlistId, { limit, offset })) as {
        body?: { items?: Array<{ track?: SpotifyTrack } | null> | null; total?: number } | null;
      } | null;
      const pageItems = page?.body?.items ?? [];
      fetchedTracks.push(...pageItems);
      if (pageItems.length < limit) break;
      offset += limit;
    }
    return { title: playlistTitle, tracks: fetchedTracks };
  };

  // 1. Try User Access Token if available
  if (sessionAccessToken) {
    try {
       
      logger.info(`📡 Trying User Token for playlist: ${playlistId}`);
      const userApi = getUserSpotifyApi(sessionAccessToken);
      if (userApi) {
        const result = await tryApi(userApi);
         
        logger.info(`✅ Success via User Token!`);
        return { ...result, error: null };
      }
    } catch (err: unknown) {
       
      logger.warn(`⚠️ User Token failed (possibly expired): ${(err as Error).message}`);
    }
  }

  // 2. Try App Client Credentials
  try {
     
    logger.info(`📡 Trying Client Credentials for playlist: ${playlistId}`);
    const appApi = await getSpotifyApi();
    if (appApi) {
      const result = await tryApi(appApi);
       
      logger.info(`✅ Success via Client Credentials!`);
      return { ...result, error: null };
    }
  } catch (err: unknown) {
     
    logger.warn(`⚠️ Client Credentials failed: ${(err as Error).message}`);
  }

  // 3. Fallback to Scraping
  try {
     
    logger.info(`📡 Falling back to SCRAPE for playlist: ${playlistId}`);
    const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
    const scraped = await getTracks(playlistUrl);
     
    logger.info(`✅ SCRAPE Succeeded! Found ${scraped.length} tracks.`);

    const mappedTracks = scraped.map((t: SpotifyTrack) => ({
      track: {
        id: t.id,
        name: t.name,
        artists: t.artists ?? [{ name: 'Unknown Artist' }],
        duration_ms: t.duration_ms ?? 0,
        external_urls: {
          spotify:
            t.external_urls?.spotify || (t.id ? `https://open.spotify.com/track/${t.id}` : ''),
        },
        uri: t.uri || `spotify:track:${t.id}`,
        album: { images: t.album?.images ?? [] },
      },
    }));
    return { title: 'Scraped Playlist', tracks: mappedTracks, error: null };
  } catch (scrapeErr) {
     
    logger.error(
      { err: scrapeErr instanceof Error ? scrapeErr.message : scrapeErr },
      '❌ All Spotify fetch methods failed.',
    );
    return {
      title: null,
      tracks: [],
      error: 'Failed to fetch Spotify playlist from all available sources.',
    };
  }
}

async function fetchYouTubePlaylist(playlistId: string) {
  const res = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'SOCS=CAE=',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://www.youtube.com',
    },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: '2.20240101', hl: 'en', gl: 'US' } },
      browseId: `VL${playlistId}`,
    }),
  });

  if (!res.ok) throw new Error(`InnerTube browse failed: ${res.status}`);
  const data = await res.json() as Record<string, unknown>;

  // Extract title
  const header = (data?.header as Record<string, unknown>)?.pageHeaderRenderer as Record<string, unknown> | undefined;
  const title: string =
    (header?.pageTitle as string) ||
    ((header?.content as Record<string, unknown>)?.pageHeaderViewModel as Record<string, unknown>)?.title as string ||
    'YouTube Playlist';

  // Extract videos from itemSectionRenderer > lockupViewModel items
  const tabs = ((data?.contents as Record<string, unknown>)?.twoColumnBrowseResultsRenderer as Record<string, unknown>)?.tabs as Array<Record<string, unknown>> | undefined;
  const contents = (((tabs?.[0]?.tabRenderer as Record<string, unknown>)?.content as Record<string, unknown>)?.sectionListRenderer as Record<string, unknown>)?.contents as Array<Record<string, unknown>> | undefined;
  const items = ((contents?.[0]?.itemSectionRenderer as Record<string, unknown>)?.contents) as Array<Record<string, unknown>> | undefined;

  if (!items?.length) return null;

  const videos = items
    .map((item) => {
      const vm = item?.lockupViewModel as Record<string, unknown> | undefined;
      if (!vm) return null;
      const videoId = vm.contentId as string | undefined;
      if (!videoId) return null;
      const meta = ((vm.metadata as Record<string, unknown>)?.lockupMetadataViewModel as Record<string, unknown>);
      const videoTitle = (meta?.title as Record<string, unknown>)?.content as string || 'YouTube Video';
      const sources = (((vm.contentImage as Record<string, unknown>)?.thumbnailViewModel as Record<string, unknown>)?.image as Record<string, unknown>)?.sources as Array<{ url: string }> | undefined;
      const thumbnail = sources?.[0]?.url || '';
      return {
        id: videoId,
        title: videoTitle,
        thumbnail,
        duration: '',
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return { title, videos };
}

const PlaylistSchema = z.object({
  playlistId: z.string().optional(),
  url: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
  }

  const rateKey = `playlist:${session.user.email || session.user.id}`;
  if (isRateLimited(rateKey, 5, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { playlistId, url } = PlaylistSchema.parse(body);

    const activeUrl = url || '';
    let activePlaylistId = playlistId;

    // If URL is provided, try to extract playlist ID or treat as Spotify playlist URL
    if (activeUrl) {
      const ytMatch = activeUrl.match(PLAYLIST_REGEX);
      const spotMatch = activeUrl.match(SPOTIFY_PLAYLIST_REGEX);

      if (ytMatch) {
        activePlaylistId = ytMatch[1];
      } else if (spotMatch) {
        try {
          const playlistIdFromUrl = spotMatch[1];
          const spotifyToken = await getValidSpotifyToken(session.user.id);
          const {
            title: playlistTitle,
            tracks,
            error,
          } = await getAllSpotifyPlaylistTracks(playlistIdFromUrl, spotifyToken ?? undefined);

          if (error) {
            return NextResponse.json({ message: error }, { status: 500 });
          }

          if (!tracks.length) {
            return NextResponse.json(
              { message: 'Playlist empty or not accessible' },
              { status: 404 },
            );
          }

           
          logger.info({
            playlistId: playlistIdFromUrl,
            title: playlistTitle,
            trackCount: tracks.length,
          }, '✅ Spotify playlist tracks received');

          // Map Spotify playlist tracks to base items
          const baseVideos: Array<{
            id: string;
            title: string;
            thumbnail: string;
            duration: string;
            isSpotify: boolean;
            url: string;
            originalSpotifyUrl: string;
          }> = tracks
            .map((it) => {
              const track = it?.track;
              if (!track) return null;

              const id = track?.id;
              const name = track?.name;
              if (!name) return null;

              const artistNames = Array.isArray(track?.artists)
                ? track.artists
                    .map((a: { name?: string }) => a?.name)
                    .filter(Boolean)
                    .join(', ')
                : 'Unknown';

              const durationMs = typeof track?.duration_ms === 'number' ? track.duration_ms : 0;
              const duration = formatDurationMs(durationMs);
              const images = track?.album?.images || [];
              const thumbnail = images?.[0]?.url || '';

              const spotifyUrl =
                track?.external_urls?.spotify ||
                (id ? `https://open.spotify.com/track/${id}` : '') ||
                spotifyTrackUrlFromUri(track?.uri);

              const validSpotifyUrl =
                spotifyUrl && !spotifyUrl.includes('undefined') && !spotifyUrl.includes('null')
                  ? spotifyUrl
                  : '';

              return {
                id: id ?? '',
                title: `${name} by ${artistNames || 'Unknown'}`,
                thumbnail,
                duration,
                isSpotify: true as boolean,
                url: validSpotifyUrl,
                originalSpotifyUrl: validSpotifyUrl,
              };
            })
            .filter((v): v is NonNullable<typeof v> => {
              if (!v) return false;
              return v.url !== '' || v.id !== '';
            });

          // For each Spotify track, try to resolve a YouTube video
          const resolvedVideos = await Promise.all(
            baseVideos.map(async (video) => {
              try {
                const tryResolution = async (query: string) => {
                  try {
                    const res = await YouTubeSearchApi.GetListByKeyword(query, false, 5, [
                      { type: 'video' },
                    ]);
                    return res?.items || [];
                  } catch (err) {
                    return [];
                  }
                };

                 
                logger.info(`🔍 Resolving Spotify track from playlist: ${video.title}`);
                const items = await tryResolution(video.title);
                if (items.length === 0) return video;

                const ytId = items[0].id;
                if (!ytId) return video;

                return {
                  ...video,
                  id: ytId,
                  thumbnail: items[0].thumbnail?.thumbnails?.[0]?.url ?? video.thumbnail ?? '',
                  isSpotify: false,
                  url: `https://www.youtube.com/watch?v=${ytId}`,
                  source: 'spotify-web-api-node',
                };
              } catch (err) {
                 
                logger.error({ err: err }, `YouTube resolution failed for Spotify track: ${video.title}`);
                return video;
              }
            }),
          );

          return NextResponse.json({
            title: playlistTitle,
            videos: resolvedVideos,
          });
        } catch (spotifyErr: unknown) {
           
          logger.error(
            { err: (spotifyErr as Error)?.message || spotifyErr },
            'Spotify playlist load error:',
          );
          return NextResponse.json(
            { message: "Could not load Spotify playlist. Make sure it's public." },
            { status: 404 },
          );
        }
      }
    }

    if (!activePlaylistId) {
      return NextResponse.json({ message: 'Invalid playlist URL or ID' }, { status: 400 });
    }

    // Fetch YouTube playlist via InnerTube API (no API key required)
    const ytData = await fetchYouTubePlaylist(activePlaylistId);

    if (!ytData || !ytData.videos.length) {
      return NextResponse.json({ message: 'Playlist not found or empty' }, { status: 404 });
    }

    return NextResponse.json({
      title: ytData.title,
      videos: ytData.videos,
    });
  } catch (e) {
     
    logger.error({ err: e }, 'Playlist API Error:');
    return NextResponse.json({ message: 'Error fetching playlist' }, { status: 500 });
  }
}
