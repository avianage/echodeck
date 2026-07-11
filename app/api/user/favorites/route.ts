import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { isRecentlyActive } from '@/app/lib/presence';

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
  }

  const user = await prismaClient.user.findUnique({
    where: { email: session.user.email },
    include: {
      favorites: {
        include: {
          favorite: {
            select: {
              id: true,
              username: true,
              email: true,
              partyCode: true,
              image: true,
            },
          },
        },
      },
    },
  });

  const favorites = user?.favorites ?? [];
  const currentStreams = favorites.length
    ? await prismaClient.currentStream.findMany({
        where: { userId: { in: favorites.map((f) => f.favoriteId) } },
        select: { userId: true, updatedAt: true },
      })
    : [];
  const updatedAtByUserId = new Map(currentStreams.map((cs) => [cs.userId, cs.updatedAt]));

  const favoritesWithStatus = favorites.map((f) => ({
    ...f.favorite,
    isOnline: isRecentlyActive(updatedAtByUserId.get(f.favoriteId)),
  }));

  return NextResponse.json({
    favorites: favoritesWithStatus,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
  }

  try {
    const { favoriteId } = await req.json();
    const user = await prismaClient.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

    const existing = await prismaClient.favorite.findUnique({
      where: {
        userId_favoriteId: {
          userId: user.id,
          favoriteId,
        },
      },
    });

    if (existing) {
      await prismaClient.favorite.delete({
        where: { id: existing.id },
      });
      return new Response(null, { status: 204 }); // was: 200, now: 204 (deletion)
    } else {
      // Check limit
      const count = await prismaClient.favorite.count({
        where: { userId: user.id },
      });

      if (count >= 5) {
        return NextResponse.json(
          { message: 'You can only have up to 5 favorites' },
          { status: 400 },
        );
      }

      await prismaClient.favorite.create({
        data: {
          userId: user.id,
          favoriteId,
        },
      });
      return NextResponse.json(
        { message: 'Added to favorites' },
        { status: 201 }, // was: 200, now: 201 (created)
      );
    }
  } catch (err: unknown) {
    return NextResponse.json({ message: 'Error updating favorites' }, { status: 500 });
  }
}
