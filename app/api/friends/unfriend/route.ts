export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';

const UnfriendSchema = z.object({
  userId: z.string(),
});

// There was previously no way to end an ACCEPTED friendship short of the
// addressee blocking it via /api/friends/respond (which only the addressee
// could do, and only before it was resolved). This lets either side of an
// established friendship remove it, symmetrically. It also doubles as a way
// for a requester to withdraw their own still-PENDING outgoing request,
// which previously had no endpoint at all.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const requesterId = (session?.user as Record<string, unknown>)?.id as string;
  if (!requesterId) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const parsed = UnfriendSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
  }
  const { userId: otherUserId } = parsed.data;

  const friendship = await prismaClient.friendship.findFirst({
    where: {
      OR: [
        { status: 'ACCEPTED', requesterId, addresseeId: otherUserId },
        { status: 'ACCEPTED', requesterId: otherUserId, addresseeId: requesterId },
        // A pending request the caller themselves sent — lets them withdraw it.
        { status: 'PENDING', requesterId, addresseeId: otherUserId },
      ],
    },
  });

  if (!friendship) {
    return NextResponse.json({ message: 'Friendship not found' }, { status: 404 });
  }

  await prismaClient.friendship.delete({ where: { id: friendship.id } });

  return new Response(null, { status: 204 });
}
