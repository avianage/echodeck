import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });

    const friendships = await prismaClient.friendship.findMany({
        where: {
            status: "ACCEPTED",
            OR: [{ requesterId: userId }, { addresseeId: userId }]
        },
        include: {
            requester: {
                select: {
                    id: true, username: true, displayName: true, image: true,
                    listeningActivity: true
                }
            },
            addressee: {
                select: {
                    id: true, username: true, displayName: true, image: true,
                    listeningActivity: true
                }
            }
        }
    });

    const ACTIVITY_TIMEOUT_MS = 30 * 1000; // 30s — if no heartbeat, consider offline
    const now = Date.now();

    const activity = await Promise.all(friendships.map(async (f: any) => {
        const friend = f.requesterId === userId ? f.addressee : f.requester;
        const la = friend.listeningActivity;
        const isActive = la && (now - new Date(la.updatedAt).getTime()) < ACTIVITY_TIMEOUT_MS;

        let partyCode = null;
        if (isActive && la.creatorId) {
            const creator = await prismaClient.user.findUnique({
                where: { id: la.creatorId },
                select: { partyCode: true }
            });
            partyCode = creator?.partyCode;
        }

        return {
            id: friend.id,
            username: friend.username,
            displayName: friend.displayName,
            email: (friend as any).email,
            image: friend.image,
            isListening: isActive,
            creatorId: isActive ? la.creatorId : null,
            partyCode: partyCode,
            songTitle: isActive ? la.songTitle : null,
            lastSeen: la?.updatedAt ?? null
        };
    }));

    return NextResponse.json({ activity });
}
