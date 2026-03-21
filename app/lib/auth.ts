import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import SpotifyProvider from "next-auth/providers/spotify";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prismaClient } from "@/app/lib/db";
import { Resend } from "resend";

// resend is now instantiated inside the handler to avoid build-time env var requirement

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prismaClient),
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    providers: [
        EmailProvider({
            from: "EchoDeck <noreply@avianage.in>",
            sendVerificationRequest: async ({ identifier: email, url }) => {
                const resend = new Resend(process.env.RESEND_API_KEY);
                await resend.emails.send({
                    from: "EchoDeck <noreply@avianage.in>",
                    to: email,
                    subject: "Sign in to EchoDeck",
                    html: `
                        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #111111; color: #ffffff; border-radius: 16px;">
                            <h1 style="font-size: 28px; font-weight: 800; color: #4a90e2; margin: 0 0 8px 0;">EchoDeck</h1>
                            <p style="color: #888; font-size: 13px; margin: 0 0 32px 0;">Collaborative Music Streaming</p>
                            <p style="color: #cccccc; font-size: 15px; line-height: 1.6;">
                                Click the button below to sign in to your account. This link expires in <strong style="color: #fff;">15 minutes</strong> and can only be used once.
                            </p>
                            <a href="${url}"
                               style="display: inline-block; margin-top: 28px; padding: 14px 32px; background: #4a90e2; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px;">
                                Sign in to EchoDeck
                            </a>
                            <p style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #222; color: #555; font-size: 12px; line-height: 1.6;">
                                If you didn't request this email, you can safely ignore it. Someone may have entered your email by mistake.
                            </p>
                        </div>
                    `
                });
            }
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
            allowDangerousEmailAccountLinking: true,
        }),
        SpotifyProvider({
            clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
            authorization:
                "https://accounts.spotify.com/authorize?scope=user-read-email%20playlist-read-private%20playlist-read-collaborative%20user-read-private%20user-library-read",
            allowDangerousEmailAccountLinking: true,
        }),
    ],
    callbacks: {
        async jwt({ token, user, account, trigger, session }) {
            if (account) {
                token.accessToken = account.access_token;
                token.provider = account.provider;
            }

            if (trigger === "update" && session) {
                if (session.username) token.username = session.username;
                if (session.displayName) token.name = session.displayName;
                if (session.image) token.picture = session.image;
            }

            if (user) {
                const dbUser = await prismaClient.user.findUnique({
                    where: { id: user.id },
                    select: {
                        id: true,
                        username: true,
                        platformRole: true,
                        isBanned: true,
                        bannedUntil: true,
                        displayName: true,
                        image: true
                    }
                });

                if (dbUser) {
                    token.id = dbUser.id;
                    token.username = dbUser.username;
                    token.platformRole = dbUser.platformRole;
                    token.isBanned = dbUser.isBanned;
                    token.bannedUntil = dbUser.bannedUntil;
                    token.name = dbUser.displayName || user.name;
                    token.picture = dbUser.image || user.image;
                } else {
                    token.id = user.id;
                    token.username = (user as any).username;
                    token.platformRole = (user as any).platformRole;
                }
            }
            return token;
        },
        async session({ session, token }) {
            // Keep existing provider accessToken mapping
            (session as any).accessToken = token.accessToken;
            (session as any).provider = token.provider;

            if (session.user) {
                const userId = token.id as string;
                // Important: Fetch fresh ban status from DB on every session check
                // This ensures real-time enforcement for active JWT sessions
                const dbUser = await prismaClient.user.findUnique({
                    where: { id: userId },
                    select: { isBanned: true, bannedUntil: true }
                });

                (session.user as any).id = userId;
                (session.user as any).username = token.username;
                (session.user as any).platformRole = token.platformRole;
                (session.user as any).isBanned = dbUser?.isBanned ?? token.isBanned;
                (session.user as any).bannedUntil = dbUser?.bannedUntil ?? token.bannedUntil;
                (session.user as any).image = token.picture;
            }
            return session;
        },
        async signIn({ user, account }) {
            if (!user.email) return false;

            const existingUser = await prismaClient.user.findUnique({
                where: { email: user.email }
            });

            // Check platform ban
            if (existingUser?.isBanned) {
                const isPermanent = !existingUser.bannedUntil;
                const isActive = existingUser.bannedUntil
                    ? new Date(existingUser.bannedUntil) > new Date()
                    : false;
                if (isPermanent || isActive) {
                    return `/auth/banned?reason=${encodeURIComponent(existingUser.banReason || "Account suspended")}`;
                }
            }

            // Check for account collision —
            // email exists but this OAuth provider is not yet linked to it
            if (existingUser && account && account.provider !== "email") {
                const linkedAccount = await prismaClient.account.findFirst({
                    where: { userId: existingUser.id, provider: account.provider }
                });

                if (!linkedAccount) {
                    const normalizedEmail = user.email.toLowerCase();

                    // Check if this linking has been verified via email
                    const pendingLink = await prismaClient.verificationToken.findFirst({
                        where: { identifier: `pending-link:${account.provider}:${normalizedEmail}` }
                    });

                    console.log(`🔍 [Auth] Checking pending link for ${account.provider}:${normalizedEmail} - Found: ${!!pendingLink}`);

                    if (pendingLink) {
                        console.log(`✅ [Auth] Linking verified for ${normalizedEmail}. Allowing NextAuth to link.`);

                        await prismaClient.verificationToken.deleteMany({
                            where: { identifier: `pending-link:${account.provider}:${normalizedEmail}` }
                        });
                        return true;
                    }

                    console.log(`⚠️ [Auth] No linked account or pending verification for ${normalizedEmail}. Redirecting to link page.`);
                    return `/auth/link-account?email=${encodeURIComponent(normalizedEmail)}&provider=${account.provider}`;
                }
            }

            return true;
        },
        async redirect({ url, baseUrl }) {
            // Priority 1: Use NEXTAUTH_URL from environment if set
            // Priority 2: Use baseUrl (this might be internal in Docker)
            // Priority 3: Hardcoded fallback as a last resort for this specific domain
            const publicBase = process.env.NEXTAUTH_URL || (baseUrl.includes('96bd5d0481cd') || baseUrl.includes('localhost') ? 'https://echodeck.avianage.in' : baseUrl);

            // Strip internal Docker container URLs from callbackUrl param
            const sanitizeUrl = (u: string) => {
                try {
                    const parsed = new URL(u.startsWith('http') ? u : `${publicBase}${u}`);
                    
                    // Comprehensive internal hostname check:
                    // 1. Matches common Docker hex hash patterns (e.g., 8dac1497132e)
                    // 2. Contains localhost
                    // 3. Port is 3002 (internal app port)
                    // 4. Hostname has no dots (internal Docker network host)
                    const isInternal =
                        parsed.port === '3002' ||
                        parsed.hostname === 'localhost' ||
                        !parsed.hostname.includes('.') ||
                        /^[a-f0-9]{8,}$/.test(parsed.hostname); 
                    
                    if (isInternal) {
                        const sanitized = publicBase + (parsed.pathname !== '/' ? parsed.pathname : '');
                        console.log(`🔧 [Auth] Sanitized internal URL: ${u} -> ${sanitized}`);
                        return sanitized;
                    }
                } catch (e) {
                    // relative URL — safe
                }
                return u;
            };

            // Handle callbackUrl param inside the url
            if (url.includes('callbackUrl=')) {
                const urlObj = new URL(url.startsWith('http') ? url : `${publicBase}${url}`);
                const callbackUrl = urlObj.searchParams.get('callbackUrl');
                if (callbackUrl) {
                    const sanitized = sanitizeUrl(decodeURIComponent(callbackUrl));
                    urlObj.searchParams.set('callbackUrl', sanitized);
                    // Also fix the base of the URL itself if it's internal
                    const fixedBase = new URL(urlObj.pathname + urlObj.search, publicBase);
                    const finalUrl = fixedBase.toString();
                    console.log(`🎯 [Auth] Redirect check (with callbackUrl): ${url} -> ${finalUrl}`);
                    return finalUrl;
                }
            }

            if (url.startsWith('/')) return `${publicBase}${url}`;
            if (url.startsWith(publicBase)) return url;

            // Sanitize the url itself if it's an internal address
            const finalUrl = sanitizeUrl(url);
            if (finalUrl !== url) {
                console.log(`🎯 [Auth] Redirect sanitized: ${url} -> ${finalUrl}`);
            }
            return finalUrl;
        }
    },
    pages: {
        signIn: "/auth/signin",
        error: "/auth/error",
        verifyRequest: "/auth/verify",  // "check your email" page
        newUser: "/auth/setup",         // forced username setup for new accounts
    },
};
