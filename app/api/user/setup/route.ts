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

    // Auto-bootstrap: If no owner exists in the system, the first user to setup becomes the owner.
    // This bypasses build-time env var issues and ensures the platform can be initialized easily.
    const ownerCount = await prismaClient.user.count({
        where: { platformRole: "OWNER" }
    });

    const isFirstOwner = ownerCount === 0;
    const allowOwnerCreation = process.env.ALLOW_OWNER_CREATION === "true" || process.env.NEXT_PUBLIC_ALLOW_OWNER_CREATION === "true";
    
    // User becomes owner if they are the first one OR if the manual toggle is on and they selected it.
    const finalRole = (isFirstOwner || (role === "OWNER" && allowOwnerCreation)) ? "OWNER" : "MEMBER";

    console.log(`👤 Setting up user ${userId} with role ${finalRole} (First owner: ${isFirstOwner})`);

    await prismaClient.user.update({
        where: { id: userId },
        data: {
            username,
            displayName: displayName?.trim() || username,
            platformRole: finalRole as any,
            usernameUpdatedAt: new Date(),
        }
    });

    return NextResponse.json({ message: "Setup complete", role: finalRole });
}

