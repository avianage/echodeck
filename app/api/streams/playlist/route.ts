import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
// @ts-expect-error No types available
import YouTubeSearchApi from "youtube-search-api";
import { z } from "zod";
import { PLAYLIST_REGEX, SPOTIFY_PLAYLIST_REGEX } from "@/app/lib/utils";
import { getSpotifyApi, getUserSpotifyApi } from "@/app/lib/spotify";
import { authOptions } from "@/app/lib/auth";
// @ts-expect-error No types available
import spotifyUrlInfo from "spotify-url-info";

const { getTracks } = spotifyUrlInfo(fetch as any);

function formatDurationMs(durationMs: number | null | undefined) {
    if (!durationMs || durationMs <= 0) return "";
    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function spotifyTrackUrlFromUri(uri: string | null | undefined) {
    if (!uri) return "";
    // Expected: spotify:track:<id>
    const parts = uri.split(":");
    if (parts.length >= 3 && parts[0] === "spotify" && parts[1] === "track") {
        return `https://open.spotify.com/track/${parts[2]}`;
    }
    return "";
}

async function getAllSpotifyPlaylistTracks(playlistId: string, sessionAccessToken?: string) {
    let allTracks: any[] = [];
    let title = "Spotify Playlist";

    // helper to fetch via an API instance
    const tryApi = async (api: any) => {
        const response = await api.getPlaylist(playlistId);
        const playlistTitle = response?.body?.name || "Spotify Playlist";

        const tracksRes = await api.getPlaylistTracks(playlistId);
        const tracks = tracksRes?.body?.items || [];
        const total = tracksRes?.body?.total || tracks.length;

        let fetchedTracks = [...tracks];
        let offset = tracks.length;
        const limit = 100;

        while (fetchedTracks.length < total) {
            const page = await api.getPlaylistTracks(playlistId, { limit, offset } as any);
            const pageItems = page?.body?.items || [];
            fetchedTracks.push(...pageItems);
            if (pageItems.length < limit) break;
            offset += limit;
        }
        return { title: playlistTitle, tracks: fetchedTracks };
    };

    // 1. Try User Access Token if available
    if (sessionAccessToken) {
        try {
            console.log(`📡 Trying User Token for playlist: ${playlistId}`);
            const userApi = getUserSpotifyApi(sessionAccessToken);
            if (userApi) {
                const result = await tryApi(userApi);
                console.log(`✅ Success via User Token!`);
                return { ...result, error: null };
            }
        } catch (err: any) {
            console.warn(`⚠️ User Token failed (possibly expired): ${err.message}`);
        }
    }

    // 2. Try App Client Credentials
    try {
        console.log(`📡 Trying Client Credentials for playlist: ${playlistId}`);
        const appApi = await getSpotifyApi();
        if (appApi) {
            const result = await tryApi(appApi);
            console.log(`✅ Success via Client Credentials!`);
            return { ...result, error: null };
        }
    } catch (err: any) {
        console.warn(`⚠️ Client Credentials failed: ${err.message}`);
    }

    // 3. Fallback to Scraping
    try {
        console.log(`📡 Falling back to SCRAPE for playlist: ${playlistId}`);
        const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
        const scraped = await getTracks(playlistUrl);
        console.log(`✅ SCRAPE Succeeded! Found ${scraped.length} tracks.`);

        const mappedTracks = scraped.map((t: any) => ({
            track: {
                id: t.id,
                name: t.name,
                artists: t.artists || [{ name: t.artist || "Unknown Artist" }],
                duration_ms: t.duration_ms || t.duration || 0,
                external_urls: { spotify: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}` },
                uri: t.uri || `spotify:track:${t.id}`,
                album: { images: t.album?.images || [] }
            }
        }));
        return { title: "Scraped Playlist", tracks: mappedTracks, error: null };
    } catch (scrapeErr: any) {
        console.error("❌ All Spotify fetch methods failed.", scrapeErr.message);
        return { title: null, tracks: [], error: "Failed to fetch Spotify playlist from all available sources." };
    }
}

const PlaylistSchema = z.object({
    playlistId: z.string().optional(),
    url: z.string().optional()
});

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions) as any;

    if (!session?.user) {
        return NextResponse.json(
            { message: "Unauthenticated" },
            { status: 403 }
        );
    }

    try {
        const body = await req.json();
        const { playlistId, url } = PlaylistSchema.parse(body);

        let activeUrl = url || "";
        let activePlaylistId = playlistId;

        // If URL is provided, try to extract playlist ID or treat as Spotify playlist URL
        if (activeUrl) {
            const ytMatch = activeUrl.match(PLAYLIST_REGEX);
            const spotMatch = activeUrl.match(SPOTIFY_PLAYLIST_REGEX);

            if (ytMatch) {
                activePlaylistId = ytMatch[1];
            } else if (spotMatch) {
                try {
                    const playlistIdFromUrl = spotMatch[1];
                    const { title: playlistTitle, tracks, error } = await getAllSpotifyPlaylistTracks(
                        playlistIdFromUrl,
                        session?.accessToken
                    );

                    if (error) {
                        return NextResponse.json({ message: error }, { status: 500 });
                    }

                    if (!tracks.length) {
                        return NextResponse.json(
                            { message: "Playlist empty or not accessible" },
                            { status: 404 }
                        );
                    }

                    console.log("✅ Spotify playlist tracks received", {
                        playlistId: playlistIdFromUrl,
                        title: playlistTitle,
                        trackCount: tracks.length,
                    });

                    // Map Spotify playlist tracks to base items
                    const baseVideos = tracks
                        .map((it: any) => {
                            const track = it?.track;
                            if (!track) return null;

                            const id = track?.id;
                            const name = track?.name;
                            if (!name) return null;

                            const artistNames = Array.isArray(track?.artists)
                                ? track.artists.map((a: any) => a?.name).filter(Boolean).join(", ")
                                : "Unknown";

                            const durationMs = typeof track?.duration_ms === "number" ? track.duration_ms : 0;
                            const duration = formatDurationMs(durationMs);
                            const images = track?.album?.images || [];
                            const thumbnail = images?.[0]?.url || "";

                            const spotifyUrl =
                                track?.external_urls?.spotify ||
                                (id ? `https://open.spotify.com/track/${id}` : "") ||
                                spotifyTrackUrlFromUri(track?.uri);

                            return {
                                id,
                                title: `${name} by ${artistNames || "Unknown"}`,
                                thumbnail,
                                duration,
                                isSpotify: true,
                                url: spotifyUrl,
                                originalSpotifyUrl: spotifyUrl,
                            };
                        })
                        .filter(Boolean) as any[];

                    // For each Spotify track, try to resolve a YouTube video
                    const resolvedVideos = await Promise.all(
                        baseVideos.map(async (video) => {
                            try {
                                const tryResolution = async (query: string) => {
                                    try {
                                        const res = await YouTubeSearchApi.GetListByKeyword(query, false, 5, [{ type: "video" }]);
                                        return res?.items || [];
                                    } catch (err) {
                                        return [];
                                    }
                                };

                                console.log(`🔍 Resolving Spotify track from playlist: ${video.title}`);
                                const items = await tryResolution(video.title);
                                if (items.length === 0) return video;

                                const ytId = items[0].id;
                                if (!ytId) return video;

                                return {
                                    ...video,
                                    id: ytId,
                                    thumbnail: items[0].thumbnail?.thumbnails?.[0]?.url ?? video.thumbnail ?? "",
                                    isSpotify: false,
                                    url: `https://www.youtube.com/watch?v=${ytId}`,
                                    source: "spotify-web-api-node",
                                };
                            } catch (err) {
                                console.error(`YouTube resolution failed for Spotify track: ${video.title}`, err);
                                return video;
                            }
                        })
                    );

                    return NextResponse.json({
                        title: playlistTitle,
                        videos: resolvedVideos,
                    });
                } catch (spotifyErr: any) {
                    console.error("Spotify playlist load error:", spotifyErr?.message || spotifyErr);
                    return NextResponse.json(
                        { message: "Could not load Spotify playlist. Make sure it's public." },
                        { status: 404 }
                    );
                }
            }
        }

        if (!activePlaylistId) {
            return NextResponse.json({ message: "Invalid playlist URL or ID" }, { status: 400 });
        }

        // Default to YouTube handling
        const data = await YouTubeSearchApi.GetPlaylistData(activePlaylistId);

        if (!data || !data.items) {
            return NextResponse.json(
                { message: "Playlist not found or empty" },
                { status: 404 }
            );
        }

        const ytVideos = data.items.map((item: any) => ({
            id: item.id,
            title: item.title,
            thumbnail: item.thumbnail?.thumbnails?.[0]?.url || "",
            duration: item.lengthText || "",
            url: `https://www.youtube.com/watch?v=${item.id}`
        }));

        return NextResponse.json({
            title: data.title,
            videos: ytVideos,
        });
    } catch (e) {
        console.error("Playlist API Error:", e);
        return NextResponse.json(
            { message: "Error fetching playlist" },
            { status: 500 }
        );
    }
}
