import { prismaClient } from '@/app/lib/db';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
    }

    const { videoId } = await req.json();
    if (!videoId) {
      return NextResponse.json({ message: 'Video ID required' }, { status: 400 });
    }

    // Add to blocked videos table
    await prismaClient.blockedVideo.upsert({
      where: { videoId },
      update: {},
      create: { videoId },
    });

    // Also mark any existing stream as played/inactive if needed
    // but the main goal is to prevent re-queuing

    return NextResponse.json({ message: 'Video blocked successfully' });
  } catch (error: unknown) {
     
    logger.error({ err: error }, 'Error blocking video:');
    return NextResponse.json({ message: 'Error blocking video' }, { status: 500 });
  }
}
