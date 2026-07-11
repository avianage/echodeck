export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';

const RespondSchema = z.object({
  friendshipId: z.string(),
  action: z.enum(['accept', 'decline', 'block']),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, unknown>)?.id as string;
  if (!userId) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const parsed = RespondSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
  }
  const { friendshipId, action } = parsed.data;

  const friendship = await prismaClient.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship || friendship.addresseeId !== userId) {
    return NextResponse.json(
      { message: 'Unauthorized or request not found' },
      { status: 404 }, // was: 403, now: 404 (not found)
    );
  }

  // Previously any non-PENDING friendship (including an already-ACCEPTED
  // one) could be re-"responded" to, letting the addressee silently flip an
  // established friendship to BLOCKED via this endpoint. respond is only
  // for acting on a still-open request; see /api/friends/unfriend to end an
  // existing friendship.
  if (friendship.status !== 'PENDING') {
    return NextResponse.json({ message: 'This request has already been resolved' }, { status: 409 });
  }

  if (action === 'decline') {
    // Unlike 'block', a decline leaves no row behind, so the requester is
    // free to send another request later instead of being permanently stuck.
    await prismaClient.friendship.delete({ where: { id: friendshipId } });
    return NextResponse.json({ message: 'Request declined' });
  }

  await prismaClient.friendship.update({
    where: { id: friendshipId },
    data: { status: action === 'accept' ? 'ACCEPTED' : 'BLOCKED' },
  });

  return NextResponse.json({ message: `Request ${action}ed` });
}
