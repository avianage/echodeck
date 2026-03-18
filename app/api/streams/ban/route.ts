import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";
import { getStreamRole } from "@/app/lib/getSessionRole";
import { hasPermission } from "@/app/lib/permissions";
import { broadcastEvent } from "@/app/lib/broadcastEvent";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const callerId = (session?.user as any)?.id;

    const { targetUserId, creatorId, type, duration, reason } = await req.json();

    const role = await getStreamRole(callerId, creatorId);
    if (!hasPermission(role, "session:ban:stream")) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const durationMap: Record<string, number | null> = {
        "1d": 1, "1w": 7, "1m": 30, "permanent": null
    };
    const days = durationMap[duration];
    const bannedUntil = days !== null
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
        : null;

    await prismaClient.sessionMember.upsert({
        where: { userId_creatorId: { userId: targetUserId, creatorId } },
        update: {
            isBanned: type === "ban",
            bannedUntil: type === "timeout" ? bannedUntil : null,
            banReason: reason ?? null,
        },
        create: {
            userId: targetUserId,
            creatorId,
            role: "MEMBER",
            isBanned: type === "ban",
            bannedUntil: type === "timeout" ? bannedUntil : null,
            banReason: reason ?? null,
        }
    });

    const targetUser = await prismaClient.user.findUnique({
        where: { id: targetUserId },
        select: { username: true }
    });

    if (targetUser) {
        await broadcastEvent(
            creatorId,
            type === "ban" ? "USER_BANNED_STREAM" : "USER_TIMED_OUT_STREAM",
            type === "ban"
                ? `@${targetUser.username} has been removed from this stream`
                : `@${targetUser.username} has been timed out from this stream`
        );
    }

    return NextResponse.json({ message: "Action applied" });
}
