import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/app/lib/auth";
import { getStreamRole } from "@/app/lib/getSessionRole";
import { hasPermission } from "@/app/lib/permissions";

const UpvoteSchema = z.object({
    streamId: z.string()
});

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ message: "Unauthenticated" }, { status: 403 });
        }

        const data = UpvoteSchema.parse(await req.json());

        const [user, stream] = await Promise.all([
            prismaClient.user.findUnique({
                where: {
                    email: session.user.email,
                },
                select: { id: true, isBanned: true, bannedUntil: true, platformRole: true }
            }),
            prismaClient.stream.findUnique({
                where: { id: data.streamId },
            })
        ]);

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 403 });
        }

        if (user.isBanned) {
            return NextResponse.json({ message: "Account banned" }, { status: 403 });
        }

        if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
            return NextResponse.json({ message: "Account temporarily restricted" }, { status: 403 });
        }

        if (!stream) {
            return NextResponse.json({ message: "Invalid stream ID" }, { status: 404 });
        }

        const role = await getStreamRole(user.id, stream.userId);
        if (!hasPermission(role, "vote:cast")) {
            return NextResponse.json({ message: "Action restricted from this stream" }, { status: 403 });
        }

        const creator = await prismaClient.user.findUnique({
            where: { id: stream.userId },
            select: { isPublic: true }
        });

        if (creator && !creator.isPublic && user.id !== stream.userId) {
            const access = await prismaClient.streamAccess.findUnique({
                where: {
                    streamerId_viewerId: {
                        streamerId: stream.userId,
                        viewerId: user.id
                    }
                }
            });
            if (access?.status !== "APPROVED") {
                return NextResponse.json({ message: "Access denied" }, { status: 403 });
            }
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
