export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";
import { getStreamRole } from "@/app/lib/getSessionRole";
import { hasPermission } from "@/app/lib/permissions";
import { broadcastEvent } from "@/app/lib/broadcastEvent";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const callerId = (session?.user as any)?.id;

        if (!callerId) {
            return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });
        }

        const { targetUserId, creatorId, type, duration, reason } = await req.json();

        if (!targetUserId || !creatorId || !type) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
        }

        const role = await getStreamRole(callerId, creatorId);
        if (!hasPermission(role, "session:ban:stream")) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        if (type === "unban") {
            await prismaClient.sessionMember.update({
                where: { userId_creatorId: { userId: targetUserId, creatorId } },
                data: {
                    isBanned: false,
                    bannedUntil: null,
                    banReason: null,
                }
            });
            return NextResponse.json({ message: "Restriction lifted" });
        }

        const durationMap: Record<string, number | null> = {
            "1m": 60 * 1000,
            "1h": 60 * 60 * 1000,
            "1d": 24 * 60 * 60 * 1000,
            "1w": 7 * 24 * 60 * 60 * 1000,
            "1mo": 30 * 24 * 60 * 60 * 1000,
            "permanent": null
        };
        
        const ms = durationMap[duration] ?? null;
        const bannedUntil = (type === "timeout" && ms !== null)
            ? new Date(Date.now() + ms)
            : null;

        await prismaClient.sessionMember.upsert({
            where: { userId_creatorId: { userId: targetUserId, creatorId } },
            update: {
                role: "MEMBER",
                isBanned: type === "ban",
                bannedUntil: type === "timeout" ? bannedUntil : null,
                banReason: reason ?? null,
                bannedAt: new Date(),
            },
            create: {
                userId: targetUserId,
                creatorId,
                role: "MEMBER",
                isBanned: type === "ban",
                bannedUntil: type === "timeout" ? bannedUntil : null,
                banReason: reason ?? null,
                bannedAt: new Date(),
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
    } catch (error) {
        console.error("❌ Stream Ban API Error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

