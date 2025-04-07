import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prismaClient } from "@/app/lib/db";
// @ts-expect-error No Types available
import youtubesearchapi from "youtube-search-api";
import { YT_REGEX } from "@/app/lib/utils";
import { getToken } from "next-auth/jwt";

const CreateStreamSchema = z.object({
    creatorId: z.string(),
    url: z.string() 
})


export async function POST(req: NextRequest) {
    try {        
        const data = CreateStreamSchema.parse(await req. json());
        const isYt = data.url.match(YT_REGEX)
        
        if (!isYt) {
            return NextResponse.json({
                message: "Wrong URL format"
            },{
                status: 411
            })
        }

        const extractedId = data.url.split("?v=")[1];

        const res = await youtubesearchapi.GetVideoDetails(extractedId);
        console.log(res.title);
        console.log(res.thumbnail.thumbnails);
        const thumbnails = res.thumbnail.thumbnails;
        thumbnails.sort((a: {width: number}, b: {width: number}) => a.width < b.width ? -1 : 1);
        

        const stream = await prismaClient.stream.create({
            data: {
                userId: data.creatorId,
                url: data.url,
                extractedId,
                type: "Youtube",
                title: res.title ?? "Cant Find Video",
                smallImg: thumbnails.length > 1 ? thumbnails[thumbnails.length - 2].url : thumbnails[thumbnails.length - 1].url ?? "https://img.freepik.com/free-vector/oops-404-error-with-broken-robot-concept-illustration_114360-5529.jpg", 
                bigImg:  thumbnails[thumbnails.length - 1].url ?? "https://img.freepik.com/free-vector/oops-404-error-with-broken-robot-concept-illustration_114360-5529.jpg"
            }    
        });

        return NextResponse.json({
            ...stream,
            hasUpvoted: false,
            upvotes: 0

        })

    } catch(e) {
        return NextResponse.json({
            message: "Error while adding a Stream: " + e
        }, {
            status: 411
        })
    }
}

const secret = process.env.NEXTAUTH_SECRET;

export async function GET(req: NextRequest) {
    const creatorId = req.nextUrl.searchParams.get("creatorId");
    const token = await getToken({ req, secret });
    
        if (!token || !token.email) {
            return NextResponse.json({ 
                message: "Unauthenticated" 
            }, { 
                status: 403 
            });
        }
    
        const user = await prismaClient.user.findFirst({
            where: { 
                email: token.email 
            }
        });
    
        if (!user) {
            return NextResponse.json({ 
                message: "User not found" 
            }, { 
                status: 403 
            });
        }
    
    
    if (!creatorId) {
        return NextResponse.json({
            message: "Error"
        }, {
            status: 411
        })
    }
    const streams = await prismaClient.stream.findMany({
        where: { 
            userId: creatorId 
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
    })

    return NextResponse.json({ 
        streams: streams.map(({_count, ...rest}) => ({
            ...rest,
            upvotes: _count.upvotes,
            haveUpvoted: rest.upvotes.length ? true : false
        }))
    })
}