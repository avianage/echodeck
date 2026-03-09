import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
// @ts-expect-error No Types available
import YouTubeSearchApi from "youtube-search-api";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ message: "Unauthenticated" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q");

        if (!query) {
            return NextResponse.json({ items: [] });
        }

        console.log(`🔍 Search API: Searching for "${query}" with Topic prioritization`);

        // We try two searches to get a good mix: Topic/Official Audio and the raw query
        const [topicResults, rawResults] = await Promise.all([
            YouTubeSearchApi.GetListByKeyword(`${query} official audio`, false, 10, [{ type: 'video' }]),
            YouTubeSearchApi.GetListByKeyword(query, false, 10, [{ type: 'video' }])
        ]);

        const allItems = [...(topicResults?.items || []), ...(rawResults?.items || [])];

        // Deduplicate and Prioritize Topic channels
        const seen = new Set();
        const prioritized = allItems.filter(item => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        }).sort((a, b) => {
            const aTitle = (a.channelTitle || "").toLowerCase();
            const bTitle = (b.channelTitle || "").toLowerCase();
            const aIsTopic = aTitle.endsWith("- topic") || aTitle.includes("official audio");
            const bIsTopic = bTitle.endsWith("- topic") || bTitle.includes("official audio");

            if (aIsTopic && !bIsTopic) return -1;
            if (!aIsTopic && bIsTopic) return 1;
            return 0;
        });

        // Limit to top 10 for the UI
        const finalItems = prioritized.slice(0, 10).map(item => ({
            id: item.id,
            title: item.title,
            thumbnail: item.thumbnail?.thumbnails?.[0]?.url || "",
            channelTitle: item.channelTitle,
            duration: item.lengthText
        }));

        return NextResponse.json({ items: finalItems });
    } catch (e) {
        console.error("❌ Search API Error:", e);
        return NextResponse.json({ message: "Search failed" }, { status: 500 });
    }
}
