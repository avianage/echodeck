import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { prismaClient } from '@/app/lib/db';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });

  try {
    const { image } = await req.json();

    if (image === null) {
      await prismaClient.user.update({
        where: { id: userId },
        data: { image: null },
      });
      return NextResponse.json({ message: 'Avatar reset to default', image: null });
    }

    if (!image) {
      return NextResponse.json({ message: 'Image URL or null is required' }, { status: 400 });
    }

    // Basic validation for trusted sources - allow owner special or dicebear
    const isOwnerAvatar = image === '/avatars/owner_avatar.png';
    const _isDiceBear = image.startsWith('https://api.dicebear.com/');

    // If it's not a dicebear or owner avatar, we'll still allow it but with a warning or just allow it
    // for now as the user requested "if not selected... keep default", but we want to allow
    // them to set it back to what it was or a new one.

    if (isOwnerAvatar) {
      const user = await prismaClient.user.findUnique({
        where: { id: userId },
        select: { platformRole: true },
      });
      if ((user?.platformRole as 'OWNER' | 'MEMBER') !== 'OWNER') {
        return NextResponse.json({ message: 'Only owners can use this avatar' }, { status: 403 });
      }
    }

    await prismaClient.user.update({
      where: { id: userId },
      data: { image },
    });

    return NextResponse.json({
      message: 'Profile picture updated successfully',
      image,
    });
  } catch (err: unknown) {
     
    logger.error({ err: err }, 'Failed to update profile picture:');
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
