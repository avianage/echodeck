import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
// @ts-ignore
import YouTubeSearchApi from "youtube-search-api";
import { z } from "zod";

const PlaylistSchema = z.object({
    playlistId: z.string(),
});

export async function POST(req: NextRequest) {
    const session = await getServerSession();

    if (!session?.user) {
        return NextResponse.json(
            { message: "Unauthenticated" },
            { status: 403 }
        );
    }

    try {
        const body = await req.json();
        const { playlistId } = PlaylistSchema.parse(body);

        const data = await YouTubeSearchApi.GetPlaylistData(playlistId);

        if (!data || !data.items) {
            return NextResponse.json(
                { message: "Playlist not found or empty" },
                { status: 404 }
            );
        }

        const videos = data.items.map((item: any) => ({
            id: item.id,
            title: item.title,
            thumbnail: item.thumbnail?.thumbnails?.[0]?.url || "",
            duration: item.lengthText || "",
        }));

        return NextResponse.json({
            title: data.title,
            videos,
        });
    } catch (e) {
        console.error("Playlist API Error:", e);
        return NextResponse.json(
            { message: "Error fetching playlist" },
            { status: 500 }
        );
    }
}
