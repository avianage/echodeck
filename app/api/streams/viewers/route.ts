import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ message: "Unauthenticated" }, { status: 403 });
        }

        const creatorId = req.nextUrl.searchParams.get("creatorId");
        if (!creatorId) {
            return NextResponse.json({ message: "Creator ID required" }, { status: 400 });
        }

        // Only the creator (or OWNER) can see the full viewer list with IDs
        const userId = (session.user as any).id;
        const isSelf = userId === creatorId;
        const isOwner = (session.user as any).platformRole === "OWNER";

        if (!isSelf && !isOwner) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        // Fetch users who updated their heartbeat in the last 20 seconds
        const activeViewers = await prismaClient.listeningActivity.findMany({
            where: {
                creatorId,
                updatedAt: { gte: new Date(Date.now() - 20000) }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        image: true
                    }
                }
            }
        });

        const viewers = activeViewers.map(av => ({
            id: av.user.id,
            username: av.user.username,
            displayName: av.user.displayName,
            image: av.user.image,
            lastSeen: av.updatedAt
        }));

        return NextResponse.json({ viewers });
    } catch (e) {
        console.error("❌ Viewers API Error:", e);
        return NextResponse.json({ message: "Failed to fetch viewers" }, { status: 500 });
    }
}
