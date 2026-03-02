import { prismaClient } from "@/app/lib/db";
import { pusherServer } from "@/app/lib/pusher";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";

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

        const { creatorId } = await req.json();

        if (!creatorId) {
            return NextResponse.json({ message: "Creator ID is required" }, { status: 400 });
        }

        // Trigger an event that ONLY the creator listens to
        // or a general event that the creator responds to
        await pusherServer.trigger(creatorId, "request-sync", {
            requestedBy: user.id
        });

        return NextResponse.json({ message: "Sync request sent" });
    } catch (e) {
        console.error("❌ Sync Request Error:", e);
        return NextResponse.json({ message: "Sync request failed" }, { status: 500 });
    }
}
