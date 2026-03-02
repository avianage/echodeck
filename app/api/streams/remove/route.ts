import { NextRequest, NextResponse } from "next/server";
import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { pusherServer } from "@/app/lib/pusher";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return NextResponse.json({ message: "Unauthenticated" }, { status: 403 });
    }

    const user = await prismaClient.user.findFirst({
        where: { email: session.user.email }
    });

    if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 403 });
    }

    try {
        const { streamId } = await req.json();

        if (!streamId) {
            return NextResponse.json({ message: "Invalid stream ID" }, { status: 400 });
        }

        const stream = await prismaClient.stream.findUnique({
            where: { id: streamId }
        });

        if (!stream) {
            return NextResponse.json({ message: "Stream not found" }, { status: 404 });
        }

        // Only allow the person who added it OR the creator of the page to remove it
        // For simplicity, let's start with just the person who added it
        if (stream.addedById !== user.id && stream.userId !== user.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        await prismaClient.stream.delete({
            where: { id: streamId }
        });

        await pusherServer.trigger(stream.userId, "stream-update", {
            message: "Stream removed"
        });

        return NextResponse.json({ message: "Stream removed successfully" });
    } catch {
        return NextResponse.json({ message: "Error removing stream" }, { status: 500 });
    }
}
