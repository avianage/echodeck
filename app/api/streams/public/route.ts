import { NextResponse } from 'next/server';
import { prismaClient } from '@/app/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    // Consider streams "live" if their heartbeat updated within the last 2 minutes
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const currentStreams = await prismaClient.currentStream.findMany({
      where: {
        user: { isPublic: true },
        updatedAt: { gt: twoMinutesAgo },
        streamId: { not: null },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            image: true,
            partyCode: true,
          },
        },
        stream: true,
      },
      orderBy: {
        viewerCount: 'desc',
      },
    });

    const streams = currentStreams.map((cs) => ({
      ...(cs.stream ?? {}),
      title: cs.title || cs.stream?.title || '',
      user: cs.user,
      currentStream: {
        viewerCount: cs.viewerCount,
      },
    }));

    return NextResponse.json({ streams });
  } catch (error) {
     
    logger.error({ err: error }, 'Error fetching public streams:');
    return NextResponse.json({ message: 'Error fetching public streams' }, { status: 500 });
  }
}
