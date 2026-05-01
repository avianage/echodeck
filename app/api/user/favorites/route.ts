import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';

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

  const favoritesWithStatus = await Promise.all(
    (user?.favorites ?? []).map(async (f) => {
      const activeStream = await prismaClient.currentStream.findUnique({
        where: {
          userId: f.favoriteId,
        },
      });

      // Consider online if heartbeat was within the last 30 seconds
      const isOnline =
        activeStream && new Date().getTime() - new Date(activeStream.updatedAt).getTime() < 30000;

      return {
        ...f.favorite,
        isOnline: !!isOnline,
      };
    }),
  );

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
      return NextResponse.json({ message: 'Removed from favorites' });
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
      return NextResponse.json({ message: 'Added to favorites' });
    }
  } catch (err: unknown) {
    return NextResponse.json({ message: 'Error updating favorites' }, { status: 500 });
  }
}
