export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });

    const { username, displayName, role } = await req.json();

    const valid = /^[a-z0-9_]{3,}$/.test(username); // relaxed from 5 to 3 for flexibility
    if (!valid) return NextResponse.json({ message: "Invalid username format" }, { status: 400 });

    const existing = await prismaClient.user.findUnique({ where: { username } });
    if (existing && existing.id !== userId) {
        return NextResponse.json({ message: "Username already taken" }, { status: 409 });
    }

    const allowOwnerCreation = process.env.ALLOW_OWNER_CREATION === "true" || process.env.NEXT_PUBLIC_ALLOW_OWNER_CREATION === "true";
    const finalRole = (role === "OWNER" && allowOwnerCreation) ? "OWNER" : "MEMBER";

    await prismaClient.user.update({
        where: { id: userId },
        data: {
            username,
            displayName: displayName?.trim() || username,
            platformRole: finalRole as any,
            usernameUpdatedAt: new Date(),
        }
    });

    return NextResponse.json({ message: "Setup complete" });
}

