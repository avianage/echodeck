import { getToken } from "next-auth/jwt";
import { prismaClient } from "@/app/lib/db";
import { NextRequest, NextResponse } from "next/server";

const secret = process.env.NEXTAUTH_SECRET;

export async function GET(req: NextRequest) {

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

    const streams = await prismaClient.stream.findMany({
        where: { 
            userId: user.id 
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
