export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { broadcastEvent } from '@/app/lib/broadcastEvent';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as Record<string, unknown>)?.id as string;

    if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });

    const user = await prismaClient.user.findUnique({
      where: { id: userId },
      select: { platformRole: true },
    });

    if ((user?.platformRole as string) !== 'OWNER') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    const { targetUserId, action } = await req.json();

    if (typeof targetUserId !== 'string' || !targetUserId) {
      return NextResponse.json({ message: 'targetUserId is required' }, { status: 400 });
    }

    if (targetUserId === userId) {
      return NextResponse.json(
        { message: 'Owners cannot modify their own platform role' },
        { status: 400 },
      );
    }

    // action: "assign" | "revoke"

    if (!['assign', 'revoke'].includes(action)) {
      return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    }

    const targetUser = await prismaClient.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!targetUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const newRole = action === 'assign' ? 'CREATOR' : 'MEMBER';

    // If revoking creator, close their active stream immediately
    if (action === 'revoke') {
      const activeStream = await prismaClient.stream.findFirst({
        where: { userId: targetUserId, isLive: true },
      });
      if (activeStream) {
        await prismaClient.stream.update({
          where: { id: activeStream.id },
          data: { isLive: false, endedAt: new Date() },
        });
        await prismaClient.currentStream.deleteMany({
          where: { userId: targetUserId },
        });
        // Queue toast broadcast for stream force-closed
        await broadcastEvent(
          targetUserId,
          'CREATOR_ROLE_REVOKED',
          'This stream has been closed by the platform.',
        );
        await broadcastEvent(targetUserId, 'STREAM_FORCE_CLOSED', 'Stream ended.');
      }
    }

    await prismaClient.user.update({
      where: { id: targetUserId },
      data: { platformRole: newRole },
    });

    return NextResponse.json({ message: `Role ${action}ed successfully` });
  } catch (error) {
    logger.error({ err: error }, '❌ Assign Creator API Error:');
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
