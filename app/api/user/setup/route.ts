import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import type { PlatformRole } from '@prisma/client';
import { logger } from '@/lib/logger';
import { isUniqueConstraintError } from '@/app/lib/prismaErrors';
import { usernameError } from '@/app/lib/username';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  const { username, displayName, role } = await req.json();

  const usernameValidationError = usernameError(username);
  if (usernameValidationError) {
    return NextResponse.json({ message: usernameValidationError }, { status: 400 });
  }

  if (displayName !== undefined && typeof displayName !== 'string') {
    return NextResponse.json({ message: 'Invalid display name' }, { status: 400 });
  }
  const trimmedDisplayName = displayName?.trim().slice(0, 50);

  const existing = await prismaClient.user.findUnique({ where: { username } });
  if (existing && existing.id !== userId) {
    return NextResponse.json({ message: 'Username already taken' }, { status: 409 });
  }

  // Auto-bootstrap: If no owner exists in the system, the first user to setup becomes the owner.
  // This bypasses build-time env var issues and ensures the platform can be initialized easily.
  const ownerCount = await prismaClient.user.count({
    where: { platformRole: 'OWNER' },
  });

  const isFirstOwner = ownerCount === 0;
  const allowOwnerCreation = process.env.ALLOW_OWNER_CREATION === 'true';

  // User becomes owner if they are the first one OR if the manual toggle is on and they selected it.
  const finalRole = isFirstOwner || (role === 'OWNER' && allowOwnerCreation) ? 'OWNER' : 'MEMBER';

   
  logger.info(`👤 Setting up user ${userId} with role ${finalRole} (First owner: ${isFirstOwner})`);

  // The findUnique check above doesn't stop two users racing to claim the
  // same username; the DB's unique constraint on `username` is the real
  // guard, so catch its violation here instead of letting the race surface
  // as an unhandled 500.
  try {
    await prismaClient.user.update({
      where: { id: userId },
      data: {
        username,
        displayName: trimmedDisplayName || username,
        platformRole: finalRole as PlatformRole,
        usernameUpdatedAt: new Date(),
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return NextResponse.json({ message: 'Username already taken' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ message: 'Setup complete', role: finalRole });
}
