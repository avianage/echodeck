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

        const user = await prismaClient.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 403 });
        }

        const body = await req.json();
        const data = HeartbeatSchema.parse(body);

        // If it's the creator, update the state
        if (user.id === data.creatorId && data.currentTime !== undefined) {
            await (prismaClient.currentStream as any).upsert({
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

        // If it's a listener (or anyone else), return the current state
        const currentStream = await prismaClient.currentStream.findUnique({
            where: { userId: data.creatorId },
            include: { stream: true }
        }) as any;

        if (!currentStream) {
            return NextResponse.json({ message: "No active stream" }, { status: 404 });
        }

        return NextResponse.json({
            currentTime: currentStream.currentTime,
            isPaused: currentStream.isPaused,
            updatedAt: currentStream.updatedAt,
            stream: currentStream.stream
        });


    } catch (e) {
        console.error("❌ Heartbeat API Error:", e);
        return NextResponse.json({ message: "Heartbeat failed" }, { status: 500 });
    }
}
