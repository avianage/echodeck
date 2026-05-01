import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import type { Friendship, ListeningActivity } from '@prisma/client';

type FriendshipWithMembers = Friendship & {
  requester: {
    id: string;
    username: string | null;
    displayName: string | null;
    image: string | null;
    listeningActivity: ListeningActivity | null;
  };
  addressee: {
    id: string;
    username: string | null;
    displayName: string | null;
    image: string | null;
    listeningActivity: ListeningActivity | null;
  };
};

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string;
  if (!userId) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const friendships = await prismaClient.friendship.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    include: {
      requester: {
        select: {
          id: true,
          username: true,
          displayName: true,
          image: true,
          listeningActivity: true,
        },
      },
      addressee: {
        select: {
          id: true,
          username: true,
          displayName: true,
          image: true,
          listeningActivity: true,
        },
      },
    },
  });

  const ACTIVITY_TIMEOUT_MS = 30 * 1000; // 30s — if no heartbeat, consider offline
  const now = Date.now();

  const activity = await Promise.all(
    friendships.map(async (f: FriendshipWithMembers) => {
      const friend = f.requesterId === userId ? f.addressee : f.requester;
      const la = friend.listeningActivity;
      const isActive = la && now - new Date(la.updatedAt).getTime() < ACTIVITY_TIMEOUT_MS;

      let partyCode = null;
      if (isActive && la.creatorId) {
        const creator = await prismaClient.user.findUnique({
          where: { id: la.creatorId },
          select: { partyCode: true },
        });
        partyCode = creator?.partyCode;
      }

      return {
        id: friend.id,
        username: friend.username,
        displayName: friend.displayName,
        image: friend.image,
        isListening: isActive,
        creatorId: isActive ? la.creatorId : null,
        partyCode: partyCode,
        songTitle: isActive ? la.songTitle : null,
        lastSeen: la?.updatedAt ?? null,
      };
    }),
  );

  return NextResponse.json({ activity });
}
