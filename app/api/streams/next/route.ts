import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session) {
        console.warn("No session found");
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const userId = (session.user as any).id;

    if (!userId) {
        console.warn("User ID not found in session");
        return NextResponse.json({ message: "User not found" }, { status: 403 });
    }

    const mostUpvotedStream = await prismaClient.stream.findFirst({
        where: {
            userId: userId,
            played: false
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
                userId: userId
            },
            update: {
                userId: userId,
                streamId: mostUpvotedStream.id
            },
            create: {
                userId: userId,
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
        })
    ]);

    return NextResponse.json({
        stream: mostUpvotedStream
    });
}
