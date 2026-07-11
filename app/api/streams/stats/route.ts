export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { prismaClient } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth';

interface SessionUser {
  id?: string;
  platformRole?: string;
}

// Self (or OWNER, mirroring the DB-role-recheck pattern used by admin
// routes) only — this exposes a creator's own play/vote history, not
// something other viewers should be able to query.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const creatorId = req.nextUrl.searchParams.get('creatorId') || userId;

  if (creatorId !== userId) {
    const requester = await prismaClient.user.findUnique({
      where: { id: userId },
      select: { platformRole: true },
    });
    if (requester?.platformRole !== 'OWNER') {
      return NextResponse.json({ message: 'Access denied' }, { status: 403 });
    }
  }

  const [totalPlays, topPlayed, topUpvoted, currentStream] = await Promise.all([
    prismaClient.stream.count({ where: { userId: creatorId, played: true } }),
    prismaClient.stream.groupBy({
      by: ['extractedId', 'title'],
      where: { userId: creatorId, played: true },
      _count: { extractedId: true },
      orderBy: { _count: { extractedId: 'desc' } },
      take: 5,
    }),
    prismaClient.stream.findMany({
      where: { userId: creatorId },
      select: { extractedId: true, title: true, _count: { select: { upvotes: true } } },
      orderBy: { upvotes: { _count: 'desc' } },
      take: 5,
    }),
    prismaClient.currentStream.findUnique({
      where: { userId: creatorId },
      select: { viewerCount: true, peakViewerCount: true },
    }),
  ]);

  return NextResponse.json({
    totalPlays,
    topPlayed: topPlayed.map((t) => ({
      extractedId: t.extractedId,
      title: t.title,
      playCount: t._count.extractedId,
    })),
    topUpvoted: topUpvoted.map((t) => ({
      extractedId: t.extractedId,
      title: t.title,
      upvotes: t._count.upvotes,
    })),
    currentViewerCount: currentStream?.viewerCount ?? 0,
    peakViewerCount: currentStream?.peakViewerCount ?? 0,
  });
}
