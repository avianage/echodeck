export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prismaClient } from "@/app/lib/db";

export async function GET(req: NextRequest) {
    const username = req.nextUrl.searchParams.get("username");
    if (!username) return NextResponse.json({ available: false, reason: "Missing username" });

    const valid = /^[a-z0-9_]{5,}$/.test(username);
    if (!valid) {
        return NextResponse.json({
            available: false,
            reason: username.length < 5
                ? "Must be at least 5 characters"
                : "Only lowercase letters, numbers, and underscores allowed"
        });
    }

    const existing = await prismaClient.user.findUnique({ where: { username } });
    return NextResponse.json({
        available: !existing,
        reason: existing ? "Username already taken" : null
    });
}

