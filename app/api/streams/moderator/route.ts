export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";
import { getStreamRole } from "@/app/lib/getSessionRole";
import { hasPermission } from "@/app/lib/permissions";
import { broadcastEvent } from "@/app/lib/broadcastEvent";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

    const { targetUserId, creatorId, action } = await req.json();
    // action: "promote" | "demote"

    if (!targetUserId || !creatorId || !["promote", "demote"].includes(action)) {
        return NextResponse.json({ message: "Invalid request" }, { status: 400 });
    }

    if (targetUserId === userId) {
        return NextResponse.json({ message: "Cannot modify your own role" }, { status: 400 });
    }

    const role = await getStreamRole(userId, creatorId);
    if (!hasPermission(role, "session:promote:mod")) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const [targetUser, callerUser] = await Promise.all([
        prismaClient.user.findUnique({ where: { id: targetUserId }, select: { username: true } }),
        prismaClient.user.findUnique({ where: { id: userId }, select: { username: true } })
    ]);

    const targetUsername = targetUser?.username || "Someone";
    const callerUsername = callerUser?.username || "A moderator";

    // Ensure requester is the stream creator (uses their own stream i.e. userId = creatorId)
    const newRole = action === "promote" ? "MODERATOR" : "MEMBER";

    // Upsert the SessionMember record for this viewer in the creator's stream
    await prismaClient.sessionMember.upsert({
        where: {
            userId_creatorId: {
                userId: targetUserId,
                creatorId
            }
        },
        update: { role: newRole },
        create: {
            userId: targetUserId,
            creatorId,
            role: newRole
        }
    });

    // Broadcast an event to the target user
    if (action === "promote") {
        await broadcastEvent(creatorId, "MOD_PROMOTED", `@${targetUsername} has been promoted to moderator by @${callerUsername}.`);
    } else {
        await broadcastEvent(creatorId, "MOD_DEMOTED", targetUserId);
    }

    return NextResponse.json({
        message: action === "promote" ? "User promoted to moderator" : "Moderator role removed"
    });
}

