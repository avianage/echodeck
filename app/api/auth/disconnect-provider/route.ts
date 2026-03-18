import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const { provider } = await req.json();

        if (provider === "google") {
            // Delete the NextAuth Account record for Google
            await prismaClient.account.deleteMany({
                where: {
                    userId,
                    provider: "google"
                }
            });
            return NextResponse.json({ message: "Google disconnected successfully" });
        }

        if (provider === "spotify") {
            // Clear Spotify fields on the User record
            await prismaClient.user.update({
                where: { id: userId },
                data: {
                    spotifyConnected: false,
                    spotifyAccessToken: null,
                    spotifyRefreshToken: null,
                    spotifyTokenExpiresAt: null
                }
            });
            return NextResponse.json({ message: "Spotify disconnected successfully" });
        }

        return NextResponse.json({ message: "Invalid provider" }, { status: 400 });

    } catch (error) {
        console.error("Error disconnecting provider:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
