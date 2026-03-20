export const dynamic = 'force-dynamic';
import { prismaClient } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
        return NextResponse.json({ users: [] });
    }

    try {
        const users = await prismaClient.user.findMany({
            where: {
                OR: [
                    { username: { contains: query, mode: "insensitive" } },
                    { displayName: { contains: query, mode: "insensitive" } }
                ],
                deletedAt: null
            },
            select: {
                id: true,
                username: true,
                displayName: true,
                image: true,
                platformRole: true
            },
            take: 10
        });

        return NextResponse.json({ users });
    } catch (error) {
        console.error("Search API Error:", error);
        return NextResponse.json({ message: "Search failed" }, { status: 500 });
    }
}

