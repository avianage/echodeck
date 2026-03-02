import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prismaClient } from "@/app/lib/db";
// @ts-expect-error No Types available
import youtubesearchapi from "youtube-search-api";
import { YT_REGEX } from "@/app/lib/utils";
import { getServerSession } from "next-auth";
import { pusherServer } from "@/app/lib/pusher";
import { authOptions } from "@/app/lib/auth";

const CreateStreamSchema = z.object({
    creatorId: z.string(),
    url: z.string()
})

const MAX_QUEUE_LENGTH = 20;

export async function POST(req: NextRequest) {
    try {
        const data = CreateStreamSchema.parse(await req.json());
        const isYt = data.url.match(YT_REGEX)

        if (!isYt) {
            return NextResponse.json({
                message: "Wrong URL format"
            }, {
                status: 411
            })
        }

        const match = data.url.match(YT_REGEX);
        const extractedId = match ? match[1] : null;

        if (!extractedId) {
            return NextResponse.json({
                message: "Invalid YouTube URL. Could not extract video ID."
            }, {
                status: 411
            })
        }

        console.log(`🎥 Fetching details for video: ${extractedId}`);
        let res;
        try {
            res = await youtubesearchapi.GetVideoDetails(extractedId);
            if (!res || !res.thumbnail) {
                throw new Error("Invalid response from YouTube API");
            }
        } catch (e: any) {
            console.error(`❌ YoutubeSearchApi.GetVideoDetails failed for ${extractedId}:`, e);
            return NextResponse.json({
                message: `Failed to fetch video details: ${e.message || "Timeout or API error"}. Video skipped.`
            }, {
                status: 400
            });
        }

        let thumbnails = [];
        try {
            thumbnails = res.thumbnail?.thumbnails || [];
            if (thumbnails.length > 0) {
                thumbnails.sort((a: { width: number }, b: { width: number }) => a.width < b.width ? -1 : 1);
            }
        } catch (e) {
            console.error("Error sorting thumbnails:", e);
        }

        const smallImg = thumbnails.length > 1
            ? thumbnails[thumbnails.length - 2].url
            : (thumbnails.length > 0 ? thumbnails[0].url : `https://img.youtube.com/vi/${extractedId}/mqdefault.jpg`);

        const bigImg = thumbnails.length > 0
            ? thumbnails[thumbnails.length - 1].url
            : `https://img.youtube.com/vi/${extractedId}/maxresdefault.jpg`;

        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ message: "Unauthenticated" }, { status: 403 });
        }

        const user = await prismaClient.user.findUnique({
            where: {
                email: session.user.email,
            },
        });

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 403 });
        }

        const existingActiveStream = await prismaClient.stream.count({
            where: {
                userId: data.creatorId
            }
        })

        if (existingActiveStream > MAX_QUEUE_LENGTH) {
            return NextResponse.json({
                message: "Stream Queue At limit"
            }, {
                status: 411
            })
        }

        const stream = await prismaClient.stream.create({
            data: {
                userId: data.creatorId,
                addedById: user.id,
                url: data.url,
                extractedId,
                type: "Youtube",
                title: res.title || "YouTube Video",
                smallImg,
                bigImg
            }
        });

        await pusherServer.trigger(data.creatorId, "stream-update", {
            message: "New stream added"
        });

        return NextResponse.json({
            ...stream,
            haveUpvoted: false,
            upvotes: 0

        })

    } catch (e) {
        return NextResponse.json({
            message: "Error while adding a Stream: " + e
        }, {
            status: 411
        })
    }
}

export async function GET(req: NextRequest) {
    const creatorId = req.nextUrl.searchParams.get("creatorId");
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
        return NextResponse.json({
            message: "Unauthenticated"
        }, {
            status: 403
        });
    }

    const user = await prismaClient.user.findFirst({
        where: {
            email: session.user.email
        }
    });

    if (!user) {
        return NextResponse.json({
            message: "User not found"
        }, {
            status: 403
        });
    }


    try {
        if (!creatorId) {
            return NextResponse.json({
                message: "Error: No creatorId provided"
            }, {
                status: 411
            })
        }

        const [streams, activeStream] = await Promise.all([
            prismaClient.stream.findMany({
                where: {
                    userId: creatorId,
                    played: false
                },
                include: {
                    _count: {
                        select: {
                            upvotes: true
                        }
                    },
                    upvotes: {
                        where: {
                            userId: user.id
                        }
                    }
                }
            }),
            prismaClient.currentStream.findFirst({
                where: {
                    userId: creatorId
                },
                include: {
                    stream: true
                }
            })
        ]);

        return NextResponse.json({
            streams: streams.map(({ _count, ...rest }: any) => ({
                ...rest,
                upvotes: _count.upvotes,
                haveUpvoted: rest.upvotes.length ? true : false
            })),
            activeStream,
            currentUserId: user.id
        });
    } catch (e: any) {
        console.error("❌ GET /api/streams failed:", e);
        return NextResponse.json({
            message: "Internal server error",
            error: e.message
        }, {
            status: 500
        });
    }
}