import { getServerSession } from "next-auth";
import { prismaClient } from "@/app/lib/db";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session) {
    console.warn("No session found");
    return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
  }

  const userId = (session.user as any).id;

  if (!userId) {
    console.warn("User ID not found in session");
    return NextResponse.json({ message: "User not found" }, { status: 403 });
  }

  await prismaClient.stream.deleteMany({
    where: {
      userId: userId
    },
  });


  return new Response("Queue stopped and cleared", { status: 200 });
}
