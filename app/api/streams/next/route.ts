import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
    const session = await getServerSession();

    if (!session) {
        console.warn("No session found");
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const user = await prismaClient.user.findFirst({
        where: {
            email: session?.user?.email ?? ""
        }
    });

    if (!user) {
        console.warn("User not found");
        return NextResponse.json({ message: "User not found" }, { status: 403 });
    }

    const mostUpvotedStream = await prismaClient.stream.findFirst({
        where: {
            userId: user.id,
            played: false
        },
        orderBy: {
            upvotes: {
                _count: 'desc'
            }
        }
    });

    if (!mostUpvotedStream) {
        return NextResponse.json({ message: "No stream found" }, { status: 404 });
    }

    await Promise.all([
        prismaClient.currentStream.upsert({
            where: {
                userId: user.id
            },
            update: {
                userId: user.id,
                streamId: mostUpvotedStream.id
            },
            create: {
                userId: user.id,
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
