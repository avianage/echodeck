export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { broadcastEvent } from '@/app/lib/broadcastEvent';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const ModeratorSchema = z.object({
  targetUserId: z.string().min(1, 'targetUserId is required'),
  creatorId: z.string().min(1, 'creatorId is required'),
  action: z.enum(['promote', 'demote']),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as Record<string, unknown>)?.id as string;
    if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });

    const body = await req.json();
    const { targetUserId, creatorId, action } = ModeratorSchema.parse(body);

    if (targetUserId === userId) {
      return NextResponse.json({ message: 'Cannot modify your own role' }, { status: 400 });
    }

    if (targetUserId === creatorId) {
      return NextResponse.json({ message: 'Cannot modify the stream owner\'s role' }, { status: 400 });
    }

    const role = await getStreamRole(userId, creatorId);
    if (!hasPermission(role, 'session:promote:mod')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const [targetUser, callerUser] = await Promise.all([
      prismaClient.user.findUnique({ where: { id: targetUserId }, select: { username: true } }),
      prismaClient.user.findUnique({ where: { id: userId }, select: { username: true } }),
    ]);

    if (!targetUser) {
      return NextResponse.json({ message: 'Target user not found' }, { status: 404 });
    }

    const targetUsername = targetUser.username || 'Someone';
    const callerUsername = callerUser?.username || 'A moderator';

    // Ensure requester is the stream creator (uses their own stream i.e. userId = creatorId)
    const newRole = action === 'promote' ? 'MODERATOR' : 'MEMBER';

    // Upsert the SessionMember record for this viewer in the creator's stream
    await prismaClient.sessionMember.upsert({
      where: {
        userId_creatorId: {
          userId: targetUserId,
          creatorId,
        },
      },
      update: { role: newRole },
      create: {
        userId: targetUserId,
        creatorId,
        role: newRole,
      },
    });

    // Broadcast an event to the target user
    if (action === 'promote') {
      await broadcastEvent(
        creatorId,
        'MOD_PROMOTED',
        `@${targetUsername} has been promoted to moderator by @${callerUsername}.`,
      );
    } else {
      await broadcastEvent(
        creatorId,
        'MOD_DEMOTED',
        `@${targetUsername} is no longer a moderator.`,
      );
    }

    return NextResponse.json({
      message: action === 'promote' ? 'User promoted to moderator' : 'Moderator role removed',
    });
  } catch (error) {

    logger.error({ err: error }, '❌ Moderator API Error:');
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
