export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prismaClient } from "@/app/lib/db";
import { execSync } from "child_process";
import path from "path";

const ALLOWED_IPS = ['127.0.0.1', '::1', '192.168.0.100'];

function isAllowed(req: NextRequest) {
    if (process.env.NODE_ENV !== 'production') return true;
    
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || '';
    
    return ALLOWED_IPS.includes(ip) || ip.startsWith('192.168.0.');
}

export async function GET(req: NextRequest) {
    if (!isAllowed(req)) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const checks: Record<string, { status: "ok" | "error"; detail?: string }> = {};

    try {
        await prismaClient.$queryRaw`SELECT 1`;
        checks.database = { status: "ok" };
    } catch (err) {
        checks.database = { status: "error", detail: err instanceof Error ? err.message : String(err) };
    }

    try {
        const command = process.platform === "win32" ? "yt-dlp.exe --version" : "yt-dlp --version";
        execSync(command, { timeout: 5000, stdio: 'ignore' });
        checks.ytdlp = { status: "ok" };
    } catch (err) {
        const ytDlpPath = execSync("which yt-dlp 2>/dev/null || echo 'not found'", { encoding: 'utf8' });
        checks.ytdlp = { status: "error", detail: `yt-dlp not found. Path: ${ytDlpPath.trim()}` };
    }

    const allOk = Object.values(checks).every(c => c.status === "ok");

    return NextResponse.json(
        { status: allOk ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
        { status: 200 }
    );
}

