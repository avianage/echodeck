export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { prismaClient } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';

interface SessionUser {
  id?: string;
}

const PAGE_SIZE = 50;

// Stream.played/playedTs already persist every track a creator has queued —
// they're just excluded from the live-queue view once played. This exposes
// that existing data as a "recently played" history instead of adding new
// storage for it.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const creatorId = req.nextUrl.searchParams.get('creatorId') || userId;
  const cursor = req.nextUrl.searchParams.get('cursor');

  const role = await getStreamRole(userId, creatorId);
  if (!hasPermission(role, 'vote:cast')) {
    return NextResponse.json({ message: 'Access denied' }, { status: 403 });
  }

  if (userId !== creatorId) {
    const creator = await prismaClient.user.findUnique({
      where: { id: creatorId },
      select: { isPublic: true },
    });
    if (creator && !creator.isPublic) {
      const access = await prismaClient.streamAccess.findUnique({
        where: { streamerId_viewerId: { streamerId: creatorId, viewerId: userId } },
      });
      if (access?.status !== 'APPROVED') {
        return NextResponse.json({ message: 'Access denied' }, { status: 403 });
      }
    }
  }

  const tracks = await prismaClient.stream.findMany({
    where: {
      userId: creatorId,
      played: true,
      ...(cursor ? { playedTs: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { playedTs: 'desc' },
    take: PAGE_SIZE,
  });

  const nextCursor =
    tracks.length === PAGE_SIZE ? tracks[tracks.length - 1].playedTs?.toISOString() : null;

  return NextResponse.json({ tracks, nextCursor });
}
