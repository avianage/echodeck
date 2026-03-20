export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const requesterId = (session?.user as any)?.id;
    if (!requesterId) return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
        return NextResponse.json({ message: "Target userId is required" }, { status: 400 });
    }

    try {
        const friendship = await prismaClient.friendship.findFirst({
            where: {
                OR: [
                    { requesterId: requesterId, addresseeId: targetUserId },
                    { requesterId: targetUserId, addresseeId: requesterId }
                ]
            }
        });

        return NextResponse.json({
            isFriend: friendship?.status === "ACCEPTED",
            isPending: friendship?.status === "PENDING"
        });
    } catch (err) {
        console.error("Error checking friendship status:", err);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

