export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id;

  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });

  const requestingUser = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { platformRole: true },
  });

  if (requestingUser?.platformRole !== 'OWNER') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const { targetUserId } = await req.json();

  if (!targetUserId) {
    return NextResponse.json({ message: 'Missing targetUserId' }, { status: 400 });
  }

  if (targetUserId === userId) {
    return NextResponse.json({ message: 'You cannot delete your own account' }, { status: 400 });
  }

  const targetUser = await prismaClient.user.findUnique({
    where: { id: targetUserId },
    select: { platformRole: true, username: true },
  });

  if (!targetUser) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 });
  }

  if (targetUser.platformRole === 'OWNER') {
    return NextResponse.json({ message: 'Cannot delete another owner' }, { status: 403 });
  }

  // Mirrors the cascade in /api/user/delete — done in one transaction so a
  // failure partway through (e.g. an unexpected FK constraint) rolls back
  // instead of leaving the target user half-deleted.
  await prismaClient.$transaction(async (tx) => {
    await tx.stream.updateMany({
      where: { userId: targetUserId, isLive: true },
      data: { isLive: false, endedAt: new Date() },
    });
    await tx.currentStream.deleteMany({ where: { userId: targetUserId } });
    await tx.session.deleteMany({ where: { userId: targetUserId } });
    await tx.account.deleteMany({ where: { userId: targetUserId } });
    await tx.upvote.deleteMany({ where: { userId: targetUserId } });
    await tx.favorite.deleteMany({
      where: { OR: [{ userId: targetUserId }, { favoriteId: targetUserId }] },
    });
    await tx.friendship.deleteMany({
      where: { OR: [{ requesterId: targetUserId }, { addresseeId: targetUserId }] },
    });
    await tx.streamAccess.deleteMany({
      where: { OR: [{ streamerId: targetUserId }, { viewerId: targetUserId }] },
    });
    await tx.sessionMember.deleteMany({
      where: { OR: [{ userId: targetUserId }, { creatorId: targetUserId }] },
    });
    await tx.listeningActivity.deleteMany({
      where: { OR: [{ userId: targetUserId }, { creatorId: targetUserId }] },
    });
    await tx.streamEvent.deleteMany({ where: { creatorId: targetUserId } });
    await tx.stream.deleteMany({
      where: { OR: [{ userId: targetUserId }, { addedById: targetUserId }] },
    });
    await tx.user.delete({ where: { id: targetUserId } });
  });

  return new Response(null, { status: 204 }); // was: 200, now: 204 (deletion)
}
