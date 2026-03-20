export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prismaClient } from "@/app/lib/db";
import { execSync } from "child_process";
import path from "path";

export async function GET() {
    const checks: Record<string, { status: "ok" | "error"; detail?: string }> = {};

    // Check DB
    try {
        await prismaClient.$queryRaw`SELECT 1`;
        checks.database = { status: "ok" };
    } catch (err) {
        checks.database = { status: "error", detail: err instanceof Error ? err.message : String(err) };
    }

    // Check yt-dlp binary
    try {
        const binaryName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
        const binaryPath = path.join(process.cwd(), "node_modules", "yt-dlp-exec", "bin", binaryName);
        execSync(`"${binaryPath}" --version`, { timeout: 5000 });
        checks.ytdlp = { status: "ok" };
    } catch (err) {
        checks.ytdlp = { status: "error", detail: "Binary missing or not executable" };
    }

    const allOk = Object.values(checks).every(c => c.status === "ok");

    return NextResponse.json(
        { status: allOk ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
        { status: allOk ? 200 : 503 }
    );
}

