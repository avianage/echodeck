export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { create as createYtDlp } from 'yt-dlp-exec';
import path from 'node:path';
import { authOptions } from "@/app/lib/auth";
import { getServerSession } from "next-auth";
import { isRateLimited } from "@/app/lib/rateLimit";

interface CacheEntry {
    url: string;
    format: string;
    expiresAt: number;
}

const streamCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const RESOLVE_TIMEOUT_MS = 10000;

function getCached(videoId: string): CacheEntry | null {
    const entry = streamCache.get(videoId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        streamCache.delete(videoId);
        return null;
    }
    return entry;
}

function setCache(videoId: string, url: string, format: string): void {
    streamCache.set(videoId, {
        url,
        format,
        expiresAt: Date.now() + CACHE_TTL_MS
    });
}

// Explicitly point at the bundled yt-dlp.exe to avoid cross-platform path detection bugs
const ytDlp = createYtDlp(
    path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe')
);

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return NextResponse.json({ message: "Unauthenticated" }, { status: 403 });
    }

    const limitKey = `resolve:${session.user.email}`;
    if (isRateLimited(limitKey, 10, 60 * 1000)) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");

    if (!videoId) {
        return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
    }

    const cached = getCached(videoId);
    if (cached) {
        console.log(`✅ Cache hit for ${videoId}`);
        return NextResponse.json({ url: cached.url, format: cached.format });
    }

    try {
        console.log(`📡 Resolving stream for: ${videoId} using yt-dlp`);

    } catch (e) {
        console.error("❌ Stream Resolution Error:", e);
        return NextResponse.json({
            error: "Failed to resolve stream",
            details: e instanceof Error ? e.message : String(e)
        }, { status: 500 });
    }
}

