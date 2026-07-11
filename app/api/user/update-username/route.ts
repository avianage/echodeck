import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { isUniqueConstraintError } from '@/app/lib/prismaErrors';
import { usernameError } from '@/app/lib/username';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const user = await prismaClient.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

  // Enforce cooldown from env var (default 30 days)
  const cooldownDays = parseInt(process.env.USERNAME_COOLDOWN_DAYS || '30', 10);
  if (user.usernameUpdatedAt) {
    const daysSince = (Date.now() - user.usernameUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < cooldownDays) {
      const daysLeft = Math.ceil(cooldownDays - daysSince);
      return NextResponse.json(
        {
          message: `Username can be updated in ${daysLeft} more day(s)`,
        },
        { status: 429 },
      );
    }
  }

  const body = await req.json();
  const { username } = body ?? {};

  const validationError = usernameError(username);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  const existing = await prismaClient.user.findUnique({ where: { username } });
  if (existing && existing.id !== userId) {
    return NextResponse.json({ message: 'Username already taken' }, { status: 409 });
  }

  try {
    await prismaClient.user.update({
      where: { id: userId },
      data: { username, usernameUpdatedAt: new Date() },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return NextResponse.json({ message: 'Username already taken' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ message: 'Username updated successfully' });
}
