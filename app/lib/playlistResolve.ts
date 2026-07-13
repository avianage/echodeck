import { z } from 'zod';
import { getSpotifyApi, getUserSpotifyApi } from '@/app/lib/spotify';
import type { SpotifyTrack } from '@/types/spotify';
import { logger } from '@/lib/logger';

// Unlike YT_REGEX/SPOTIFY_TRACK_REGEX (app/lib/utils.ts), which are anchored
// (`^...$`) because they're used elsewhere to decide "is this whole input a
// raw link", these match a link occurring *anywhere* in a pasted line — a
// user pasting "Blinding Lights - https://youtu.be/4NRXx6U8ABQ" (name and
// link together) should still have the link recognized and used directly,
// instead of the whole garbled line being treated as one plain-text search.
const YT_LINK_ANYWHERE =
  /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtu\.be\/|youtube\.com\/(?:v\/|embed\/|watch(?:\/|\?v=)))([a-zA-Z0-9_-]{11})/;
const SPOTIFY_TRACK_LINK_ANYWHERE =
  /(?:https?:\/\/)?(?:open\.)?spotify\.com\/track\/([a-zA-Z0-9]+)/;

// Cache YouTube-match lookups by search query so repeated imports of the same
// tracks (popular songs show up across many playlists) don't re-hit the
// external search API every time. TTL keeps stale/removed videos from lingering.
const YT_MATCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const ytMatchCache = new Map<
  string,
  { id: string | null; title: string; thumbnail: string; expiresAt: number }
>();

const INNERTUBE_HEADERS = {
  'Content-Type': 'application/json',
  'Cookie': 'SOCS=CAE=',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.youtube.com',
};

const INNERTUBE_CONTEXT = {
  client: { clientName: 'WEB', clientVersion: '2.20240101', hl: 'en', gl: 'US' },
};

async function searchYouTubeInnerTube(
  query: string,
): Promise<{ id: string; title: string; thumbnail: string } | null> {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: INNERTUBE_HEADERS,
      body: JSON.stringify({ context: INNERTUBE_CONTEXT, query }),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents;
    if (!Array.isArray(contents)) return null;

    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const vr = item?.videoRenderer;
        if (!vr?.videoId) continue;
        return {
          id: vr.videoId,
          title: vr.title?.runs?.[0]?.text ?? '',
          thumbnail: vr.thumbnail?.thumbnails?.[0]?.url ?? '',
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveYouTubeMatch(query: string) {
  const cached = ytMatchCache.get(query);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const hit = await searchYouTubeInnerTube(query);
  const result = {
    id: hit?.id ?? null,
    title: hit?.title ?? '',
    thumbnail: hit?.thumbnail ?? '',
    expiresAt: Date.now() + YT_MATCH_CACHE_TTL_MS,
  };
  ytMatchCache.set(query, result);
  return result;
}

// Runs async work over `items` with at most `concurrency` in flight at once,
// so a large playlist import doesn't fire off hundreds of simultaneous
// external requests (which was causing the resolver to self-throttle/timeout).
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

interface ResolvedMixedTrack {
  extractedId: string;
  title: string;
  thumbnail: string;
  url: string;
  type: 'Youtube' | 'Spotify';
}

async function resolveYouTubeLinkLine(videoId: string): Promise<ResolvedMixedTrack | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      extractedId: videoId,
      title: data.title || 'YouTube Video',
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      type: 'Youtube',
    };
  } catch {
    return null;
  }
}

async function resolveSpotifyLinkLine(spotifyId: string): Promise<ResolvedMixedTrack | null> {
  try {
    const api = await getSpotifyApi();
    if (!api) return null;
    const res = await api.getTrack(spotifyId);
    const track = res.body;
    const artistNames = track.artists.map((a) => a.name).join(', ');
    const title = `${track.name} by ${artistNames}`;

    const match = await resolveYouTubeMatch(`${track.name} ${artistNames}`);
    if (!match.id) return null;

    return {
      extractedId: match.id,
      title,
      thumbnail: match.thumbnail || track.album?.images?.[0]?.url || '',
      url: `https://www.youtube.com/watch?v=${match.id}`,
      type: 'Spotify',
    };
  } catch {
    return null;
  }
}

// Used by playlist creation-from-paste and the manual-paste queue fallback:
// recognizes a YouTube/Spotify track link per line and resolves it directly
// instead of treating the whole line as a search query (which would search
// for the raw URL text) — falls back to a plain-text search otherwise.
export async function resolveMixedTrackLines(lines: string[]): Promise<ResolvedMixedTrack[]> {
  const trimmed = lines.map((l) => l.trim()).filter(Boolean);

  const resolved = await mapWithConcurrency(trimmed, 5, async (line) => {
    const ytMatch = line.match(YT_LINK_ANYWHERE);
    if (ytMatch) return resolveYouTubeLinkLine(ytMatch[1]);

    const spotifyMatch = line.match(SPOTIFY_TRACK_LINK_ANYWHERE);
    if (spotifyMatch) return resolveSpotifyLinkLine(spotifyMatch[1]);

    const match = await resolveYouTubeMatch(line);
    if (!match.id) return null;
    return {
      extractedId: match.id,
      title: match.title || line,
      thumbnail: match.thumbnail,
      url: `https://www.youtube.com/watch?v=${match.id}`,
      type: 'Youtube' as const,
    };
  });

  return resolved.filter((v): v is NonNullable<typeof v> => v !== null);
}

async function getAllSpotifyPlaylistTracks(playlistId: string, sessionAccessToken?: string) {
  const _allTracks: SpotifyTrack[] = [];
  const _title = 'Spotify Playlist';

  // helper to fetch via an API instance
  const tryApi = async (api: {
    getPlaylist: (id: string) => Promise<unknown>;
    getPlaylistTracks: (id: string, opts?: { limit?: number; offset?: number }) => Promise<unknown>;
  }) => {
    const response = (await api.getPlaylist(playlistId)) as {
      body?: { name?: string } | null;
    } | null;
    const playlistTitle = response?.body?.name || 'Spotify Playlist';

    const tracksRes = (await api.getPlaylistTracks(playlistId)) as {
      body?: { items?: Array<{ track?: SpotifyTrack } | null> | null; total?: number } | null;
    } | null;
    const tracks = tracksRes?.body?.items ?? [];
    const total = tracksRes?.body?.total ?? tracks.length;

    const fetchedTracks = [...tracks];
    let offset = tracks.length;
    const limit = 100;

    while (fetchedTracks.length < total) {
      const page = (await api.getPlaylistTracks(playlistId, { limit, offset })) as {
        body?: { items?: Array<{ track?: SpotifyTrack } | null> | null; total?: number } | null;
      } | null;
      const pageItems = page?.body?.items ?? [];
      fetchedTracks.push(...pageItems);
      if (pageItems.length < limit) break;
      offset += limit;
    }
    return { title: playlistTitle, tracks: fetchedTracks };
  };

  // 1. Try User Access Token if available
  if (sessionAccessToken) {
    try {

      logger.info(`📡 Trying User Token for playlist: ${playlistId}`);
      const userApi = getUserSpotifyApi(sessionAccessToken);
      if (userApi) {
        const result = await tryApi(userApi);

        logger.info(`✅ Success via User Token!`);
        return { ...result, error: null };
      }
    } catch (err: unknown) {

      logger.warn(`⚠️ User Token failed (possibly expired): ${(err as Error).message}`);
    }
  }

  // 2. Try App Client Credentials
  try {

    logger.info(`📡 Trying Client Credentials for playlist: ${playlistId}`);
    const appApi = await getSpotifyApi();
    if (appApi) {
      const result = await tryApi(appApi);

      logger.info(`✅ Success via Client Credentials!`);
      return { ...result, error: null };
    }
  } catch (err: unknown) {

    logger.warn(`⚠️ Client Credentials failed: ${(err as Error).message}`);
  }

  // 3. Scraping is NOT a valid fallback for a full playlist: `getTracks()`
  // only reads Spotify's public oEmbed preview, which exposes a small,
  // arbitrary sample of tracks — not the playlist's real contents — with no
  // way to tell "this genuinely is the whole playlist" from "this is a wrong
  // partial slice of a much bigger one". Both official paths above failing
  // means Spotify's playlist-track endpoints are currently restricted for
  // this app (see the Nov 2024 Web API policy changes — full playlist-track
  // access requires Spotify's Extended Quota Mode approval), not something
  // scraping can safely paper over. Surface that honestly instead of
  // silently queuing wrong/incomplete tracks.
  logger.error(`❌ Spotify playlist fetch failed (both auth methods) for: ${playlistId}`);
  return {
    title: null,
    tracks: [],
    error:
      "Could not load this Spotify playlist — Spotify has restricted full playlist access for this app pending approval. Try again once that's resolved.",
  };
}

// Loosely mirrors the InnerTube `browse` response shape used below. Every
// field is optional/nullable because this is an unofficial, undocumented
// endpoint that YouTube can reshape at any time without notice — validating
// here means a shape change fails safely (returns null) instead of throwing
// deep inside a chain of `as` casts.
const InnerTubeThumbnailSourceSchema = z.object({ url: z.string() });

const InnerTubeLockupViewModelSchema = z.object({
  contentId: z.string().optional(),
  metadata: z
    .object({
      lockupMetadataViewModel: z
        .object({
          title: z.object({ content: z.string().optional() }).optional(),
        })
        .optional(),
    })
    .optional(),
  contentImage: z
    .object({
      thumbnailViewModel: z
        .object({
          image: z
            .object({ sources: z.array(InnerTubeThumbnailSourceSchema).optional() })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

const InnerTubeItemSchema = z.object({
  lockupViewModel: InnerTubeLockupViewModelSchema.optional(),
});

const InnerTubeBrowseResponseSchema = z.object({
  header: z
    .object({
      pageHeaderRenderer: z
        .object({
          pageTitle: z.string().optional(),
          content: z
            .object({
              pageHeaderViewModel: z
                .object({
                  // Confirmed live against a real playlist response: YouTube
                  // now wraps this in a dynamicTextViewModel, not a plain
                  // string — accept both so older/newer responses both parse.
                  title: z
                    .union([
                      z.string(),
                      z.object({
                        dynamicTextViewModel: z
                          .object({
                            text: z.object({ content: z.string().optional() }).optional(),
                          })
                          .optional(),
                      }),
                    ])
                    .optional(),
                })
                .optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
  contents: z
    .object({
      twoColumnBrowseResultsRenderer: z
        .object({
          tabs: z
            .array(
              z.object({
                tabRenderer: z
                  .object({
                    content: z
                      .object({
                        sectionListRenderer: z
                          .object({
                            contents: z
                              .array(
                                z.object({
                                  itemSectionRenderer: z
                                    .object({ contents: z.array(InnerTubeItemSchema).optional() })
                                    .optional(),
                                }),
                              )
                              .optional(),
                          })
                          .optional(),
                      })
                      .optional(),
                  })
                  .optional(),
              }),
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

export async function fetchYouTubePlaylist(playlistId: string) {
  const res = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST',
    headers: INNERTUBE_HEADERS,
    body: JSON.stringify({ context: INNERTUBE_CONTEXT, browseId: `VL${playlistId}` }),
  });

  if (!res.ok) throw new Error(`InnerTube browse failed: ${res.status}`);
  const raw = await res.json();

  const parsed = InnerTubeBrowseResponseSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn(
      { issues: parsed.error.issues, topLevelKeys: Object.keys(raw ?? {}) },
      'InnerTube browse response did not match expected shape (YouTube may have changed it)',
    );
    return null;
  }
  const data = parsed.data;

  // Extract title
  const header = data.header?.pageHeaderRenderer;
  const rawTitle = header?.content?.pageHeaderViewModel?.title;
  const viewModelTitle =
    typeof rawTitle === 'string' ? rawTitle : rawTitle?.dynamicTextViewModel?.text?.content;
  const title = header?.pageTitle || viewModelTitle || 'YouTube Playlist';

  // Extract videos from itemSectionRenderer > lockupViewModel items
  const tabs = data.contents?.twoColumnBrowseResultsRenderer?.tabs;
  const contents = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
  const items = contents?.[0]?.itemSectionRenderer?.contents;

  if (!items?.length) return null;

  const videos = items
    .map((item) => {
      const vm = item.lockupViewModel;
      if (!vm) return null;
      const videoId = vm.contentId;
      if (!videoId) return null;
      const videoTitle = vm.metadata?.lockupMetadataViewModel?.title?.content || 'YouTube Video';
      const sources = vm.contentImage?.thumbnailViewModel?.image?.sources;
      const thumbnail = sources?.[0]?.url || '';
      return {
        id: videoId,
        title: videoTitle,
        thumbnail,
        duration: '',
        url: `https://www.youtube.com/watch?v=${videoId}`,
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return { title, videos };
}

export { getAllSpotifyPlaylistTracks };
