import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthenticated" }, { status: 403 });
    }

    const user = await prismaClient.user.findUnique({ where: { email: session.user.email } });
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    const requests = await prismaClient.streamAccess.findMany({
        where: {
            streamerId: user.id,
            status: "PENDING"
        },
        include: {
            viewer: {
                select: { id: true, email: true }
            }
        }
    });

    return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthenticated" }, { status: 403 });
    }

    try {
        const { streamerId, action, viewerId } = await req.json();
        const user = await prismaClient.user.findUnique({ where: { email: session.user.email } });
        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        if (action === "request") {
            await prismaClient.streamAccess.upsert({
                where: {
                    streamerId_viewerId: {
                        streamerId,
                        viewerId: user.id
                    }
                },
                update: { status: "PENDING" },
                create: {
                    streamerId,
                    viewerId: user.id,
                    status: "PENDING"
                }
            });
            return NextResponse.json({ message: "Request sent" });
        }

        if (action === "approve" || action === "reject") {
            // Only the streamer can approve/reject
            await prismaClient.streamAccess.update({
                where: {
                    streamerId_viewerId: {
                        streamerId: user.id,
                        viewerId
                    }
                },
                data: {
                    status: action === "approve" ? "APPROVED" : "REJECTED"
                }
            });
            return NextResponse.json({ message: `Access ${action}d` });
        }

        return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    } catch (err) {
        return NextResponse.json({ message: "Error processing access" }, { status: 500 });
    }
}
