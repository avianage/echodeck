export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prismaClient } from '@/app/lib/db';
import { usernameError } from '@/app/lib/username';

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username');
  if (!username) return NextResponse.json({ available: false, reason: 'Missing username' });

  const reason = usernameError(username);
  if (reason) {
    return NextResponse.json({ available: false, reason });
  }

  const existing = await prismaClient.user.findUnique({ where: { username } });
  return NextResponse.json({
    available: !existing,
    reason: existing ? 'Username already taken' : null,
  });
}
