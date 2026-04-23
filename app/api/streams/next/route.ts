export const dynamic = 'force-dynamic';
import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { getStreamRole } from "@/app/lib/getSessionRole";
import { hasPermission } from "@/app/lib/permissions";
import { broadcastEvent } from "@/app/lib/broadcastEvent";

export async function GET() {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id ?? null;

    const user = await prismaClient.user.findUnique({
        where: { id: userId || "" },
        select: { isBanned: true, bannedUntil: true }
    });

    if (user?.isBanned) {
        return NextResponse.json({ message: "Account banned" }, { status: 403 });
    }

    if (user?.bannedUntil && new Date(user.bannedUntil) > new Date()) {
        return NextResponse.json({ message: "Account temporarily restricted" }, { status: 403 });
    }

    // In 'next', the creatorId is effectively the userId (the streamer)
    // but since we want to allow the OWNER to skip too, we treat it as a skip on the current user's stream
    const role = await getStreamRole(userId, userId); 

    if (!hasPermission(role, "playback:skip")) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const mostUpvotedStream = await prismaClient.stream.findFirst({
        where: {
            userId: userId || "",
            played: false,
            extractedId: {
                notIn: (await prismaClient.blockedVideo.findMany({ select: { videoId: true } })).map((v: { videoId: string }) => v.videoId)
            }
        },
        orderBy: [
            {
                upvotes: {
                    _count: 'desc'
                }
            },
            {
                createdAt: 'asc'
            }
        ]
    });

    if (!mostUpvotedStream) {
        return NextResponse.json({ message: "No stream found" }, { status: 404 });
    }

    await Promise.all([
        prismaClient.currentStream.upsert({
            where: {
                userId: userId || ""
            },
            update: {
                userId: userId || "",
                streamId: mostUpvotedStream.id
            },
            create: {
                userId: userId || "",
                streamId: mostUpvotedStream.id
            }
        }),
        prismaClient.stream.update({
            where: {
                id: mostUpvotedStream.id
            },
            data: {
                played: true,
                playedTs: new Date()
            }
        }),
        broadcastEvent(userId || "", "SONG_SKIPPED_BY_CREATOR", `Skipped to: ${mostUpvotedStream.title}`)
    ]);

    return NextResponse.json({
        stream: mostUpvotedStream
    });
}
