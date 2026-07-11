export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import YouTubeSearchApi from 'youtube-search-api';
import { authOptions } from '@/app/lib/auth';
import { isRateLimited } from '@/app/lib/rateLimit';
import type { YouTubeSearchItem } from '@/types/youtube-api';
import { logger } from '@/lib/logger';

// Strip common suffixes ("(Official Video)", "[Lyrics]", feat./ft. credits,
// etc.) so the search query is closer to just the song/artist and returns
// more relevant results than searching the raw, often noisy, video title.
function cleanTitle(title: string): string {
  return title
    .replace(/[([][^)\]]*(official|video|audio|lyrics?|hd|4k|remaster\w*)[^)\]]*[)\]]/gi, '')
    .replace(/\b(feat\.?|ft\.?)\b.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function GET(req: NextRequest) {
  const videoTitle = req.nextUrl.searchParams.get('videoTitle');
  const videoId = req.nextUrl.searchParams.get('videoId');

  if (!videoTitle && !videoId) {
    return NextResponse.json(
      {
        message: 'Video title or ID is required',
      },
      {
        status: 400,
      },
    );
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
    }

    const limitKey = `recommendations:${session.user.email}`;
    if (isRateLimited(limitKey, 30, 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const query = videoTitle ? cleanTitle(videoTitle) : videoId!;
    if (!query) {
      return NextResponse.json({ recommendations: [] });
    }

    const results = await YouTubeSearchApi.GetListByKeyword(query, false, 15, [{ type: 'video' }]);
    const items: YouTubeSearchItem[] = results?.items || [];

    const recommendations = items
      .filter((item) => item.id && item.id !== videoId)
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        title: item.title,
        thumbnail: item.thumbnail?.thumbnails?.[0]?.url || '',
        channelTitle: item.channelTitle,
        duration: item.lengthText || item.duration || item.durationText || '',
      }));

    return NextResponse.json({ recommendations });
  } catch (e) {

    logger.error({ err: e }, 'Error fetching recommendations:');
    return NextResponse.json(
      {
        message: 'Error fetching recommendations',
      },
      {
        status: 500,
      },
    );
  }
}
