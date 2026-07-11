export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { logger } from '@/lib/logger';

const RespondSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  try {
    const { action } = RespondSchema.parse(await req.json());
    const { id } = await params;

    const invite = await prismaClient.jamInvite.findUnique({
      where: { id },
      include: { creator: { select: { partyCode: true } } },
    });

    if (!invite || invite.inviteeId !== userId) {
      return NextResponse.json({ message: 'Invite not found' }, { status: 404 });
    }

    if (invite.status !== 'PENDING' || invite.expiresAt <= new Date()) {
      return NextResponse.json({ message: 'This invite is no longer active' }, { status: 409 });
    }

    const updated = await prismaClient.jamInvite.update({
      where: { id: invite.id },
      data: { status: action === 'accept' ? 'ACCEPTED' : 'DECLINED' },
    });

    return NextResponse.json({
      invite: updated,
      partyCode: action === 'accept' ? invite.creator.partyCode : null,
    });
  } catch (error) {
    logger.error({ err: error }, '❌ Jam Invite Respond API Error:');
    return NextResponse.json({ message: 'Failed to respond to invite' }, { status: 500 });
  }
}
