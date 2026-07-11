import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import type { Friendship, ListeningActivity } from '@prisma/client';
import { isRecentlyActive } from '@/app/lib/presence';

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

  const friends = friendships.map((f: FriendshipWithMembers) =>
    f.requesterId === userId ? f.addressee : f.requester,
  );

  const activeCreatorIds = Array.from(
    new Set(
      friends
        .filter((friend) => isRecentlyActive(friend.listeningActivity?.updatedAt))
        .map((friend) => friend.listeningActivity?.creatorId)
        .filter((id): id is string => !!id),
    ),
  );

  const creators = activeCreatorIds.length
    ? await prismaClient.user.findMany({
        where: { id: { in: activeCreatorIds } },
        select: { id: true, partyCode: true },
      })
    : [];
  const partyCodeByCreatorId = new Map(creators.map((c) => [c.id, c.partyCode]));

  const activity = friends.map((friend) => {
    const la = friend.listeningActivity;
    const isActive = !!la && isRecentlyActive(la.updatedAt);

    return {
      id: friend.id,
      username: friend.username,
      displayName: friend.displayName,
      image: friend.image,
      isListening: isActive,
      creatorId: isActive ? la.creatorId : null,
      partyCode: isActive && la.creatorId ? (partyCodeByCreatorId.get(la.creatorId) ?? null) : null,
      songTitle: isActive ? la.songTitle : null,
      lastSeen: la?.updatedAt ?? null,
    };
  });

  return NextResponse.json({ activity });
}
