export const dynamic = 'force-dynamic';
import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/app/lib/auth";
import { getStreamRole, isOwner } from "@/app/lib/getSessionRole";
import { hasPermission } from "@/app/lib/permissions";

const HeartbeatSchema = z.object({
    creatorId: z.string(),
    currentTime: z.number().optional(),
    isPaused: z.boolean().optional(),
});

/**
 * POST /api/streams/heartbeat
 * Used by streamers to push state and listeners to pull state.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user?.email) {
            return NextResponse.json({ message: "Unauthenticated" }, { status: 403 });
        }

        const userId = (session.user as any).id;

        const user = await prismaClient.user.findUnique({
            where: { id: userId },
            select: { id: true, isBanned: true, bannedUntil: true, platformRole: true }
        });

        if (user?.isBanned) {
            const isPermanent = !user.bannedUntil;
            const isActive = user.bannedUntil ? new Date(user.bannedUntil) > new Date() : false;
            if (isPermanent || isActive) {
                return NextResponse.json({ message: "Account is banned" }, { status: 403 });
            }
        }

        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        const body = await req.json();
        const data = HeartbeatSchema.parse(body);

        // If it's the creator (or OWNER), update the state
        if ((userId === data.creatorId || (user as any)?.platformRole === "OWNER") && data.currentTime !== undefined) {
            const existing = await prismaClient.currentStream.findUnique({
                where: { userId: data.creatorId }
            });

            const timeDrift = Math.abs((existing?.currentTime ?? 0) - data.currentTime);
            const pauseChanged = existing?.isPaused !== data.isPaused;

            // Always update updatedAt to prevent listener staleness during pause
            await prismaClient.currentStream.upsert({
                    where: { userId: data.creatorId },
                    update: {
                        currentTime: data.currentTime,
                        isPaused: data.isPaused ?? false,
                        updatedAt: new Date(),
                    },
                    create: {
                        userId: data.creatorId,
                        currentTime: data.currentTime,
                        isPaused: data.isPaused ?? false,
                    },
                });
            return NextResponse.json({ message: "Heartbeat updated" });
        }

        // --- LISTENER / VIEWER LOGIC ---
        // 1. Fetch current state and previous activity
        const [currentStream, listenerActivity, creator, streamRole] = await Promise.all([
            prismaClient.currentStream.findUnique({
                where: { userId: data.creatorId },
                include: { stream: true }
            }),
            prismaClient.listeningActivity.findUnique({
                where: { userId: user.id }
            }),
            prismaClient.user.findUnique({
                where: { id: data.creatorId },
                select: { isPublic: true }
            }),
            getStreamRole(user.id, data.creatorId)
        ]);

        if (streamRole === "BANNED") {
            return NextResponse.json({ message: "Access restricted" }, { status: 403 });
        }

        if (streamRole === "GUEST" && creator && !creator.isPublic) {
            // If private and guest (no access), block sync
            return NextResponse.json({ message: "Access restricted" }, { status: 403 });
        }

        if (!currentStream) {
            return NextResponse.json({ message: "No active stream" }, { status: 404 });
        }

        // 2. Fetch pending events since last heartbeat
        const lastSeen = listenerActivity?.updatedAt ?? new Date(Date.now() - 30000); // 30s window fallback
        const pendingEvents = await prismaClient.streamEvent.findMany({
            where: {
                creatorId: data.creatorId,
                createdAt: { gt: lastSeen },
                expiresAt: { gt: new Date() }
            },
            orderBy: { createdAt: "asc" }
        });

        // 3. Update activity and viewer count (if not OWNER)
        if ((user.platformRole as any) !== "OWNER") {
            const activeStream = currentStream?.stream;

            await prismaClient.listeningActivity.upsert({
                where: { userId: user.id },
                update: { 
                    creatorId: data.creatorId, 
                    songTitle: activeStream?.title ?? null,
                    songId: activeStream?.extractedId ?? null,
                    updatedAt: new Date() 
                },
                create: { 
                    userId: user.id, 
                    creatorId: data.creatorId,
                    songTitle: activeStream?.title ?? null,
                    songId: activeStream?.extractedId ?? null
                }
            });

            const activeCount = await prismaClient.listeningActivity.count({
                where: {
                    creatorId: data.creatorId,
                    updatedAt: { gte: new Date(Date.now() - 10000) }
                }
            });

            await prismaClient.currentStream.update({
                where: { userId: data.creatorId },
                data: { viewerCount: activeCount }
            });
        }

        // 4. Return sync data and events
        const serverNow = Date.now();
        const updatedAtTs = new Date(currentStream.updatedAt).getTime();
        const serverStaleness = (serverNow - updatedAtTs) / 1000;
        const serverComputedTime = currentStream.isPaused
            ? currentStream.currentTime
            : currentStream.currentTime + serverStaleness;

        return NextResponse.json({
            currentTime: currentStream.currentTime,
            computedTime: serverComputedTime,
            isPaused: currentStream.isPaused,
            updatedAt: currentStream.updatedAt,
            viewerCount: currentStream.viewerCount,
            actualViewerCount: currentStream.viewerCount,
            stream: currentStream.stream,
            isPublic: creator?.isPublic ?? true,
            events: pendingEvents
        });


    } catch (e) {
        console.error("❌ Heartbeat API Error:", e);
        return NextResponse.json({ message: "Heartbeat failed" }, { status: 500 });
    }
}

