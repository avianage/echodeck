import { prismaClient } from "@/app/lib/db";
import { pusherServer } from "@/app/lib/pusher";
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

        const user = await prismaClient.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            console.error("Sync API: User not found for email:", session.user.email);
            return NextResponse.json({ message: "User not found" }, { status: 403 });
        }

        const body = await req.json();
        const data = SyncSchema.parse(body);

        console.log(`📡 Sync Command: ${data.type} at ${data.currentTime}s for creator: ${data.creatorId} (by user: ${user.id})`);

        // Only the creator should be able to trigger sync
        if (user.id !== data.creatorId) {
            console.warn(`Sync API: Unauthorized attempt. User ${user.id} tried to sync for ${data.creatorId}`);
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        await pusherServer.trigger(data.creatorId, "player-sync", {
            type: data.type,
            currentTime: data.currentTime
        });

        return NextResponse.json({ message: "Sync successful" });
    } catch (e) {
        console.error("❌ Sync API Error:", e);
        return NextResponse.json({ message: "Sync failed: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
    }
}
