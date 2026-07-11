import { getServerSession } from 'next-auth';
import { prismaClient } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { broadcastToStream } from '@/app/lib/sseManager';

interface SessionUser {
  id?: string;
}

const PinSchema = z.object({
  pinned: z.boolean(),
});

// Pin/unpin a message to the top of chat — creator/mod only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { pinned } = PinSchema.parse(await req.json());

  const chatMessage = await prismaClient.chatMessage.findUnique({
    where: { id },
    include: { user: { select: { id: true, username: true, displayName: true, image: true } } },
  });
  if (!chatMessage || chatMessage.deletedAt) {
    return NextResponse.json({ message: 'Message not found' }, { status: 404 });
  }

  const role = await getStreamRole(userId, chatMessage.creatorId);
  if (!hasPermission(role, 'chat:moderate')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  await prismaClient.currentStream.upsert({
    where: { userId: chatMessage.creatorId },
    update: { pinnedMessageId: pinned ? chatMessage.id : null },
    create: { userId: chatMessage.creatorId, pinnedMessageId: pinned ? chatMessage.id : null },
  });

  broadcastToStream(chatMessage.creatorId, {
    type: 'chat_pinned',
    message: pinned ? chatMessage : null,
  });

  return NextResponse.json({ pinnedMessage: pinned ? chatMessage : null });
}

// Soft-delete (moderation), not a hard delete — keeps a record for the
// moderation audit trail while removing the message from clients live.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const chatMessage = await prismaClient.chatMessage.findUnique({ where: { id } });
  if (!chatMessage || chatMessage.deletedAt) {
    return NextResponse.json({ message: 'Message not found' }, { status: 404 });
  }

  const role = await getStreamRole(userId, chatMessage.creatorId);
  const isOwnMessage = chatMessage.userId === userId;
  if (!isOwnMessage && !hasPermission(role, 'chat:moderate')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  await prismaClient.chatMessage.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  broadcastToStream(chatMessage.creatorId, { type: 'chat_deleted', id });

  return new Response(null, { status: 204 });
}
