import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { isOwner } from "@/app/lib/getSessionRole";
import { prismaClient } from "@/app/lib/db";
import { broadcastEvent } from "@/app/lib/broadcastEvent";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

    const user = await prismaClient.user.findUnique({
        where: { id: userId },
        select: { platformRole: true }
    });

    if ((user?.platformRole as any) !== "OWNER") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { targetUserId, action } = await req.json();

    if (targetUserId === userId) {
        return NextResponse.json({ message: "Owners cannot modify their own platform role" }, { status: 400 });
    }

    // action: "assign" | "revoke"

    if (!["assign", "revoke"].includes(action)) {
        return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }

    const newRole = action === "assign" ? "CREATOR" : "MEMBER";

    // If revoking creator, close their active stream immediately
    if (action === "revoke") {
        const activeStream = await prismaClient.stream.findFirst({
            where: { userId: targetUserId, isLive: true }
        });
        if (activeStream) {
            await prismaClient.stream.update({
                where: { id: activeStream.id },
                data: { isLive: false, endedAt: new Date() }
            });
            await prismaClient.currentStream.deleteMany({
                where: { userId: targetUserId }
            });
            // Queue toast broadcast for stream force-closed
            await broadcastEvent(targetUserId, "CREATOR_ROLE_REVOKED", "This stream has been closed by the platform.");
            await broadcastEvent(targetUserId, "STREAM_FORCE_CLOSED", "Stream ended.");
        }
    }

    await prismaClient.user.update({
        where: { id: targetUserId },
        data: { platformRole: newRole }
    });

    return NextResponse.json({ message: `Role ${action}ed successfully` });
}
