import { prismaClient } from '@/app/lib/db';
import { StreamRole } from '@/app/lib/permissions';

export function isOwner(_userId: string | null | undefined): boolean {
  throw new Error('isOwner() is deprecated. Use OWNER role check via DB instead.');
}

export async function getSessionRole(session: { user?: { id?: string } } | null): Promise<string> {
  if (!session?.user?.id) return 'GUEST';
  const user = await prismaClient.user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true },
  });
  return user?.platformRole || 'MEMBER';
}

export async function getStreamRole(userId: string | null, creatorId: string): Promise<StreamRole> {
  if (!userId) return 'GUEST';

  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { platformRole: true, isBanned: true, bannedUntil: true },
  });

  if (user?.isBanned || (user?.bannedUntil && new Date(user.bannedUntil) > new Date())) {
    return 'BANNED';
  }

  if ((user?.platformRole as string) === 'OWNER') return 'OWNER';
  if (userId === creatorId) return 'CREATOR';

  const member = await prismaClient.sessionMember.findUnique({
    where: { userId_creatorId: { userId, creatorId } },
  });

  // Check stream-scoped restriction
  if (member) {
    const isPermanent = member.isBanned;
    const now = Date.now();
    const bannedUntilTime = member.bannedUntil ? new Date(member.bannedUntil).getTime() : 0;
    const isTimedOut = bannedUntilTime > now;

    if (isPermanent || isTimedOut) {
      return 'BANNED';
    }
  }

  return (member?.role as StreamRole) ?? 'MEMBER';
}
