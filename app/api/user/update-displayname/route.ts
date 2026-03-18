import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });

    const { displayName } = await req.json();

    if (!displayName || displayName.trim().length < 2) {
        return NextResponse.json({ message: "Display name too short" }, { status: 400 });
    }

    if (displayName.trim().length > 50) {
        return NextResponse.json({ message: "Display name too long" }, { status: 400 });
    }

    await prismaClient.user.update({
        where: { id: userId },
        data: { displayName: displayName.trim() }
    });

    return NextResponse.json({ message: "Display name updated successfully" });
}
