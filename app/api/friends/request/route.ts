export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { isUniqueConstraintError } from '@/app/lib/prismaErrors';

class FriendshipExistsError extends Error {}

function isSerializationFailure(err: unknown): boolean {
  // Postgres error code 40001 (serialization_failure), surfaced by Prisma
  // as P2034 on an interactive $transaction.
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2034'
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const requesterId = (session?.user as Record<string, unknown>)?.id as string;
  if (!requesterId) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { username } = await req.json();

  const addressee = await prismaClient.user.findUnique({
    where: { username },
    select: { id: true, allowFriendRequests: true },
  });
  if (!addressee) return NextResponse.json({ message: 'User not found' }, { status: 404 });
  if (addressee.id === requesterId)
    return NextResponse.json({ message: 'Cannot add yourself' }, { status: 400 });

  if (!addressee.allowFriendRequests) {
    return NextResponse.json(
      { message: 'This user is not accepting friend requests' },
      { status: 403 },
    );
  }

  // The findFirst-then-create check below isn't atomic on its own: the
  // @@unique([requesterId, addresseeId]) constraint only protects one
  // direction, so two requests sent in opposite directions at nearly the
  // same instant could both pass the check before either create() commits,
  // leaving two contradictory rows. Running it inside a Serializable
  // transaction makes Postgres abort the loser with a serialization
  // failure instead, which we catch and report as a normal 409.
  try {
    await prismaClient.$transaction(
      async (tx) => {
        const existing = await tx.friendship.findFirst({
          where: {
            OR: [
              { requesterId, addresseeId: addressee.id },
              { requesterId: addressee.id, addresseeId: requesterId },
            ],
          },
        });

        if (existing) {
          throw new FriendshipExistsError();
        }

        await tx.friendship.create({
          data: { requesterId, addresseeId: addressee.id, status: 'PENDING' },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  } catch (err) {
    if (err instanceof FriendshipExistsError || isUniqueConstraintError(err)) {
      return NextResponse.json(
        { message: 'Request already exists or friendship established' },
        { status: 409 },
      );
    }
    // A serialization failure from the concurrent-transaction abort also
    // means someone else won the race for this pair — same response.
    if (isSerializationFailure(err)) {
      return NextResponse.json(
        { message: 'Request already exists or friendship established' },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json(
    { message: 'Friend request sent' },
    { status: 201 }, // was: 200, now: 201 (created)
  );
}
