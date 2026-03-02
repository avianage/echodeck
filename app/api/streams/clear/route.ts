import { getServerSession } from "next-auth";
import { prismaClient } from "@/app/lib/db";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { pusherServer } from "@/app/lib/pusher";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session) {
    console.warn("No session found");
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const user = await prismaClient.user.findFirst({
    where: {
      email: session?.user?.email ?? ""
    }
  });

  if (!user) {
    console.warn("User not found");
    return NextResponse.json({ message: "User not found" }, { status: 403 });
  }

  await prismaClient.stream.deleteMany({
    where: {
      userId: user.id
    },
  });

  // Broadcast to all listeners that the queue is cleared
  await pusherServer.trigger(user.id, "queue-cleared", {});

  return new Response("Queue stopped and cleared", { status: 200 });
}
