export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { logger } from '@/lib/logger';
import { isRateLimited } from '@/app/lib/rateLimit';

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

const GDPR_DELETION_WINDOW_MS = 60 * 60 * 1000;

function sessionInvalidationHeaders() {
  const expires = 'Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  const base = 'Path=/; HttpOnly; SameSite=Lax';

  return new Headers([
    ['Set-Cookie', `next-auth.session-token=; ${expires}; ${base}`],
    ['Set-Cookie', `__Secure-next-auth.session-token=; ${expires}; ${base}; Secure`],
    ['Set-Cookie', `next-auth.csrf-token=; ${expires}; Path=/; SameSite=Lax`],
    ['Set-Cookie', `__Host-next-auth.csrf-token=; ${expires}; Path=/; SameSite=Lax; Secure`],
  ]);
}

async function deleteUserData(userId: string, email: string | null) {
  await prismaClient.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });

    if (email) {
      await tx.verificationToken.deleteMany({
        where: {
          OR: [
            { identifier: { contains: email } },
            { identifier: { contains: email.toLowerCase() } },
          ],
        },
      });
    }

    await tx.upvote.deleteMany({ where: { userId } });
    await tx.favorite.deleteMany({
      where: {
        OR: [{ userId }, { favoriteId: userId }],
      },
    });
    await tx.friendship.deleteMany({
      where: {
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    });
    await tx.streamAccess.deleteMany({
      where: {
        OR: [{ streamerId: userId }, { viewerId: userId }],
      },
    });
    await tx.sessionMember.deleteMany({
      where: {
        OR: [{ userId }, { creatorId: userId }],
      },
    });
    await tx.listeningActivity.deleteMany({
      where: {
        OR: [{ userId }, { creatorId: userId }],
      },
    });
    await tx.currentStream.deleteMany({ where: { userId } });
    await tx.streamEvent.deleteMany({ where: { creatorId: userId } });
    await tx.stream.deleteMany({
      where: {
        OR: [{ userId }, { addedById: userId }],
      },
    });
    await tx.user.delete({ where: { id: userId } });
  });
}

export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id;

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    if (isRateLimited(`gdpr-delete:${userId}`, 1, GDPR_DELETION_WINDOW_MS)) {
      return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
    }

    await deleteUserData(user.id, user.email);
    logger.info({ userId: user.id, timestamp: new Date().toISOString() }, 'GDPR user deletion');

    return new Response(null, {
      status: 204,
      headers: sessionInvalidationHeaders(),
    }); // was: 200, now: 204 (deletion)
  } catch (error) {
    logger.error({ err: error }, 'Error deleting account:');
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export const POST = DELETE;
