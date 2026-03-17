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
        const { isPublic } = await req.json();
        await prismaClient.user.update({
            where: { email: session.user.email },
            data: { isPublic }
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
        select: { isPublic: true }
    });

    return NextResponse.json({ isPublic: user?.isPublic });
}
