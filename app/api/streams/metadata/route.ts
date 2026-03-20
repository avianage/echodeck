export const dynamic = 'force-dynamic';
import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getStreamRole } from "@/app/lib/getSessionRole";
import { hasPermission } from "@/app/lib/permissions";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });
    }

    const { streamId, title, genre, isPublic, clearQueue } = await req.json();
    const userId = (session.user as any).id;

    try {
        if (streamId) {
            // Existing behaviour: update by streamId (used inside active stream)
            const stream = await prismaClient.stream.findUnique({ where: { id: streamId } });
            if (!stream) return NextResponse.json({ message: "Stream not found" }, { status: 404 });

            const streamRole = await getStreamRole(userId, stream.userId);
            if (!hasPermission(streamRole as any, "stream:update")) {
                return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
            }

            await (prismaClient.currentStream as any).upsert({
                where: { userId: stream.userId },
                update: { title, genre, ...(isPublic !== undefined ? { isPublic } : {}) },
                create: { userId: stream.userId, streamId: stream.id, title, genre }
            });

            // Also update the Stream record for discover page
            await prismaClient.stream.update({
                where: { id: streamId },
                data: {
                    ...(title !== undefined ? { title } : {}),
                    ...(genre !== undefined ? { genre } : {}),
                    ...(isPublic !== undefined ? { isPublic } : {})
                }
            });
        } else {
            // Pre-start: set metadata before navigating to /stream
            // Handle Clear Queue
            if (clearQueue) {
                await prismaClient.stream.deleteMany({
                    where: { userId, played: false }
                });
            }

            // Update User visibility preference
            if (isPublic !== undefined) {
                await prismaClient.user.update({
                    where: { id: userId },
                    data: { isPublic }
                });
            }

            // Find the creator's most recent stream (or any stream for them)
            const existingStream = await prismaClient.stream.findFirst({
                where: { userId },
                orderBy: { createdAt: "desc" }
            });

            await (prismaClient.currentStream as any).upsert({
                where: { userId },
                update: { title, genre },
                create: { userId, streamId: existingStream?.id || null, title, genre }
            });

            // Update the Stream record for discover page visibility if it exists
            if (existingStream) {
                await prismaClient.stream.update({
                    where: { id: existingStream.id },
                    data: {
                        ...(title !== undefined ? { title } : {}),
                        ...(genre !== undefined ? { genre } : {}),
                        ...(isPublic !== undefined ? { isPublic } : {})
                    }
                });
            }
        }

        return NextResponse.json({ message: "Metadata updated successfully" });
    } catch (error) {
        console.error("❌ POST /api/streams/metadata failed:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });
    }

    const userId = (session.user as any).id;

    try {
        await (prismaClient.currentStream as any).deleteMany({
            where: { userId }
        });
        return NextResponse.json({ message: "Stream stopped successfully" });
    } catch (error) {
        console.error("❌ DELETE /api/streams/metadata failed:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}


