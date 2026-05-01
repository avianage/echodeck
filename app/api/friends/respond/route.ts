export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as Record<string, unknown>)?.id as string;
  if (!userId) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { friendshipId, action } = await req.json();
  // action: "accept" | "block"

  const friendship = await prismaClient.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship || friendship.addresseeId !== userId) {
    return NextResponse.json(
      { message: 'Unauthorized or request not found' },
      { status: 404 }, // was: 403, now: 404 (not found)
    );
  }

  await prismaClient.friendship.update({
    where: { id: friendshipId },
    data: { status: action === 'accept' ? 'ACCEPTED' : 'BLOCKED' },
  });

  return NextResponse.json({ message: `Request ${action}ed` });
}
