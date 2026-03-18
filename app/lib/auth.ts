import { prismaClient } from "@/app/lib/db";
import GoogleProvider from "next-auth/providers/google";
import SpotifyProvider from "next-auth/providers/spotify";
import { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        }),
        SpotifyProvider({
            clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
            authorization:
                "https://accounts.spotify.com/authorize?scope=user-read-email%20playlist-read-private%20playlist-read-collaborative%20user-read-private%20user-library-read",
        })
    ],
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async signIn({ user, account }) {
            if (!user.email) return false;
            try {
                const existingUser = await prismaClient.user.findUnique({
                    where: { email: user.email },
                });

                if (!existingUser) {
                    await prismaClient.user.create({
                        data: {
                            email: user.email,
                            provider: (account?.provider === "spotify" ? "Spotify" : "Google") as any,
                        },
                    });
                }
            } catch (e) {
                console.error("Signin Error: ", e);
                return false;
            }
            return true;
        },
        async jwt({ token, user: nextAuthUser, account }) {
            // Initial sign in
            if (account) {
                token.accessToken = account.access_token;
                token.provider = account.provider;
            }

            if (nextAuthUser && nextAuthUser.email) {
                try {
                    const dbUser = await prismaClient.user.findUnique({
                        where: { email: nextAuthUser.email },
                    });
                    if (dbUser) {
                        token.uid = dbUser.id;
                    }
                } catch (e) {
                    console.error("JWT Callback Error (Database likely unreachable):", e);
                }
            }
            return token;
        },
        async session({ session, token }: { session: any; token: any }) {
            try {
                if (session.user) {
                    session.user.id = token.uid || token.sub;
                }
                session.accessToken = token.accessToken;
                session.provider = token.provider;
            } catch (e) {
                console.error("Session Callback Error:", e);
            }
            return session;
        },
    },
};
