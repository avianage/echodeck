export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { logger } from '@/lib/logger';

const INVITE_TTL_MS = 10 * 60 * 1000;

const SendInviteSchema = z.object({
  creatorId: z.string().min(1),
  inviteeId: z.string().min(1),
});

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const invites = await prismaClient.jamInvite.findMany({
    where: {
      inviteeId: userId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      creator: { select: { id: true, username: true, displayName: true, image: true, partyCode: true } },
      inviter: { select: { id: true, username: true, displayName: true } },
    },
  });

  return NextResponse.json({ invites });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const inviterId = session?.user?.id as string | undefined;
  if (!inviterId) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  try {
    const body = SendInviteSchema.parse(await req.json());
    const { creatorId, inviteeId } = body;

    if (inviteeId === inviterId) {
      return NextResponse.json({ message: 'Cannot invite yourself' }, { status: 400 });
    }

    const [role, currentStream] = await Promise.all([
      getStreamRole(inviterId, creatorId),
      prismaClient.currentStream.findUnique({
        where: { userId: creatorId },
        select: { mode: true },
      }),
    ]);

    if (currentStream?.mode !== 'JAM') {
      return NextResponse.json({ message: 'This session is not a jam' }, { status: 400 });
    }

    const canInvite =
      role === 'CREATOR' || role === 'OWNER' || role === 'MODERATOR' || role === 'MEMBER';
    if (!canInvite) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const friendship = await prismaClient.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: inviterId, addresseeId: inviteeId },
          { requesterId: inviteeId, addresseeId: inviterId },
        ],
      },
    });
    if (!friendship) {
      return NextResponse.json(
        { message: 'You can only invite accepted friends' },
        { status: 403 },
      );
    }

    const existing = await prismaClient.jamInvite.findFirst({
      where: {
        creatorId,
        inviteeId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });
    if (existing) {
      return NextResponse.json({ message: 'Invite already sent' }, { status: 409 });
    }

    const invite = await prismaClient.jamInvite.create({
      data: {
        creatorId,
        inviterId,
        inviteeId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, '❌ Jam Invite API Error:');
    return NextResponse.json({ message: 'Failed to send invite' }, { status: 500 });
  }
}
