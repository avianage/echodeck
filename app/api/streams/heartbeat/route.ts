import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/app/lib/auth";

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

        const body = await req.json();
        const data = HeartbeatSchema.parse(body);

        // If it's the creator, update the state
        if (userId === data.creatorId && data.currentTime !== undefined) {
            const existing = await prismaClient.currentStream.findUnique({
                where: { userId: data.creatorId }
            });

            const timeDrift = Math.abs((existing?.currentTime ?? 0) - data.currentTime);
            const pauseChanged = existing?.isPaused !== data.isPaused;

            if (timeDrift > 1 || pauseChanged || !existing) {
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
            }
            return NextResponse.json({ message: "Heartbeat updated" });
        }

        // If it's a listener (or anyone else), return the current state
        const currentStream = await prismaClient.currentStream.findUnique({
            where: { userId: data.creatorId },
            include: { stream: true }
        }) as any;

        if (!currentStream) {
            return NextResponse.json({ message: "No active stream" }, { status: 404 });
        }

        // Calculate server-side offset so client clock skew doesn't matter
        const serverNow = Date.now();
        const updatedAt = new Date(currentStream.updatedAt).getTime();
        const serverStaleness = (serverNow - updatedAt) / 1000;
        const serverComputedTime = currentStream.isPaused
            ? currentStream.currentTime
            : currentStream.currentTime + serverStaleness;

        return NextResponse.json({
            currentTime: currentStream.currentTime,
            computedTime: serverComputedTime,
            isPaused: currentStream.isPaused,
            updatedAt: currentStream.updatedAt,
            stream: currentStream.stream
        });


    } catch (e) {
        console.error("❌ Heartbeat API Error:", e);
        return NextResponse.json({ message: "Heartbeat failed" }, { status: 500 });
    }
}
