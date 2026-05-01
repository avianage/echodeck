export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prismaClient } from '@/app/lib/db';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const youtubesearchapi = require('youtube-search-api');
import { YT_REGEX, SPOTIFY_TRACK_REGEX } from '@/app/lib/utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { getSpotifyApi, getUserSpotifyApi } from '@/app/lib/spotify';
import { isRateLimited } from '@/app/lib/rateLimit';
import { getStreamRole } from '@/app/lib/getSessionRole';
import { hasPermission } from '@/app/lib/permissions';
import { getValidSpotifyToken } from '@/app/lib/spotifyToken';
import type { SpotifyTrack, YouTubeVideoDetails, YouTubeThumbnail } from '@/types';
import { logger } from '@/lib/logger';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const spotifyUrlInfoFn = require('spotify-url-info');
const spotifyUrlInfo = spotifyUrlInfoFn(fetch);
const getTracks = spotifyUrlInfo.getTracks;

const CreateStreamSchema = z.object({
  creatorId: z.string(),
  url: z.string(),
  isPublic: z.boolean().optional(),
});

const MAX_QUEUE_LENGTH = parseInt(process.env.MAX_QUEUE_LENGTH || '200', 10);

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
    }

    const limitKey = `add:${session.user.email}`;
    const createLimit = parseInt(process.env.RATE_LIMIT_CREATE_STREAM || '20', 10);
    if (isRateLimited(limitKey, createLimit, 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    const data = CreateStreamSchema.parse(await req.json());
    const isYt = data.url.match(YT_REGEX);
    const isSpotify = data.url.match(SPOTIFY_TRACK_REGEX);

    if (!isYt && !isSpotify) {
      return NextResponse.json(
        {
          message: 'Wrong URL format',
        },
        {
          status: 400, // was: 411, now: 400 (validation error)
        },
      );
    }

    let extractedId = '';
    let title = '';
    let smallImg = '';
    let bigImg = '';
    let streamType: 'Youtube' | 'Spotify' = 'Youtube';

    if (isYt) {
      streamType = 'Youtube';
      extractedId = isYt[1];
      if (!extractedId) {
        return NextResponse.json(
          { message: 'Invalid YouTube URL.' },
          { status: 400 }, // was: 411, now: 400 (validation error)
        );
      }

      logger.info(`🎥 Fetching details for video: ${extractedId}`);
      try {
        let res: YouTubeVideoDetails;
        try {
          res = await youtubesearchapi.GetVideoDetails(extractedId);
        } catch (libErr) {
          logger.warn(
            { err: libErr },
            `⚠️ GetVideoDetails threw an error for ${extractedId}. Trying search fallback...`,
          );
          // Search by ID often returns the same video with a different metadata format
          const searchFallback = await youtubesearchapi.GetListByKeyword(extractedId, false, 1, [
            { type: 'video' },
          ]);
          res = searchFallback?.items?.[0];
          if (res) {
            // Normalize search result to look like VideoDetails enough for the logic below
            if (!res.thumbnail && res.thumbnails) res.thumbnail = { thumbnails: res.thumbnails };
          }
        }

        if (!res) throw new Error('Could not retrieve video details from any source.');

        title = res.title || 'YouTube Video';

        title = res.title || 'YouTube Video';

        let thumbnails = res.thumbnail?.thumbnails || res.thumbnails || [];

        if (thumbnails.length > 0) {
          thumbnails = [...thumbnails].sort((a: YouTubeThumbnail, b: YouTubeThumbnail) =>
            (a?.width || 0) < (b?.width || 0) ? -1 : 1,
          );
          smallImg =
            thumbnails.length > 1 ? thumbnails[thumbnails.length - 2]?.url : thumbnails[0]?.url;
          bigImg = thumbnails[thumbnails.length - 1]?.url;
        }

        // Fallback images if still empty or switched
        if (!smallImg) smallImg = `https://img.youtube.com/vi/${extractedId}/mqdefault.jpg`;
        if (!bigImg) bigImg = `https://img.youtube.com/vi/${extractedId}/maxresdefault.jpg`;
      } catch (e: unknown) {
        logger.error({ err: e }, `❌ YouTube detail fetching failed:`);
        return NextResponse.json(
          {
            message: `Failed to fetch video details. This video might be restricted or unavailable.`,
          },
          { status: 400 },
        );
      }
    } else if (isSpotify) {
      streamType = 'Spotify';
      const spotifyId = isSpotify[1];
      if (!spotifyId) {
        return NextResponse.json(
          { message: 'Invalid Spotify URL.' },
          { status: 400 }, // was: 411, now: 400 (validation error)
        );
      }

      const session = await getServerSession(authOptions);
      const userId = session?.user?.id;

      logger.info(`🎧 Fetching details for Spotify track: ${spotifyId}`);

      const token = await getValidSpotifyToken(userId as string);
      if (!token) {
        return NextResponse.json(
          {
            message: 'Spotify account not connected',
            code: 'SPOTIFY_NOT_CONNECTED',
          },
          { status: 400 },
        );
      }

      let track: SpotifyTrack | null = null;

      // 1. Try User Linked Token (from spotifyToken helper)
      try {
        logger.info('📡 Trying Linked Spotify Token for track fetch');
        const userApi = getUserSpotifyApi(token);
        if (userApi) {
          const res = await userApi.getTrack(spotifyId);
          track = res.body as unknown as SpotifyTrack;

          logger.info('✅ Track fetched via Linked Token');
        }
      } catch (err: unknown) {
        logger.warn(`⚠️ Linked Token failed for track ${spotifyId}: ${(err as Error).message}`);
      }

      // 2. Try App Client Credentials if No Linked Token or it failed
      if (!track) {
        try {
          logger.info('📡 Trying Client Credentials for track fetch');
          const appApi = await getSpotifyApi();
          if (appApi) {
            const res = await appApi.getTrack(spotifyId);
            track = res.body as unknown as SpotifyTrack;

            logger.info('✅ Track fetched via Client Credentials');
          }
        } catch (err: unknown) {
          logger.warn(
            `⚠️ Client Credentials failed for track ${spotifyId}: ${(err as Error).message}`,
          );
        }
      }

      // 3. Fallback to Scraping
      if (!track) {
        try {
          logger.info('📡 Falling back to SCRAPE for track fetch');
          const trackUrl = `https://open.spotify.com/track/${spotifyId}`;
          const scrapedTracks = await getTracks(trackUrl);
          if (scrapedTracks && scrapedTracks.length > 0) {
            const t = scrapedTracks[0];
            track = {
              name: t.name,
              artists: t.artists || [{ name: t.artist || 'Unknown Artist' }],
              album: { images: t.album?.images || [] },
            } as SpotifyTrack;

            logger.info('✅ Track fetched via Scraping');
          }
        } catch (err: unknown) {
          logger.error(
            { err: (err as Error).message },
            '❌ All Spotify track fetch methods failed.',
          );
        }
      }

      if (!track) {
        return NextResponse.json(
          { message: 'Failed to fetch Spotify track details from all sources.' },
          { status: 400 },
        );
      }

      try {
        const artistNames = track.artists.map((a: Record<string, unknown>) => a.name).join(', ');
        title = `${track.name} by ${artistNames}`;

        const images = track.album?.images || [];
        if (images.length > 0) {
          bigImg = images[0].url;
          smallImg = images.length > 1 ? images[1].url : images[0].url;
        } else {
          bigImg = '';
          smallImg = '';
        }

        const res = await youtubesearchapi.GetListByKeyword(
          `${track.name} ${artistNames}`,
          false,
          1,
          [{ type: 'video' }],
        );
        const bestMatch = res?.items?.[0];
        if (!bestMatch) {
          return NextResponse.json(
            { message: 'Could not find a corresponding playable video for this song.' },
            { status: 404 },
          );
        }
        extractedId = bestMatch.id;
      } catch (e) {
        logger.error({ err: e }, `❌ Spotify API or YT fallback failed:`);
        return NextResponse.json({ message: 'Failed to process Spotify track.' }, { status: 400 });
      }
    }

    if (!session) {
      return NextResponse.json({ message: 'Unauthenticated' }, { status: 403 });
    }

    const user = await prismaClient.user.findUnique({
      where: { id: session.user?.id as string },
      select: { id: true, isBanned: true, bannedUntil: true, platformRole: true },
    });

    if (user?.isBanned) {
      return NextResponse.json({ message: 'Account banned' }, { status: 403 });
    }

    if (user?.bannedUntil && new Date(user.bannedUntil) > new Date()) {
      return NextResponse.json({ message: 'Account temporarily restricted' }, { status: 403 });
    }

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }, // was: 403, now: 404 (not found)
      );
    }

    const role = await getStreamRole(user.id, data.creatorId);

    // If user is trying to add to a queue
    if (!hasPermission(role, 'queue:add')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
    }

    // Special check: Only CREATORs (or OWNER) can create streams (own channels)
    // This is handled by verifying if they are the creatorId and have the platformRole
    if (user.id === data.creatorId) {
      const canCreate = user.platformRole === 'OWNER' || user.platformRole === 'CREATOR';
      if (!canCreate) {
        return NextResponse.json(
          {
            message: 'Creator access required. Contact the platform owner.',
          },
          { status: 403 },
        );
      }
    }

    const creator = await prismaClient.user.findUnique({
      where: { id: data.creatorId },
      select: { isPublic: true },
    });

    if (!creator) {
      return NextResponse.json({ message: 'Creator not found' }, { status: 404 });
    }

    // Check if video is blacklisted
    const isBlocked = await prismaClient.blockedVideo.findUnique({
      where: { videoId: extractedId },
    });

    if (isBlocked) {
      return NextResponse.json(
        {
          message: 'This video is not supported or has been blacklisted due to embed restrictions.',
        },
        { status: 400 },
      );
    }

    // Check access if private
    if (!creator.isPublic && user.id !== data.creatorId) {
      const access = await prismaClient.streamAccess.findUnique({
        where: {
          streamerId_viewerId: {
            streamerId: data.creatorId,
            viewerId: user.id,
          },
        },
      });
      if (access?.status !== 'APPROVED') {
        return NextResponse.json({ message: 'Access denied' }, { status: 403 });
      }
    }

    const existingActiveStream = await prismaClient.stream.count({
      where: {
        userId: data.creatorId,
      },
    });

    if (existingActiveStream > MAX_QUEUE_LENGTH) {
      return NextResponse.json(
        {
          message: 'Stream Queue At limit',
        },
        {
          status: 400, // was: 411, now: 400 (validation error)
        },
      );
    }

    const stream = await prismaClient.stream.create({
      data: {
        userId: data.creatorId,
        addedById: user.id,
        url: data.url,
        extractedId,
        type: streamType,
        title,
        smallImg,
        bigImg,
        isPublic: data.isPublic ?? creator.isPublic,
      },
    });

    return NextResponse.json(
      {
        ...stream,
        haveUpvoted: false,
        upvotes: 0,
      },
      { status: 201 },
    ); // was: 200, now: 201 (created)
  } catch (e: unknown) {
    return NextResponse.json(
      {
        message: 'Error while adding a Stream: ' + e,
      },
      {
        status: 400, // was: 411, now: 400 (validation error)
      },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const creatorId = req.nextUrl.searchParams.get('creatorId');
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json(
        {
          message: 'Unauthenticated',
        },
        {
          status: 403,
        },
      );
    }

    if (!creatorId) {
      return NextResponse.json(
        {
          message: 'Error: No creatorId provided',
        },
        {
          status: 400, // was: 411, now: 400 (validation error)
        },
      );
    }

    const [user, creator] = await Promise.all([
      prismaClient.user.findFirst({
        where: {
          email: session.user.email,
        },
      }),
      prismaClient.user.findUnique({
        where: { id: creatorId },
        select: { id: true, isPublic: true, partyCode: true },
      }),
    ]);

    if (!user) {
      return NextResponse.json(
        {
          message: 'User not found',
        },
        {
          status: 404, // was: 403, now: 404 (not found)
        },
      );
    }

    if (!creator) {
      return NextResponse.json({ message: 'Creator not found' }, { status: 404 });
    }

    if (!creator) {
      return NextResponse.json({ message: 'Creator not found' }, { status: 404 });
    }

    // Use Stream Roles to check access
    const streamRole = await getStreamRole(user.id, creatorId);

    let accessStatus: string | null = 'APPROVED';

    if (streamRole === 'BANNED') {
      accessStatus = 'BANNED';
    } else {
      const canBypass = ['CREATOR', 'MODERATOR', 'OWNER'].includes(streamRole);
      if (!creator.isPublic && !canBypass) {
        const resetAccess = req.nextUrl.searchParams.get('resetAccess') === 'true';

        if (resetAccess) {
          logger.info(`🔄 Resetting access for user ${user.id} on creator ${creator.id}`);
          await prismaClient.streamAccess.upsert({
            where: {
              streamerId_viewerId: {
                streamerId: creator.id,
                viewerId: user.id,
              },
            },
            update: { status: 'PENDING' },
            create: {
              streamerId: creator.id,
              viewerId: user.id,
              status: 'PENDING',
            },
          });
          accessStatus = 'PENDING';
        } else {
          const access = await prismaClient.streamAccess.findUnique({
            where: {
              streamerId_viewerId: {
                streamerId: creator.id,
                viewerId: user.id,
              },
            },
          });
          accessStatus = access?.status || null;
        }
      }
    }

    const [streams, activeStream] = await Promise.all([
      prismaClient.stream.findMany({
        where: {
          userId: creatorId,
          played: false,
        },
        orderBy: [
          {
            upvotes: {
              _count: 'desc',
            },
          },
          {
            createdAt: 'asc',
          },
        ],
        include: {
          _count: {
            select: {
              upvotes: true,
            },
          },
          upvotes: {
            where: {
              userId: user.id,
            },
          },
        },
      }),
      prismaClient.currentStream.findFirst({
        where: {
          userId: creatorId,
        },
        include: {
          stream: true,
        },
      }),
    ]);

    const member = await prismaClient.sessionMember.findUnique({
      where: { userId_creatorId: { userId: user.id, creatorId: creator.id } },
      select: { isBanned: true, bannedUntil: true, banReason: true },
    });

    const restriction =
      user.isBanned || (user.bannedUntil && new Date(user.bannedUntil) > new Date())
        ? {
            isBanned: user.isBanned,
            bannedUntil: user.bannedUntil,
            reason: user.banReason,
            scope: 'PLATFORM',
          }
        : member &&
            (member.isBanned || (member.bannedUntil && new Date(member.bannedUntil) > new Date()))
          ? {
              isBanned: member.isBanned,
              bannedUntil: member.bannedUntil,
              reason: member.banReason,
              scope: 'STREAM',
            }
          : null;

    logger.info('GET /api/streams: Access check completed');

    return NextResponse.json({
      streams: streams.map(({ _count, ...rest }) => ({
        ...rest,
        upvotes: _count.upvotes,
        haveUpvoted: rest.upvotes.length ? true : false,
      })),
      activeStream,
      currentUserId: user.id,
      creator: {
        id: creator.id,
        isPublic: creator.isPublic,
        partyCode: creator.partyCode,
      },
      accessStatus,
      streamRole,
      restriction,
    });
  } catch (e: unknown) {
    logger.error({ err: e }, '❌ GET /api/streams failed:');
    return NextResponse.json(
      {
        message: 'Internal server error',
        error: e instanceof Error ? e.message : 'Unknown error',
      },
      {
        status: 500,
      },
    );
  }
}
