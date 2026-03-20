export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
        return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });
    }

    await prismaClient.user.update({
        where: { id: userId },
        data: {
            spotifyConnected: false,
            spotifyAccessToken: null,
            spotifyRefreshToken: null,
            spotifyTokenExpiresAt: null
        }
    });

    return NextResponse.json({ message: "Spotify disconnected" });
}

