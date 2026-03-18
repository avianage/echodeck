import { getServerSession } from "next-auth";
import { prismaClient } from "@/app/lib/db";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { getStreamRole } from "@/app/lib/getSessionRole";
import { hasPermission } from "@/app/lib/permissions";

export async function POST() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? null;

  // Clear is typically for the streamer's own queue
  const role = await getStreamRole(userId, userId);

  if (!hasPermission(role, "queue:clear")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  await prismaClient.stream.deleteMany({
    where: {
      userId: userId
    },
  });


  return new Response("Queue stopped and cleared", { status: 200 });
}
