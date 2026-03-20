import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthenticated" }, { status: 403 });
    }

    try {
        const { allowFriendRequests, isPublic } = await req.json();
        const updateData: any = {};
        if (allowFriendRequests !== undefined) updateData.allowFriendRequests = allowFriendRequests;
        if (isPublic !== undefined) updateData.isPublic = isPublic;

        await prismaClient.user.update({
            where: { email: session.user.email },
            data: updateData
        });
        return NextResponse.json({ message: "Privacy updated" });
    } catch (err) {
        return NextResponse.json({ message: "Error updating privacy" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ message: "Unauthenticated" }, { status: 403 });
    }

    const user = await prismaClient.user.findUnique({
        where: { email: session.user.email },
        select: { allowFriendRequests: true, isPublic: true }
    });

    return NextResponse.json({ 
        allowFriendRequests: user?.allowFriendRequests,
        isPublic: user?.isPublic 
    });
}
