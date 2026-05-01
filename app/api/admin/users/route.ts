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
  const search = req.nextUrl.searchParams.get('search') ?? '';
  const pageSize = 20;

  const users = await prismaClient.user.findMany({
    where: {
      OR: [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      platformRole: true,
      isBanned: true,
      bannedUntil: true,
      banReason: true,
      createdAt: true,
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ users });
}
