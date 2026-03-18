import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });

    const requests = await prismaClient.friendship.findMany({
        where: {
            addresseeId: userId,
            status: "PENDING"
        },
        include: {
            requester: {
                select: {
                    id: true,
                    username: true,
                    displayName: true,
                    image: true
                }
            }
        }
    });

    return NextResponse.json({ requests });
}
