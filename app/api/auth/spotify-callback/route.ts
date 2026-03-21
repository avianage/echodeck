export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prismaClient } from "@/app/lib/db";

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");
    const userId = req.nextUrl.searchParams.get("state");

    if (!code || !userId) {
        return NextResponse.redirect(new URL("/account?error=spotify_link_failed", process.env.NEXTAUTH_URL || "https://echodeck.avianage.in"));
    }

    try {
        // Exchange code for tokens
        const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${Buffer.from(
                    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                ).toString("base64")}`
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/spotify-callback`
            })
        });

        const tokens = await tokenRes.json();

        if (tokens.error) {
            console.error("Spotify token error:", tokens);
            throw new Error(tokens.error_description || tokens.error);
        }

        await prismaClient.user.update({
            where: { id: userId },
            data: {
                spotifyConnected: true,
                spotifyAccessToken: tokens.access_token,
                spotifyRefreshToken: tokens.refresh_token,
                spotifyTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000)
            }
        });

        return NextResponse.redirect(new URL("/account?spotify=connected", process.env.NEXTAUTH_URL || "https://echodeck.avianage.in"));
    } catch (err) {
        console.error("Spotify callback error:", err);
        return NextResponse.redirect(new URL("/account?error=spotify_link_failed", process.env.NEXTAUTH_URL || "https://echodeck.avianage.in"));
    }
}

