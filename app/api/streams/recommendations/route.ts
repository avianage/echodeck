export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
// ts-expect-error No Types available
// import youtubesearchapi from "youtube-search-api";

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
    // Current logic commented out for migration to separate microservice
    /*
        let recommendations: any[] = [];
        const cleanTitle = (t: string) => { ... };
        const getScore = (item: any) => { ... };
        // ... fetching logic
        */

    // Returning empty list for now, API ready for microservice
    return NextResponse.json({
      recommendations: [],
    });
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
