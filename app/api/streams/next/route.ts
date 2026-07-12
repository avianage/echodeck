import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { NextResponse, NextRequest } from 'next/server';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { broadcastEvent } from '@/app/lib/broadcastEvent';

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { isBanned: true, bannedUntil: true },
  });

  if (user?.isBanned) {
    return NextResponse.json({ message: 'Account banned' }, { status: 403 });
  }

  if (user?.bannedUntil && new Date(user.bannedUntil) > new Date()) {
    return NextResponse.json({ message: 'Account temporarily restricted' }, { status: 403 });
  }

  // Defaults to the caller's own room for backward compatibility with
  // existing broadcast callers, which never passed creatorId (skipping was
  // only ever possible on your own stream). A jam member skipping someone
  // else's room passes it explicitly.
  const creatorId = req.nextUrl.searchParams.get('creatorId') || userId;

  const [role, currentStream] = await Promise.all([
    getStreamRole(userId, creatorId),
    prismaClient.currentStream.findUnique({
      where: { userId: creatorId },
      select: { mode: true },
    }),
  ]);
  const mode = (currentStream?.mode as 'BROADCAST' | 'JAM' | undefined) ?? 'BROADCAST';

  if (!hasPermission(role, 'playback:skip', mode)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const requestedStreamId = req.nextUrl.searchParams.get('streamId');

  // Check the blocklist against a small batch of leading candidates instead
  // of pulling the entire blockedVideo table into memory on every skip.
  const CANDIDATE_BATCH_SIZE = 20;
  let mostUpvotedStream: Awaited<ReturnType<typeof prismaClient.stream.findFirst>> = null;

  if (requestedStreamId) {
    // A specific track was requested (e.g. "Play Now" from the queue) —
    // bypass the upvote/oldest ordering entirely, but still respect the
    // blocklist and make sure it's actually an unplayed track in this room.
    const requested = await prismaClient.stream.findFirst({
      where: { id: requestedStreamId, userId: creatorId, played: false },
    });
    if (requested) {
      const blocked = await prismaClient.blockedVideo.findFirst({
        where: { videoId: requested.extractedId },
      });
      if (!blocked) mostUpvotedStream = requested;
    }
    if (!mostUpvotedStream) {
      return NextResponse.json({ message: 'That track is unavailable' }, { status: 404 });
    }
  } else {
    let skip = 0;
    for (;;) {
      const candidates = await prismaClient.stream.findMany({
        where: { userId: creatorId, played: false },
        orderBy: [{ upvotes: { _count: 'desc' } }, { createdAt: 'asc' }],
        take: CANDIDATE_BATCH_SIZE,
        skip,
      });

      if (candidates.length === 0) break;

      const blocked = await prismaClient.blockedVideo.findMany({
        where: { videoId: { in: candidates.map((c) => c.extractedId) } },
        select: { videoId: true },
      });
      const blockedSet = new Set(blocked.map((b) => b.videoId));

      mostUpvotedStream = candidates.find((c) => !blockedSet.has(c.extractedId)) ?? null;
      if (mostUpvotedStream) break;
      if (candidates.length < CANDIDATE_BATCH_SIZE) break;
      skip += CANDIDATE_BATCH_SIZE;
    }

    if (!mostUpvotedStream) {
      return NextResponse.json({ message: 'No stream found' }, { status: 404 });
    }
  }

  // Advancing the queue is a read-then-write: pick the top track, then mark it
  // played and set it as current. Two near-simultaneous skips (double-click,
  // or a moderator skipping while auto-advance also fires) could otherwise
  // both act on the same `mostUpvotedStream` before either commits, double-
  // advancing the queue. A transaction with a `played: false` guard on the
  // update makes the second racer's update affect zero rows instead.
  const advanced = await prismaClient.$transaction(async (tx) => {
    const result = await tx.stream.updateMany({
      where: { id: mostUpvotedStream.id, played: false },
      data: { played: true, playedTs: new Date() },
    });
    if (result.count === 0) return false;

    const previous = await tx.currentStream.findUnique({ where: { userId: creatorId } });
    if (previous?.streamId) {
      // The Stream row we're advancing away from was the previous "current"
      // track — close out its isLive/endedAt now that it's no longer playing.
      await tx.stream.update({
        where: { id: previous.streamId },
        data: { isLive: false, endedAt: new Date() },
      });
    }
    await tx.stream.update({
      where: { id: mostUpvotedStream.id },
      data: { isLive: true, startedAt: new Date() },
    });

    await tx.currentStream.upsert({
      where: { userId: creatorId },
      update: { streamId: mostUpvotedStream.id },
      create: { userId: creatorId, streamId: mostUpvotedStream.id },
    });
    return true;
  });

  if (!advanced) {
    return NextResponse.json({ message: 'Stream already advanced' }, { status: 409 });
  }

  await broadcastEvent(creatorId, 'SONG_SKIPPED_BY_CREATOR', `Skipped to: ${mostUpvotedStream.title}`);

  return NextResponse.json({
    stream: mostUpvotedStream,
  });
}
