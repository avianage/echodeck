import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";
import { PlatformRole } from "@prisma/client";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });

    try {
        const { image } = await req.json();

        if (!image) {
            return NextResponse.json({ message: "Image URL is required" }, { status: 400 });
        }

        // Basic validation for trusted sources
        const isDiceBear = image.startsWith("https://api.dicebear.com/");
        const isOwnerAvatar = image === "/avatars/owner_avatar.png";

        if (!isDiceBear && !isOwnerAvatar) {
            return NextResponse.json({ message: "Invalid image source" }, { status: 400 });
        }

        // Special check for owner avatar
        if (isOwnerAvatar) {
            const user = await prismaClient.user.findUnique({
                where: { id: userId },
                select: { platformRole: true }
            });
            if ((user?.platformRole as any) !== "OWNER") {
                return NextResponse.json({ message: "Only owners can use this avatar" }, { status: 403 });
            }
        }

        await prismaClient.user.update({
            where: { id: userId },
            data: { image }
        });

        return NextResponse.json({ 
            message: "Profile picture updated successfully",
            image
        });
    } catch (err) {
        console.error("Failed to update profile picture:", err);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
