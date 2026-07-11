export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string;
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });

  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { platformRole: true },
  });

  if (user?.platformRole !== 'OWNER')
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });

  const page = Number(req.nextUrl.searchParams.get('page') ?? 1);
  const isLiveParam = req.nextUrl.searchParams.get('isLive');
  const pageSize = 50;

  const where = isLiveParam !== null ? { isLive: isLiveParam === 'true' } : {};

  const [streams, totalCount] = await Promise.all([
    prismaClient.stream.findMany({
      where,
      include: {
        user: { select: { username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prismaClient.stream.count({ where }),
  ]);

  return NextResponse.json({
    streams,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
  });
}
