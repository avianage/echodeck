export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { isOwner } from "@/app/lib/getSessionRole";
import { prismaClient } from "@/app/lib/db";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

    const user = await prismaClient.user.findUnique({
        where: { id: userId },
        select: { platformRole: true }
    });

    if ((user?.platformRole as any) !== "OWNER") return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

    const streams = await prismaClient.stream.findMany({
        include: {
            user: { select: { username: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ streams });
}

