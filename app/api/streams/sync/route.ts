import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/app/lib/auth";

const SyncSchema = z.object({
    creatorId: z.string(),
    type: z.enum(["play", "pause"]),
    currentTime: z.number()
});

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user?.email) {
            console.warn("Sync API: Unauthenticated request");
            return NextResponse.json({ message: "Unauthenticated" }, { status: 403 });
        }

        const userId = (session.user as any).id;

        if (!userId) {
            console.error("Sync API: User ID not found for email:", session.user.email);
            return NextResponse.json({ message: "User not found" }, { status: 403 });
        }

        const body = await req.json();
        const data = SyncSchema.parse(body);

        console.log(`📡 Sync Command: ${data.type} at ${data.currentTime}s for creator: ${data.creatorId} (by user: ${user.id})`);

        // Only the creator should be able to trigger sync
        if (userId !== data.creatorId) {
            console.warn(`Sync API: Unauthorized attempt. User ${userId} tried to sync for ${data.creatorId}`);
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        // Update the CurrentStream record as the source of truth for sync
        await prismaClient.currentStream.upsert({
            where: { userId: data.creatorId },
            update: {
                currentTime: data.currentTime,
                isPaused: data.type === "pause",
                updatedAt: new Date(),
            },
            create: {
                userId: data.creatorId,
                currentTime: data.currentTime,
                isPaused: data.type === "pause",
            },
        });

        return NextResponse.json({ message: "Sync successful" });
    } catch (e) {
        console.error("❌ Sync API Error:", e);
        return NextResponse.json({ message: "Sync failed: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
    }
}
