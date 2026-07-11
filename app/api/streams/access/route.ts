import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { isRateLimited } from '@/app/lib/rateLimit';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const AccessSchema = z.object({
  streamerId: z.string().min(1, 'streamerId is required'),
  action: z.enum(['approve', 'reject', 'request']),
  viewerId: z.string().min(1, 'viewerId is required'),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
  }

  const user = await prismaClient.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

  const creatorId = req.nextUrl.searchParams.get('creatorId') || user.id;
  const role = await getStreamRole(user.id, creatorId);

  if (!hasPermission(role, 'access:manage')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  const requests = await prismaClient.streamAccess.findMany({
    where: {
      streamerId: creatorId,
      status: 'PENDING',
    },
    include: {
      viewer: {
        select: { id: true, username: true },
      },
    },
  });

  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { streamerId, action, viewerId } = AccessSchema.parse(body);
    const user = await prismaClient.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

    if (action === 'request') {
      if (isRateLimited(`access-request:${user.id}:${streamerId}`, 5, 60 * 1000)) {
        return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
      }

      await prismaClient.streamAccess.upsert({
        where: {
          streamerId_viewerId: {
            streamerId,
            viewerId: user.id,
          },
        },
        update: { status: 'PENDING' },
        create: {
          streamerId,
          viewerId: user.id,
          status: 'PENDING',
        },
      });
      return NextResponse.json({ message: 'Request sent' });
    }

    if (action === 'approve' || action === 'reject') {
      const role = await getStreamRole(user.id, streamerId);
      if (!hasPermission(role, 'access:manage')) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
      }

      try {
        await prismaClient.streamAccess.update({
          where: {
            streamerId_viewerId: {
              streamerId,
              viewerId,
            },
          },
          data: {
            status: action === 'approve' ? 'APPROVED' : 'REJECTED',
          },
        });
      } catch (updateErr) {
        if (
          updateErr instanceof Prisma.PrismaClientKnownRequestError &&
          updateErr.code === 'P2025'
        ) {
          return NextResponse.json({ message: 'Access request not found' }, { status: 404 });
        }
        throw updateErr;
      }
      return NextResponse.json({ message: `Access ${action}d` });
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.errors[0]?.message || 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Error processing access' }, { status: 500 });
  }
}
