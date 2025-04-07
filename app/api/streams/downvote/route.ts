import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const DownvoteSchema = z.object({
    streamId: z.string()
});

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession();

        if (!session?.user?.email) {
            return NextResponse.json({ message: "Unauthenticated" }, { status: 403 });
        }

        const user = await prismaClient.user.findUnique({
            where: {
                email: session.user.email,
            },
        });

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 403 });
        }

        const data = DownvoteSchema.parse(await req.json());

        // 🔍 Check if stream exists
        const stream = await prismaClient.stream.findUnique({
            where: { id: data.streamId },
        });

        if (!stream) {
            return NextResponse.json({ message: "Invalid stream ID" }, { status: 404 });
        }

        // 🔍 Check if user has upvoted this stream
        const existingUpvote = await prismaClient.upvote.findUnique({
            where: {
                userId_streamId: {
                    userId: user.id,
                    streamId: data.streamId,
                },
            },
        });

        if (!existingUpvote) {
            return NextResponse.json({ message: "You haven't upvoted this stream yet" }, { status: 409 });
        }

        // 🗑️ Remove upvote
        await prismaClient.upvote.delete({
            where: {
                userId_streamId: {
                    userId: user.id,
                    streamId: data.streamId,
                },
            },
        });

        return NextResponse.json({ message: "Downvoted (removed upvote) successfully!" });

    } catch (error) {
        console.error("Error while Downvoting:", error);

        return NextResponse.json({
            message: "Error while Downvoting: " + error,
        }, {
            status: 500,
        });
    }
}
