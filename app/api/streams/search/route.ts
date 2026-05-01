import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import YouTubeSearchApi from 'youtube-search-api';
import { isRateLimited } from '@/app/lib/rateLimit';
import type { YouTubeSearchItem } from '@/types/youtube-api';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
    }

    const limitKey = `search:${session.user.email}`;
    const searchLimit = parseInt(process.env.RATE_LIMIT_SEARCH || '30', 10);
    if (isRateLimited(limitKey, searchLimit, 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ items: [] });
    }

     
    logger.info(`🔍 Search API: Searching for "${query}" with Topic prioritization`);

    // We try two searches to get a good mix: Topic/Official Audio and the raw query
    const [topicResults, rawResults] = await Promise.all([
      YouTubeSearchApi.GetListByKeyword(`${query} official audio`, false, 10, [{ type: 'video' }]),
      YouTubeSearchApi.GetListByKeyword(query, false, 10, [{ type: 'video' }]),
    ]);

    const allItems = [...(topicResults?.items || []), ...(rawResults?.items || [])];

    // Deduplicate and Prioritize Topic channels
    const seen = new Set();
    const prioritized = allItems
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => {
        const aTitle = (a.channelTitle || '').toLowerCase();
        const bTitle = (b.channelTitle || '').toLowerCase();
        const aIsTopic = aTitle.endsWith('- topic') || aTitle.includes('official audio');
        const bIsTopic = bTitle.endsWith('- topic') || bTitle.includes('official audio');

        if (aIsTopic && !bIsTopic) return -1;
        if (!aIsTopic && bIsTopic) return 1;
        return 0;
      });

    // Limit to top 10 for the UI
    const finalItems = prioritized.slice(0, 10).map((item: YouTubeSearchItem) => ({
      id: item.id,
      title: item.title,
      thumbnail: item.thumbnail?.thumbnails?.[0]?.url || '',
      channelTitle: item.channelTitle,
      duration: item.lengthText || item.duration || item.durationText || '',
    }));

    return NextResponse.json({ items: finalItems });
  } catch (e) {
     
    logger.error({ err: e }, '❌ Search API Error:');
    return NextResponse.json({ message: 'Search failed' }, { status: 500 });
  }
}
