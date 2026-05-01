import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { z } from 'zod';

const UpdateUsernameSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores allowed'),
});

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
      const daysLeft = Math.ceil(30 - daysSince);
      return NextResponse.json(
        {
          message: `Username can be updated in ${daysLeft} more day(s)`,
        },
        { status: 429 },
      );
    }
  }

  const body = await req.json();
  const { username } = UpdateUsernameSchema.parse(body);

  // Keep existing regex check for backward compatibility
  const valid = /^[a-z0-9_]{5,}$/.test(username);
  if (!valid) {
    return NextResponse.json(
      {
        message:
          username.length < 5
            ? 'Must be at least 5 characters'
            : 'Only lowercase letters, numbers, and underscores allowed',
      },
      { status: 400 },
    );
  }

  const existing = await prismaClient.user.findUnique({ where: { username } });
  if (existing && existing.id !== userId) {
    return NextResponse.json({ message: 'Username already taken' }, { status: 409 });
  }

  await prismaClient.user.update({
    where: { id: userId },
    data: { username, usernameUpdatedAt: new Date() },
  });

  return NextResponse.json({ message: 'Username updated successfully' });
}
