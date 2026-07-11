export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { prismaClient } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { isRateLimited } from '@/app/lib/rateLimit';
import { broadcastToStream } from '@/app/lib/sseManager';

interface SessionUser {
  id?: string;
  name?: string | null;
  image?: string | null;
}

const SendMessageSchema = z.object({
  creatorId: z.string(),
  message: z.string().min(1).max(500),
});

async function checkPrivateAccess(userId: string, creatorId: string) {
  if (userId === creatorId) return true;
  const creator = await prismaClient.user.findUnique({
    where: { id: creatorId },
    select: { isPublic: true },
  });
  if (!creator || creator.isPublic) return true;
  const access = await prismaClient.streamAccess.findUnique({
    where: { streamerId_viewerId: { streamerId: creatorId, viewerId: userId } },
  });
  return access?.status === 'APPROVED';
}

// GET: last 50 non-deleted messages, for a client joining mid-stream — the
// SSE connection (app/lib/sseManager.ts) only delivers messages sent after
// it connects, so history has to be fetched separately.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const creatorId = req.nextUrl.searchParams.get('creatorId');
  if (!creatorId) {
    return NextResponse.json({ message: 'creatorId is required' }, { status: 400 });
  }

  const role = await getStreamRole(userId, creatorId);
  if (role === 'BANNED') {
    return NextResponse.json({ message: 'Access restricted' }, { status: 403 });
  }
  if (!(await checkPrivateAccess(userId, creatorId))) {
    return NextResponse.json({ message: 'Access denied' }, { status: 403 });
  }

  const before = req.nextUrl.searchParams.get('before');
  const beforeDate = before ? new Date(before) : null;

  const [messages, currentStream] = await Promise.all([
    prismaClient.chatMessage.findMany({
      where: {
        creatorId,
        deletedAt: null,
        ...(beforeDate && !isNaN(beforeDate.getTime()) ? { createdAt: { lt: beforeDate } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { id: true, username: true, displayName: true, image: true } } },
    }),
    beforeDate
      ? null
      : prismaClient.currentStream.findUnique({
          where: { userId: creatorId },
          select: { slowModeSeconds: true, pinnedMessageId: true },
        }),
  ]);

  let pinnedMessage = null;
  if (currentStream?.pinnedMessageId) {
    pinnedMessage = await prismaClient.chatMessage.findUnique({
      where: { id: currentStream.pinnedMessageId },
      include: { user: { select: { id: true, username: true, displayName: true, image: true } } },
    });
  }

  return NextResponse.json({
    messages: messages.reverse(),
    hasMore: messages.length === 50,
    slowModeSeconds: currentStream?.slowModeSeconds ?? 0,
    pinnedMessage,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const rateKey = `chat:${userId}`;
  if (isRateLimited(rateKey, 20, 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const parsed = SendMessageSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
  }
  const { creatorId, message } = parsed.data;

  const role = await getStreamRole(userId, creatorId);
  if (!hasPermission(role, 'chat:send')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }
  if (!(await checkPrivateAccess(userId, creatorId))) {
    return NextResponse.json({ message: 'Access denied' }, { status: 403 });
  }

  // Slow mode: an additional per-user cooldown on top of the flat limit
  // above, only for non-moderators — mods/creator/owner bypass it, matching
  // standard streaming-platform behavior.
  if (!hasPermission(role, 'chat:moderate')) {
    const currentStream = await prismaClient.currentStream.findUnique({
      where: { userId: creatorId },
      select: { slowModeSeconds: true },
    });
    const slowModeSeconds = currentStream?.slowModeSeconds ?? 0;
    if (
      slowModeSeconds > 0 &&
      isRateLimited(`chat-slow:${creatorId}:${userId}`, 1, slowModeSeconds * 1000)
    ) {
      return NextResponse.json(
        { message: `Slow mode is on — wait ${slowModeSeconds}s between messages` },
        { status: 429 },
      );
    }
  }

  const chatMessage = await prismaClient.chatMessage.create({
    data: { creatorId, userId, message },
    include: { user: { select: { id: true, username: true, displayName: true, image: true } } },
  });

  broadcastToStream(creatorId, { type: 'chat', message: chatMessage });

  return NextResponse.json({ message: chatMessage }, { status: 201 });
}
