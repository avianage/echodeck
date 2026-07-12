export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';

const ALLOWED_HOSTS = ['googlevideo.com', 'youtube.com', 'ytimg.com'];

function isAllowedUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'https:' &&
      ALLOWED_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
}

function getAllowedOrigin(): string {
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  if (nextAuthUrl) {
    try {
      return new URL(nextAuthUrl).origin;
    } catch {}
  }
  return 'https://echodeck.avianage.in';
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 });

  const decoded = decodeURIComponent(url);

  if (!isAllowedUrl(decoded)) {
    return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
  }

  // Forward Range so seeking (audio.currentTime, sync-to-position on join/
  // resume) works — without this, the browser's range requests would be
  // silently ignored and every seek would re-download from byte 0.
  const range = req.headers.get('range');

  const upstream = await fetch(decoded, {
    headers: {
      referer: 'https://www.youtube.com/',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...(range ? { range } : {}),
    },
  });

  const allowedOrigin = getAllowedOrigin();

  const headers: Record<string, string> = {
    'Content-Type': upstream.headers.get('Content-Type') || 'audio/mp4',
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
  const contentLength = upstream.headers.get('Content-Length');
  const contentRange = upstream.headers.get('Content-Range');
  if (contentLength) headers['Content-Length'] = contentLength;
  if (contentRange) headers['Content-Range'] = contentRange;

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
