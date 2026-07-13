import { NextRequest, NextResponse } from 'next/server';
import { prismaClient } from '@/app/lib/db';
import { resolveMixedTrackLines } from '@/app/lib/playlistResolve';
import { resolveAudioUrl } from '@/app/lib/ytdlp';
import { logger } from '@/lib/logger';

const MAX_QUEUE_LENGTH = parseInt(process.env.MAX_QUEUE_LENGTH || '200', 10);

function botSecretGuard(req: NextRequest): NextResponse | null {
  const secret = req.headers.get('x-bot-secret');
  if (!secret || secret !== process.env.BOT_INTERNAL_SECRET) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }
  return null;
}

async function getBotUser() {
  const botUserId = process.env.BOT_SERVICE_USER_ID;
  if (!botUserId) return null;
  return prismaClient.user.findUnique({
    where: { id: botUserId },
    select: { id: true, username: true },
  });
}

// POST /api/bot/streams
// Body: { query: string } — YouTube URL, Spotify track URL, or free-text search.
// Creates a Stream row owned by the bot service user, pre-warms the yt-dlp cache,
// and returns { stream, botUsername } for the caller to immediately start playback.
export async function POST(req: NextRequest) {
  const authError = botSecretGuard(req);
  if (authError) return authError;

  const botUser = await getBotUser();
  if (!botUser) {
    return NextResponse.json(
      { message: 'BOT_SERVICE_USER_ID not configured or bot user not found. Run prisma/seed-bot-user.ts first.' },
      { status: 500 },
    );
  }

  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const query = (body.query ?? '').trim();
  if (!query) {
    return NextResponse.json({ message: 'query is required' }, { status: 400 });
  }

  const [resolved] = await resolveMixedTrackLines([query]);
  if (!resolved) {
    return NextResponse.json(
      { message: 'Could not find a matching track. Try a more specific query or a direct URL.' },
      { status: 404 },
    );
  }

  const blocked = await prismaClient.blockedVideo.findUnique({
    where: { videoId: resolved.extractedId },
  });
  if (blocked) {
    return NextResponse.json(
      { message: 'This video is blocked or has embed restrictions.' },
      { status: 400 },
    );
  }

  const queueLength = await prismaClient.stream.count({
    where: { userId: botUser.id, played: false },
  });
  if (queueLength >= MAX_QUEUE_LENGTH) {
    return NextResponse.json(
      { message: `Queue is full (${MAX_QUEUE_LENGTH} songs max).` },
      { status: 400 },
    );
  }

  // extractedId is always a YouTube video ID (even for Spotify-sourced tracks).
  const bigImg = `https://img.youtube.com/vi/${resolved.extractedId}/maxresdefault.jpg`;

  const stream = await prismaClient.stream.create({
    data: {
      userId: botUser.id,
      addedById: botUser.id,
      url: resolved.url,
      extractedId: resolved.extractedId,
      type: resolved.type,
      title: resolved.title,
      smallImg: resolved.thumbnail,
      bigImg,
    },
  });

  // Pre-warm yt-dlp cache so the audio URL is ready when the bot starts playing.
  resolveAudioUrl(resolved.extractedId).catch((err) =>
    logger.warn({ err, extractedId: resolved.extractedId }, 'Bot stream pre-warm failed'),
  );

  return NextResponse.json({ stream, botUsername: botUser.username }, { status: 201 });
}

// DELETE /api/bot/streams
// Tears down the bot's active session: removes unplayed queue rows and any
// CurrentStream / ListeningActivity left over from the session.
export async function DELETE(req: NextRequest) {
  const authError = botSecretGuard(req);
  if (authError) return authError;

  const botUserId = process.env.BOT_SERVICE_USER_ID;
  if (!botUserId) {
    return NextResponse.json({ message: 'BOT_SERVICE_USER_ID not configured' }, { status: 500 });
  }

  try {
    await Promise.all([
      prismaClient.stream.deleteMany({ where: { userId: botUserId, played: false } }),
      prismaClient.currentStream.deleteMany({ where: { userId: botUserId } }),
      prismaClient.listeningActivity.deleteMany({ where: { creatorId: botUserId } }),
    ]);
  } catch (err) {
    logger.error({ err }, 'Bot stream teardown failed');
    return NextResponse.json({ message: 'Teardown failed' }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
