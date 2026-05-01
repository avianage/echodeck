import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { isRateLimited } from '@/app/lib/rateLimit';
import { logger } from '@/lib/logger';

const DownvoteSchema = z.object({
  streamId: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
    }

    const rateKey = `downvote:${session.user.email}`;
    if (isRateLimited(rateKey, 30, 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const user = await prismaClient.user.findUnique({
      where: {
        email: session.user.email,
      },
      select: { id: true, isBanned: true, bannedUntil: true, platformRole: true },
    });

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

    const data = DownvoteSchema.parse(await req.json());

    // 🔍 Check if stream exists
    const stream = await prismaClient.stream.findUnique({
      where: { id: data.streamId },
    });

    if (!stream) {
      return NextResponse.json({ message: 'Invalid stream ID' }, { status: 404 });
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

    // 🔍 Check if user has upvoted this stream
    const existingUpvote = await prismaClient.upvote.findUnique({
      where: {
        userId_streamId: {
          userId: user.id,
          streamId: data.streamId,
        },
      },
    });

    if (!existingUpvote) {
      return NextResponse.json({ message: "You haven't upvoted this stream yet" }, { status: 409 });
    }

    // 🗑️ Remove upvote
    await prismaClient.upvote.delete({
      where: {
        userId_streamId: {
          userId: user.id,
          streamId: data.streamId,
        },
      },
    });

    return new Response(null, { status: 204 }); // was: 200, now: 204 (deletion)
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error while Downvoting:');

    return NextResponse.json(
      {
        message:
          'Error while Downvoting: ' + (error instanceof Error ? error.message : String(error)),
      },
      {
        status: 500,
      },
    );
  }
}
