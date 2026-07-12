export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { PLAYLIST_REGEX, SPOTIFY_PLAYLIST_REGEX } from '@/app/lib/utils';
import { getValidSpotifyToken } from '@/app/lib/spotifyToken';
import { authOptions } from '@/app/lib/auth';
import { isRateLimited } from '@/app/lib/rateLimit';
import {
  fetchYouTubePlaylist,
  getAllSpotifyPlaylistTracks,
  resolveYouTubeMatch,
  mapWithConcurrency,
  resolveMixedTrackLines,
} from '@/app/lib/playlistResolve';
import { logger } from '@/lib/logger';

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

const PlaylistSchema = z.object({
  playlistId: z.string().optional(),
  url: z.string().optional(),
  manualTracks: z.array(z.string()).max(100).optional(),
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
    const { playlistId, url, manualTracks } = PlaylistSchema.parse(body);

    if (manualTracks?.length) {
      const resolved = await resolveMixedTrackLines(manualTracks);
      if (!resolved.length) {
        return NextResponse.json(
          { message: 'None of those tracks could be found on YouTube' },
          { status: 404 },
        );
      }
      // Keep the response shape the frontend already expects (PlaylistModal /
      // handleAddAllFromPlaylist read `video.id`, not `video.extractedId`).
      const videos = resolved.map((t) => ({
        id: t.extractedId,
        title: t.title,
        thumbnail: t.thumbnail,
        duration: '',
        url: t.url,
      }));
      return NextResponse.json({ title: 'Pasted Playlist', videos });
    }

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

          // For each Spotify track, try to resolve a YouTube video. Capped
          // concurrency + a shared cache keep large playlist imports from
          // firing hundreds of simultaneous external search requests.
          const resolvedVideos = await mapWithConcurrency(baseVideos, 5, async (video) => {
            try {
              const match = await resolveYouTubeMatch(video.title);
              if (!match.id) return video;

              return {
                ...video,
                id: match.id,
                thumbnail: match.thumbnail || video.thumbnail || '',
                isSpotify: false,
                url: `https://www.youtube.com/watch?v=${match.id}`,
                source: 'spotify-web-api-node',
              };
            } catch (err) {
              logger.error({ err }, `YouTube resolution failed for Spotify track: ${video.title}`);
              return video;
            }
          });

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
