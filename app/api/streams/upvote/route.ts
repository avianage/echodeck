export const dynamic = 'force-dynamic';
import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { isRateLimited } from '@/app/lib/rateLimit';
import { isUniqueConstraintError } from '@/app/lib/prismaErrors';
import { logger } from '@/lib/logger';

const UpvoteSchema = z.object({
  streamId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
    }

    const rateKey = `upvote:${session.user.email}`;
    if (isRateLimited(rateKey, 30, 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const data = UpvoteSchema.parse(await req.json());

    const [user, stream] = await Promise.all([
      prismaClient.user.findUnique({
        where: {
          email: session.user.email,
        },
        select: { id: true, isBanned: true, bannedUntil: true, platformRole: true },
      }),
      prismaClient.stream.findUnique({
        where: { id: data.streamId },
      }),
    ]);

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }, // was: 403, now: 404 (not found)
      );
    }

    if (user.isBanned) {
      return NextResponse.json({ message: 'Account banned' }, { status: 403 });
    }

    if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
      return NextResponse.json({ message: 'Account temporarily restricted' }, { status: 403 });
    }

    if (!stream) {
      return NextResponse.json({ message: 'Invalid stream ID' }, { status: 404 });
    }

    if (stream.played) {
      return NextResponse.json({ message: 'This track has already played' }, { status: 400 });
    }

    const role = await getStreamRole(user.id, stream.userId);
    if (!hasPermission(role, 'vote:cast')) {
      return NextResponse.json({ message: 'Action restricted from this stream' }, { status: 403 });
    }

    const creator = await prismaClient.user.findUnique({
      where: { id: stream.userId },
      select: { isPublic: true },
    });

    if (creator && !creator.isPublic && user.id !== stream.userId) {
      const access = await prismaClient.streamAccess.findUnique({
        where: {
          streamerId_viewerId: {
            streamerId: stream.userId,
            viewerId: user.id,
          },
        },
      });
      if (access?.status !== 'APPROVED') {
        return NextResponse.json({ message: 'Access denied' }, { status: 403 });
      }
    }

    // Check if user already upvoted this stream
    const existingUpvote = await prismaClient.upvote.findUnique({
      where: {
        userId_streamId: {
          userId: user.id,
          streamId: data.streamId,
        },
      },
    });

    if (existingUpvote) {
      return NextResponse.json({ message: 'Already upvoted' }, { status: 409 });
    }

    // ✅ Create upvote. The `@@unique([userId, streamId])` constraint is the
    // real guard against a duplicate-vote race (two near-simultaneous
    // requests both passing the `existingUpvote` check above); catch that
    // race here and report it the same way as the pre-check does, instead of
    // letting it fall through to a raw 500.
    try {
      await prismaClient.upvote.create({
        data: {
          userId: user.id,
          streamId: data.streamId,
        },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return NextResponse.json({ message: 'Already upvoted' }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json(
      { message: 'Upvoted successfully!' },
      { status: 201 }, // was: 200, now: 201 (created)
    );
  } catch (error) {
    logger.error({ err: error }, 'Error while Upvoting:');

    return NextResponse.json(
      {
        message: 'Error while upvoting',
      },
      {
        status: 500,
      },
    );
  }
}
