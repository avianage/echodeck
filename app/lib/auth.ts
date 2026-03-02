import { prismaClient } from "@/app/lib/db";
import GoogleProvider from "next-auth/providers/google";
import { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async signIn({ user }) {
            if (!user.email) return false;
            try {
                const existingUser = await prismaClient.user.findUnique({
                    where: { email: user.email },
                });

                if (!existingUser) {
                    await prismaClient.user.create({
                        data: {
                            email: user.email,
                            provider: "Google",
                        },
                    });
                }
            } catch (e) {
                console.error("Signin Error: ", e);
                return false;
            }
            return true;
        },
        async jwt({ token, user: nextAuthUser }) {
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
        async session({ session, token }: { session: any; token: any }) { // eslint-disable-line @typescript-eslint/no-explicit-any
            try {
                if (session.user && token.uid) {
                    session.user.id = token.uid;
                }
            } catch (e) {
                console.error("Session Callback Error:", e);
            }
            return session;
        },
    },
};
