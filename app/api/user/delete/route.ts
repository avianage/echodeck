export const dynamic = 'force-dynamic';
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
        // 1. Delete Upvotes (where user was the voter)
        await prismaClient.upvote.deleteMany({
            where: { userId }
        });

        // 2. Delete Favorites (both directions)
        await prismaClient.favorite.deleteMany({
            where: {
                OR: [
                    { userId },
                    { favoriteId: userId }
                ]
            }
        });

        // 3. Delete Stream Access (both directions)
        await prismaClient.streamAccess.deleteMany({
            where: {
                OR: [
                    { streamerId: userId },
                    { viewerId: userId }
                ]
            }
        });

        // 4. Delete Streams (and their votes will cascade)
        // Note: Streams added BY the user for others should also be cleaned up or anonymized.
        // For simplicity, we delete them all.
        await prismaClient.stream.deleteMany({
            where: {
                OR: [
                    { userId },
                    { addedById: userId }
                ]
            }
        });

        // 5. Delete the User record
        // This triggers Cascade deletion for:
        // - Account
        // - Session
        // - CurrentStream
        // - Friendship
        // - SessionMember
        // - ListeningActivity
        await prismaClient.user.delete({
            where: { id: userId }
        });

        return NextResponse.json({ message: "Account deleted successfully" });

    } catch (error) {
        console.error("Error deleting account:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

