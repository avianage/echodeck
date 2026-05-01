import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
    }

    const userId = session.user.id;
    const creatorId = req.nextUrl.searchParams.get('creatorId');
    if (!creatorId) {
      return NextResponse.json({ message: 'Creator ID required' }, { status: 400 });
    }

    const streamRole = await getStreamRole(userId, creatorId);
    const canManage = ['CREATOR', 'MODERATOR', 'OWNER'].includes(streamRole);

    if (!canManage) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const restrictedMembers = await prismaClient.sessionMember.findMany({
      where: {
        creatorId,
        OR: [{ isBanned: true }, { bannedUntil: { gt: new Date() } }],
      },
      select: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            image: true,
          },
        },
        isBanned: true,
        banReason: true,
        bannedUntil: true,
        bannedAt: true,
      },
    });

    const list = restrictedMembers.map((m) => ({
      id: m.user.id,
      username: m.user.username,
      displayName: m.user.displayName,
      image: m.user.image,
      isBanned: m.isBanned,
      banReason: m.banReason,
      bannedUntil: m.bannedUntil,
      bannedAt: m.bannedAt,
    }));

    return NextResponse.json({ restricted: list });
  } catch (e) {
     
    logger.error({ err: e }, '❌ Restricted Users API Error:');
    return NextResponse.json({ message: 'Failed to fetch restricted users' }, { status: 500 });
  }
}
