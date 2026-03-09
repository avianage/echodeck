import { NextRequest, NextResponse } from "next/server";
import { create as createYtDlp } from 'yt-dlp-exec';
import path from 'node:path';

// Explicitly point at the bundled yt-dlp.exe to avoid cross-platform path detection bugs
const ytDlp = createYtDlp(
    path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe')
);


export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const videoId = searchParams.get("videoId");

        if (!videoId) {
            return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
        }

        console.log(`📡 Resolving stream for: ${videoId} using yt-dlp`);

        const output = await ytDlp(`https://www.youtube.com/watch?v=${videoId}`, {
            dumpJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            // @ts-expect-error: yt-dlp-exec supports array for repeated flags, but types don't
            addHeader: [
                'referer:youtube.com',
                'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        });

        // Try to find the best combined format, or fallback to audio-only if necessary
        const format = output.formats.find(f => f.ext === 'mp4' && f.acodec !== 'none' && f.vcodec !== 'none')
            || output.formats.find(f => f.ext === 'm4a')
            || output.formats[0];

        if (!format || !format.url) {
            return NextResponse.json({ error: "No suitable format found" }, { status: 404 });
        }

        return NextResponse.json({
            url: format.url,
            format: format.ext
        });

    } catch (e) {
        console.error("❌ Stream Resolution Error:", e);
        return NextResponse.json({
            error: "Failed to resolve stream",
            details: e instanceof Error ? e.message : String(e)
        }, { status: 500 });
    }
}
