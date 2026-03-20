import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";
import { isOwner } from "@/app/lib/getSessionRole";
import { broadcastEvent } from "@/app/lib/broadcastEvent";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const callerId = (session?.user as any)?.id;

        if (!callerId) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

        // Verify OWNER role from DB
        const caller = await prismaClient.user.findUnique({
            where: { id: callerId },
            select: { platformRole: true }
        });

        if ((caller?.platformRole as any) !== "OWNER") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        const { targetUserId, type, duration, reason } = await req.json();

        if (targetUserId === callerId) {
            return NextResponse.json({ message: "Owners cannot restrict their own account" }, { status: 400 });
        }

        if (type === "unban") {
            await prismaClient.user.update({
                where: { id: targetUserId },
                data: {
                    isBanned: false,
                    bannedUntil: null,
                    banReason: null,
                }
            });
            return NextResponse.json({ message: "Platform restriction lifted" });
        }

        const durationMap: Record<string, number | null> = {
            "1d": 1, "1w": 7, "1m": 30, "permanent": null
        };

        const days = durationMap[duration] ?? null;
        const bannedUntil = (type === "timeout" && days !== null)
            ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
            : null;

        await prismaClient.user.update({
            where: { id: targetUserId },
            data: {
                isBanned: type === "ban",
                bannedUntil: type === "timeout" ? bannedUntil : null,
                banReason: reason ?? null,
            }
        });

        // If banning, invalidate their active sessions
        if (type === "ban") {
            await prismaClient.session.deleteMany({ where: { userId: targetUserId } });
        }

        // Broadcast toast
        const targetUser = await prismaClient.user.findUnique({
            where: { id: targetUserId },
            select: { username: true }
        });

        const activeStream = await prismaClient.currentStream.findFirst({
            where: { 
                OR: [
                    { userId: targetUserId }, // If they are the creator
                    { user: { sessionMembers: { some: { userId: targetUserId } } } } // If they are in someone's stream
                ]
            },
            select: { userId: true } // This userId is the creatorId
        });

        if (activeStream && targetUser) {
            await broadcastEvent(
                activeStream.userId,
                type === "ban" ? "USER_BANNED_PLATFORM" : "USER_TIMED_OUT_PLATFORM",
                type === "ban"
                    ? `@${targetUser.username} has been removed from the platform`
                    : `@${targetUser.username} has been temporarily restricted`
            );
        }

        return NextResponse.json({ 
            message: `User ${type === "ban" ? "banned" : "timed out"} successfully` 
        });
    } catch (error) {
        console.error("❌ Platform Ban API Error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
