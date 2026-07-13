import { NextRequest, NextResponse } from 'next/server';
import { prismaClient } from '@/app/lib/db';
import {
  fetchYouTubePlaylist,
  getAllSpotifyPlaylistTracks,
  resolveYouTubeMatch,
  mapWithConcurrency,
} from '@/app/lib/playlistResolve';
import { PLAYLIST_REGEX, SPOTIFY_PLAYLIST_REGEX } from '@/app/lib/utils';
import { logger } from '@/lib/logger';

const MAX_QUEUE_LENGTH = parseInt(process.env.MAX_QUEUE_LENGTH || '200', 10);

function botSecretGuard(req: NextRequest): NextResponse | null {
  const secret = req.headers.get('x-bot-secret');
  if (!secret || secret !== process.env.BOT_INTERNAL_SECRET) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }
  return null;
}

// POST /api/bot/playlists
// Body: { url: string } — YouTube playlist URL or Spotify playlist URL.
// Resolves all tracks and bulk-inserts them into the bot user's queue.
// Returns { tracks: [{id, title, thumbnail, url, extractedId}], botUsername }.
export async function POST(req: NextRequest) {
  const authError = botSecretGuard(req);
  if (authError) return authError;

  const botUserId = process.env.BOT_SERVICE_USER_ID;
  if (!botUserId) {
    return NextResponse.json(
      { message: 'BOT_SERVICE_USER_ID not configured. Run prisma/seed-bot-user.ts first.' },
      { status: 500 },
    );
  }

  const botUser = await prismaClient.user.findUnique({
    where: { id: botUserId },
    select: { id: true, username: true },
  });
  if (!botUser) {
    return NextResponse.json({ message: 'Bot service user not found.' }, { status: 500 });
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const url = (body.url ?? '').trim();
  if (!url) {
    return NextResponse.json({ message: 'url is required' }, { status: 400 });
  }

  // How many slots remain before we hit the queue cap?
  const existing = await prismaClient.stream.count({
    where: { userId: botUser.id, played: false },
  });
  const slotsLeft = MAX_QUEUE_LENGTH - existing;
  if (slotsLeft <= 0) {
    return NextResponse.json(
      { message: `Queue is full (${MAX_QUEUE_LENGTH} songs max).` },
      { status: 400 },
    );
  }

  type ResolvedTrack = { id: string; title: string; thumbnail: string; url: string; extractedId: string };
  let resolved: ResolvedTrack[] = [];
  let totalFound = 0;

  const spotifyMatch = SPOTIFY_PLAYLIST_REGEX.exec(url);
  const ytMatch = PLAYLIST_REGEX.exec(url);

  if (spotifyMatch) {
    // Spotify playlist — resolve each track to its best YouTube match.
    const playlistId = spotifyMatch[1];
    const result = await getAllSpotifyPlaylistTracks(playlistId);
    if (result.error || !result.tracks.length) {
      return NextResponse.json(
        { message: result.error || 'Spotify playlist returned no tracks.' },
        { status: 404 },
      );
    }

    totalFound = result.tracks.length;
    const tracks = result.tracks.slice(0, slotsLeft);
    const matches = await mapWithConcurrency(tracks, 5, async (item) => {
      const track = (item as { track?: { name: string; artists?: { name: string }[] } } | null)?.track;
      if (!track?.name) return null;
      const query = `${track.name} ${track.artists?.[0]?.name ?? ''}`.trim();
      const match = await resolveYouTubeMatch(query);
      if (!match.id) return null;
      return {
        id: match.id,
        title: `${track.name}${track.artists?.[0]?.name ? ` — ${track.artists[0].name}` : ''}`,
        thumbnail: match.thumbnail,
        url: `https://www.youtube.com/watch?v=${match.id}`,
        extractedId: match.id,
      } as ResolvedTrack;
    });
    resolved = matches.filter((t): t is ResolvedTrack => t !== null);
  } else if (ytMatch) {
    // YouTube playlist.
    const playlistId = ytMatch[1];
    const playlist = await fetchYouTubePlaylist(playlistId);
    if (!playlist || !playlist.videos.length) {
      return NextResponse.json(
        { message: 'Could not fetch YouTube playlist. It may be private or unavailable.' },
        { status: 404 },
      );
    }
    totalFound = playlist.videos.length;
    resolved = playlist.videos.slice(0, slotsLeft).map((v) => ({
      id: v.id,
      title: v.title,
      thumbnail: v.thumbnail,
      url: v.url,
      extractedId: v.id,
    }));
  } else {
    return NextResponse.json(
      { message: 'URL does not look like a YouTube or Spotify playlist.' },
      { status: 400 },
    );
  }

  if (!resolved.length) {
    return NextResponse.json({ message: 'No playable tracks found in the playlist.' }, { status: 404 });
  }

  try {
    await prismaClient.stream.createMany({
      data: resolved.map((t) => ({
        userId: botUser.id,
        addedById: botUser.id,
        url: t.url,
        extractedId: t.extractedId,
        type: 'Youtube' as const,
        title: t.title,
        smallImg: t.thumbnail,
        bigImg: `https://img.youtube.com/vi/${t.extractedId}/maxresdefault.jpg`,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Bot playlist bulk insert failed');
    return NextResponse.json({ message: 'Failed to save tracks to queue.' }, { status: 500 });
  }

  return NextResponse.json(
    { tracks: resolved, botUsername: botUser.username, totalFound },
    { status: 201 },
  );
}
