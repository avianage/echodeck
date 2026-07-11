import { create as createYtDlp } from 'yt-dlp-exec';
import { logger } from '@/lib/logger';

// googlevideo direct URLs are time-limited (a few hours); cache so repeated
// resolves for the same video within that window don't re-invoke yt-dlp.
const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_HOURS || '4', 10) * 60 * 60 * 1000;

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const resolveCache = new Map<string, CacheEntry>();

// Use the system yt-dlp binary (installed via apk in Docker or present in PATH locally).
// If yt-dlp-exec is passed undefined, it defaults to searching for 'yt-dlp' in PATH.
const ytDlp = createYtDlp(process.env.NODE_ENV === 'production' ? 'yt-dlp' : undefined);

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
