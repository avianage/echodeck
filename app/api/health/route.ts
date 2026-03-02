import { NextResponse } from "next/server";
import { prismaClient } from "@/app/lib/db";

export async function GET() {
    try {
        await prismaClient.$queryRaw`SELECT 1`;
        return NextResponse.json({ status: "ok", database: "connected" });
    } catch (e: unknown) {
        console.error("❌ Health check failed:", e);
        return NextResponse.json({
            status: "error",
            database: "disconnected",
            message: e instanceof Error ? e.message : "Unknown error"
        }, { status: 500 });
    }
}
