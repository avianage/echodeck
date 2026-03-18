import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const requesterId = (session?.user as any)?.id;
    if (!requesterId) return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });

    const { username } = await req.json();

    const addressee = await prismaClient.user.findUnique({ 
        where: { username },
        select: { id: true, allowFriendRequests: true }
    });
    if (!addressee) return NextResponse.json({ message: "User not found" }, { status: 404 });
    if (addressee.id === requesterId) return NextResponse.json({ message: "Cannot add yourself" }, { status: 400 });
    
    if (!addressee.allowFriendRequests) {
        return NextResponse.json({ message: "This user is not accepting friend requests" }, { status: 403 });
    }

    const existing = await prismaClient.friendship.findFirst({
        where: {
            OR: [
                { requesterId, addresseeId: addressee.id },
                { requesterId: addressee.id, addresseeId: requesterId }
            ]
        }
    });

    if (existing) return NextResponse.json({ message: "Request already exists or friendship established" }, { status: 409 });

    await prismaClient.friendship.create({
        data: { requesterId, addresseeId: addressee.id, status: "PENDING" }
    });

    return NextResponse.json({ message: "Friend request sent" });
}
