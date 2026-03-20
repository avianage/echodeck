export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = ['googlevideo.com', 'youtube.com', 'ytimg.com'];

function isAllowedUrl(rawUrl: string): boolean {
    try {
        const parsed = new URL(rawUrl);
        return ALLOWED_HOSTS.some(host => parsed.hostname.endsWith(host));
    } catch {
        return false;
    }
}

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get("url");
    if (!url) return NextResponse.json({ error: "No URL" }, { status: 400 });

    const decoded = decodeURIComponent(url);

    if (!isAllowedUrl(decoded)) {
        return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
    }

    const upstream = await fetch(decoded, {
        headers: {
            'referer': 'https://www.youtube.com/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    return new NextResponse(upstream.body, {
        headers: {
            'Content-Type': upstream.headers.get('Content-Type') || 'audio/mp4',
            'Accept-Ranges': 'bytes',
        }
    });
}

