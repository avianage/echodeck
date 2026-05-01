import { getServerSession } from 'next-auth';
import { prismaClient } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/lib/auth';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;

  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Clear is typically for the streamer's own queue
  const role = await getStreamRole(userId, userId);

  if (!hasPermission(role, 'queue:clear')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
  }

  await prismaClient.stream.deleteMany({
    where: {
      userId: userId,
    },
  });

  return new Response(null, { status: 204 }); // was: 200, now: 204 (deletion)
}
