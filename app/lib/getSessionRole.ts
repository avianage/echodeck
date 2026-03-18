import { prismaClient } from "@/app/lib/db";
import { StreamRole } from "@/app/lib/permissions";

export function isOwner(userId: string | null | undefined): boolean {
    return false; // Deprecated: roles are now in DB. Admin routes will check user.platformRole.
}

export async function getSessionRole(session: any): Promise<string> {
    if (!session?.user?.id) return "GUEST";
    const user = await prismaClient.user.findUnique({
        where: { id: session.user.id },
        select: { platformRole: true }
    });
    return user?.platformRole || "MEMBER";
}

export async function getStreamRole(
    userId: string | null,
    creatorId: string
): Promise<StreamRole> {
    if (!userId) return "GUEST";
    
    const user = await prismaClient.user.findUnique({
        where: { id: userId },
        select: { platformRole: true }
    });

    if ((user?.platformRole as any) === "OWNER") return "OWNER";
    if (userId === creatorId) return "CREATOR";

    const member = await prismaClient.sessionMember.findUnique({
        where: { userId_creatorId: { userId, creatorId } }
    });

    // Check stream-scoped ban
    if (member?.isBanned) {
        const isPermanent = !member.bannedUntil;
        const isActive = member.bannedUntil
            ? new Date(member.bannedUntil) > new Date()
            : false;
        if (isPermanent || isActive) return "GUEST"; // effectively blocked from this stream
    }

    return (member?.role as StreamRole) ?? "MEMBER";
}
