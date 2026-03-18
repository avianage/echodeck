import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prismaClient } from "@/app/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ streamId: string }> }) {
    const { streamId } = await params;
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { isPublic } = await req.json();

    const stream = await prismaClient.stream.findUnique({
        where: { id: streamId }
    });

    if (!stream || stream.userId !== userId) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    await prismaClient.stream.update({
        where: { id: streamId },
        data: { isPublic }
    });

    return NextResponse.json({ message: `Stream is now ${isPublic ? "public" : "private"}` });
}
