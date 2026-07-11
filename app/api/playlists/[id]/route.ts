export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { prismaClient } from '@/app/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/app/lib/auth';

interface SessionUser {
  id?: string;
}

const RenameSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const parsed = RenameSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
  }

  const result = await prismaClient.playlist.updateMany({
    where: { id, userId },
    data: { name: parsed.data.name },
  });

  if (result.count === 0) {
    return NextResponse.json({ message: 'Playlist not found' }, { status: 404 });
  }

  return NextResponse.json({ message: 'Renamed' });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as SessionUser)?.id ?? null;
  if (!userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const result = await prismaClient.playlist.deleteMany({ where: { id, userId } });

  if (result.count === 0) {
    return NextResponse.json({ message: 'Playlist not found' }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
