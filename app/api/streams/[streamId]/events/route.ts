import { NextRequest } from 'next/server';
import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { addConnection, removeConnection } from '@/app/lib/sseManager';

export async function GET(req: NextRequest, { params }: { params: Promise<{ streamId: string }> }) {
  // streamId here is the creator's userId (same value, renamed to match
  // the existing [streamId] dynamic segment so Next.js doesn't conflict)
  const { streamId: creatorId } = await params;

  // Auth check
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return new Response('Unauthenticated', { status: 401 });
  }

  const userId = session.user.id as string;

  // Role / access check
  const role = await getStreamRole(userId, creatorId);
  if (role === 'BANNED') {
    return new Response('Access restricted', { status: 403 });
  }

  // Check stream visibility
  const creator = await prismaClient.user.findUnique({
    where: { id: creatorId },
    select: { isPublic: true },
  });

  if (!creator) {
    return new Response('Creator not found', { status: 404 });
  }

  if (!creator.isPublic && userId !== creatorId) {
    const access = await prismaClient.streamAccess.findUnique({
      where: {
        streamerId_viewerId: {
          streamerId: creatorId,
          viewerId: userId,
        },
      },
    });
    if (access?.status !== 'APPROVED') {
      return new Response('Access denied', { status: 403 });
    }
  }

  // Fetch current sync state to send immediately on connect
  const currentStream = await prismaClient.currentStream.findUnique({
    where: { userId: creatorId },
    include: { stream: true },
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Helper: write an SSE chunk
      const write = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      // Register this connection in the manager
      const writer = {
        write,
        close: () => {
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        },
      };
      addConnection(creatorId, writer);

      // 1. Immediate sync-state event on connect
      if (currentStream) {
        const serverNow = Date.now();
        const updatedAtTs = new Date(currentStream.updatedAt).getTime();
        const staleness = (serverNow - updatedAtTs) / 1000;
        const computedTime = currentStream.isPaused
          ? currentStream.currentTime
          : currentStream.currentTime + staleness;

        write(
          `data: ${JSON.stringify({
            currentTime: currentStream.currentTime,
            computedTime,
            isPaused: currentStream.isPaused,
            updatedAt: currentStream.updatedAt,
            stream: currentStream.stream,
            type: 'sync',
          })}\n\n`,
        );
      }

      // 2. 15-second keepalive ping to prevent proxy / browser timeouts
      const keepalive = setInterval(() => {
        try {
          write(`: keepalive\n\n`);
        } catch {
          clearInterval(keepalive);
        }
      }, 15_000);

      // 3. Cleanup when client disconnects
      req.signal.addEventListener('abort', () => {
        clearInterval(keepalive);
        removeConnection(creatorId, writer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disables nginx buffering if behind a proxy
    },
  });
}
