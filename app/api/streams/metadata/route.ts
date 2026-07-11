export const dynamic = 'force-dynamic';
import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { broadcastToStream } from '@/app/lib/sseManager';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const MetadataSchema = z.object({
  streamId: z.string().optional(),
  creatorId: z.string().optional(),
  title: z.string().max(100).optional(),
  genre: z.string().optional(),
  isPublic: z.boolean().optional(),
  clearQueue: z.boolean().optional(),
  mode: z.enum(['BROADCAST', 'JAM']).optional(),
  slowModeSeconds: z.number().int().min(0).max(300).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  const body = MetadataSchema.parse(await req.json());
  const { streamId, creatorId, title, genre, isPublic, clearQueue, mode, slowModeSeconds } = body;
  const userId = session.user.id as string;

  try {
    if (streamId) {
      // Existing behaviour: update by streamId (used inside active stream)
      const stream = await prismaClient.stream.findUnique({ where: { id: streamId } });
      if (!stream) return NextResponse.json({ message: 'Stream not found' }, { status: 404 });

      const streamRole = await getStreamRole(userId, stream.userId);
      if (!hasPermission(streamRole, 'stream:update')) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
      }

      // isPublic lives on Stream/User, not CurrentStream — passing it here
      // was an invalid-field Prisma error that also crashed the logger's
      // error serializer trying to normalize the resulting error object.
      await prismaClient.currentStream.upsert({
        where: { userId: stream.userId },
        update: {
          ...(title !== undefined ? { title } : {}),
          ...(genre !== undefined ? { genre } : {}),
          ...(slowModeSeconds !== undefined ? { slowModeSeconds } : {}),
        },
        create: { userId: stream.userId, streamId: stream.id, title, genre, slowModeSeconds },
      });

      if (slowModeSeconds !== undefined) {
        broadcastToStream(stream.userId, { type: 'slow_mode_changed', slowModeSeconds });
      }

      // Also update the Stream record for discover page
      await prismaClient.stream.update({
        where: { id: streamId },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(genre !== undefined ? { genre } : {}),
          ...(isPublic !== undefined ? { isPublic } : {}),
        },
      });
    } else if (creatorId) {
      // Lightweight session-settings update (e.g. slow mode) that doesn't
      // require re-sending the whole "set up your stream" form — used by
      // StreamManagement, which may not have a currently-playing streamId
      // and may be a moderator acting on someone else's room.
      const streamRole = await getStreamRole(userId, creatorId);
      if (!hasPermission(streamRole, 'stream:update')) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
      }

      await prismaClient.currentStream.upsert({
        where: { userId: creatorId },
        update: {
          ...(title !== undefined ? { title } : {}),
          ...(genre !== undefined ? { genre } : {}),
          ...(slowModeSeconds !== undefined ? { slowModeSeconds } : {}),
        },
        create: { userId: creatorId, title, genre, slowModeSeconds },
      });

      if (slowModeSeconds !== undefined) {
        broadcastToStream(creatorId, { type: 'slow_mode_changed', slowModeSeconds });
      }
    } else {
      // Pre-start: set metadata before navigating to /stream
      if (!title?.trim()) {
        return NextResponse.json({ message: 'Title is required' }, { status: 400 });
      }

      // Handle Clear Queue
      if (clearQueue) {
        await prismaClient.stream.deleteMany({
          where: { userId, played: false },
        });
      }

      // Update User visibility preference
      if (isPublic !== undefined) {
        await prismaClient.user.update({
          where: { id: userId },
          data: { isPublic },
        });
      }

      // Find the creator's most recent stream (or any stream for them)
      const existingStream = await prismaClient.stream.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      // mode is only ever set on create — fixed at session start, never
      // flipped mid-session (see prisma/schema.prisma comment on the field).
      await prismaClient.currentStream.upsert({
        where: { userId },
        update: { title, genre },
        create: {
          userId,
          streamId: existingStream?.id || null,
          title,
          genre,
          mode: mode ?? 'BROADCAST',
        },
      });

      // Update the Stream record for discover page visibility if it exists
      if (existingStream) {
        await prismaClient.stream.update({
          where: { id: existingStream.id },
          data: {
            ...(title !== undefined ? { title } : {}),
            ...(genre !== undefined ? { genre } : {}),
            ...(isPublic !== undefined ? { isPublic } : {}),
          },
        });
      }
    }

    return NextResponse.json({ message: 'Metadata updated successfully' });
  } catch (error) {
    logger.error({ err: error }, '❌ POST /api/streams/metadata failed:');
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  const userId = session.user.id as string;

  try {
    await prismaClient.currentStream.deleteMany({
      where: { userId },
    });
    return new Response(null, { status: 204 }); // was: 200, now: 204 (deletion)
  } catch (error) {
    logger.error({ err: error }, '❌ DELETE /api/streams/metadata failed:');
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
