import { create as createYtDlp } from 'yt-dlp-exec';
import ytDlpDefault from 'yt-dlp-exec';
import { logger } from '@/lib/logger';

// googlevideo direct URLs are time-limited (a few hours); cache so repeated
// resolves for the same video within that window don't re-invoke yt-dlp.
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_HOURS || '4', 10) * 60 * 60 * 1000;

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const resolveCache = new Map<string, CacheEntry>();
const resolveVideoCache = new Map<string, CacheEntry>();

// In production, use the system yt-dlp binary (installed via apk in Docker).
// Locally, fall back to yt-dlp-exec's own default export, which is bound to
// its vendored binary in node_modules/yt-dlp-exec/bin — passing `undefined`
// to `create()` does NOT fall back to that path (it passes undefined straight
// to execa, which throws), so the two cases need genuinely different calls.
const ytDlp = process.env.NODE_ENV === 'production' ? createYtDlp('yt-dlp') : ytDlpDefault;

export async function resolveAudioUrl(videoId: string): Promise<string> {
  const cached = resolveCache.get(videoId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  const stdout = await ytDlp(`https://www.youtube.com/watch?v=${videoId}`, {
    format: 'bestaudio',
    getUrl: true,
    noWarnings: true,
    noCheckCertificate: true,
    preferFreeFormats: true,
  });

  const url = String(stdout).trim().split('\n')[0];
  if (!url || !url.startsWith('http')) {
    logger.error({ videoId, stdout }, 'yt-dlp did not return a resolvable audio URL');
    throw new Error('Failed to resolve audio URL');
  }

  resolveCache.set(videoId, { url, expiresAt: Date.now() + CACHE_TTL_MS });
  return url;
}

// A progressive (single-file, audio+video muxed) format, since we're only
// fetching a playable URL here (no download to run ffmpeg over) — this caps
// resolution lower than YouTube's separate adaptive streams, but plays
// directly in an HTML5 <video> tag with no server-side muxing required.
export async function resolveVideoUrl(videoId: string): Promise<string> {
  const cached = resolveVideoCache.get(videoId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  const stdout = await ytDlp(`https://www.youtube.com/watch?v=${videoId}`, {
    format: 'best[ext=mp4]/best',
    getUrl: true,
    noWarnings: true,
    noCheckCertificate: true,
    preferFreeFormats: true,
  });

  const url = String(stdout).trim().split('\n')[0];
  if (!url || !url.startsWith('http')) {
    logger.error({ videoId, stdout }, 'yt-dlp did not return a resolvable video URL');
    throw new Error('Failed to resolve video URL');
  }

  resolveVideoCache.set(videoId, { url, expiresAt: Date.now() + CACHE_TTL_MS });
  return url;
}
