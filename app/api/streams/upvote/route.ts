import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const UpvoteSchema = z.object({
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

        const data = UpvoteSchema.parse(await req.json());

       // Validate streamId before inserting upvote 
        const stream = await prismaClient.stream.findUnique({
            where: { id: data.streamId },
        });

        if (!stream) {
            return NextResponse.json({ message: "Invalid stream ID" }, { status: 404 });
        }

        // Check if user already upvoted this stream
        const existingUpvote = await prismaClient.upvote.findUnique({
            where: {
                userId_streamId: {
                    userId: user.id,
                    streamId: data.streamId,
                },
            },
        });

        if (existingUpvote) {
            return NextResponse.json({ message: "Already upvoted" }, { status: 409 });
        }

        // ✅ Create upvote
        await prismaClient.upvote.create({
            data: {
                userId: user.id,
                streamId: data.streamId,
            },
        });

        return NextResponse.json({ message: "Upvoted successfully!" });

    } catch (error) {
        console.error("Error while Upvoting:", error);

        return NextResponse.json({
            message: "Error while Upvoting: " + error,
        }, {
            status: 500,
        });
    }
}
