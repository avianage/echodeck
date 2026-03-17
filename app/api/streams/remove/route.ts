import { NextRequest, NextResponse } from "next/server";
import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return NextResponse.json({ message: "Unauthenticated" }, { status: 403 });
    }

    const userId = (session.user as any).id;

    if (!userId) {
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
        if (stream.addedById !== userId && stream.userId !== userId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        await prismaClient.stream.delete({
            where: { id: streamId }
        });


        return NextResponse.json({ message: "Stream removed successfully" });
    } catch {
        return NextResponse.json({ message: "Error removing stream" }, { status: 500 });
    }
}
