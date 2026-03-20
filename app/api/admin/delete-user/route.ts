export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";

export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

    const requestingUser = await prismaClient.user.findUnique({
        where: { id: userId },
        select: { platformRole: true }
    });

    if (requestingUser?.platformRole !== "OWNER") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const { targetUserId } = await req.json();

    if (!targetUserId) {
        return NextResponse.json({ message: "Missing targetUserId" }, { status: 400 });
    }

    if (targetUserId === userId) {
        return NextResponse.json({ message: "You cannot delete your own account" }, { status: 400 });
    }

    const targetUser = await prismaClient.user.findUnique({
        where: { id: targetUserId },
        select: { platformRole: true, username: true }
    });

    if (!targetUser) {
        return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (targetUser.platformRole === "OWNER") {
        return NextResponse.json({ message: "Cannot delete another owner" }, { status: 403 });
    }

    // Cascade cleanup before deleting the user
    // 1. Close any active streams
    await prismaClient.stream.updateMany({
        where: { userId: targetUserId, isLive: true },
        data: { isLive: false, endedAt: new Date() }
    });

    // 2. Delete CurrentStream entry
    await prismaClient.currentStream.deleteMany({
        where: { userId: targetUserId }
    });

    // 3. Delete the user (Prisma cascade handles related records via schema onDelete)
    await prismaClient.user.delete({
        where: { id: targetUserId }
    });

    return NextResponse.json({ message: `User "${targetUser.username || targetUserId}" has been deleted` });
}

