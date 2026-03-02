import { NextResponse } from "next/server";
import { prismaClient } from "@/app/lib/db";

export async function GET() {
    try {
        await prismaClient.$queryRaw`SELECT 1`;
        return NextResponse.json({ status: "ok", database: "connected" });
    } catch (e: any) {
        console.error("❌ Health check failed:", e);
        return NextResponse.json({
            status: "error",
            database: "disconnected",
            message: e.message
        }, { status: 500 });
    }
}
