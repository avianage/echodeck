import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });

    const user = await prismaClient.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    // Enforce 30 day cooldown
    if (user.usernameUpdatedAt) {
        const daysSince = (Date.now() - user.usernameUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 30) {
            const daysLeft = Math.ceil(30 - daysSince);
            return NextResponse.json({
                message: \`Username can be updated in \${daysLeft} more day(s)\`
            }, { status: 429 });
        }
    }

    const { username } = await req.json();

    const valid = /^[a-z0-9_]{5,}$/.test(username);
    if (!valid) return NextResponse.json({ message: "Invalid username format" }, { status: 400 });

    const existing = await prismaClient.user.findUnique({ where: { username } });
    if (existing && existing.id !== userId) {
        return NextResponse.json({ message: "Username already taken" }, { status: 409 });
    }

    await prismaClient.user.update({
        where: { id: userId },
        data: { username, usernameUpdatedAt: new Date() }
    });

    return NextResponse.json({ message: "Username updated successfully" });
}
