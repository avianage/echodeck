import { NextAuthOptions, Session, User, Account } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import SpotifyProvider from 'next-auth/providers/spotify';
import EmailProvider from 'next-auth/providers/email';
import type { JWT } from 'next-auth/jwt';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prismaClient } from '@/app/lib/db';
import { Resend } from 'resend';
import { logger } from '@/lib/logger';

// resend is now instantiated inside the handler to avoid build-time env var requirement

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prismaClient),
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: parseInt(process.env.SESSION_MAX_AGE_DAYS || '30', 10) * 24 * 60 * 60,
  },
  providers: [
    EmailProvider({
      from: 'EchoDeck <noreply@avianage.in>',
      sendVerificationRequest: async ({ identifier: email, url }) => {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: 'EchoDeck <noreply@avianage.in>',
          to: email,
          subject: 'Sign in to EchoDeck',
          html: `
                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                            <tr>
                                <td align="center" style="padding: 40px 20px;">
                                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #111111; border: 1px solid #222222; border-radius: 20px; overflow: hidden;">
                                        <tr>
                                            <td style="padding: 40px;">
                                                <!-- Header -->
                                                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                                    <tr>
                                                        <td>
                                                            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #4a90e2; letter-spacing: -0.5px;">EchoDeck</h1>
                                                        </td>
                                                        <td align="right">
                                                            <span style="background-color: #222222; color: #888888; font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 4px 8px; border-radius: 6px; tracking: 0.1em;">Magic Link</span>
                                                        </td>
                                                    </tr>
                                                </table>

                                                <!-- Content -->
                                                <h2 style="margin: 32px 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Welcome back! 🎸</h2>
                                                <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #aaaaaa;">
                                                    Ready to jump back into the mix? No password needed — just click the button below to sign in instantly.
                                                </p>

                                                <!-- CTA Button -->
                                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 32px;">
                                                    <tr>
                                                        <td align="center">
                                                            <a href="${url}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #4a90e2 0%, #2563eb 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);">
                                                                Sign in to EchoDeck →
                                                            </a>
                                                        </td>
                                                    </tr>
                                                </table>

                                                <!-- Info Box -->
                                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 32px; background-color: #1a1a1a; border-radius: 12px;">
                                                    <tr>
                                                        <td style="padding: 16px;">
                                                            <p style="margin: 0; font-size: 12px; color: #777777; line-height: 1.5;">
                                                                <strong style="color: #999999;">Security Note:</strong> This link expires in 15 minutes and is single-use. If you didn't request this, you can safely ignore this email.
                                                            </p>
                                                        </td>
                                                    </tr>
                                                </table>

                                                <!-- Footer -->
                                                <p style="margin: 32px 0 0 0; font-size: 11px; color: #444444; text-align: center; border-top: 1px solid #222222; padding-top: 24px;">
                                                    &copy; ${new Date().getFullYear()} EchoDeck. Collaborative Music Streaming.
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    `,
        });
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      allowDangerousEmailAccountLinking: true,
    }),
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID ?? '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? '',
      authorization:
        'https://accounts.spotify.com/authorize?scope=user-read-email%20playlist-read-private%20playlist-read-collaborative%20user-read-private%20user-library-read',
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async jwt({
      token,
      user,
      account,
      trigger,
      session,
    }: {
      token: JWT;
      user?: User;
      account?: Account | null;
      trigger?: 'signIn' | 'signUp' | 'update';
      session?: Session | null;
    }) {
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;

        // If Spotify is being linked or used for sign-in, update User model fields
        if (account.provider === 'spotify') {
          await prismaClient.user.update({
            where: { id: (token.id as string) || user?.id },
            data: {
              spotifyConnected: true,
              spotifyAccessToken: account.access_token,
              spotifyRefreshToken: account.refresh_token,
              spotifyTokenExpiresAt: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
            },
          });
        }
      }

      if (trigger === 'update' && session) {
        const updateSession = session as Session & {
          username?: string;
          displayName?: string;
          platformRole?: string;
          image?: string;
        };
        if (updateSession.username) token.username = updateSession.username;
        if (updateSession.displayName) token.name = updateSession.displayName;
        if (updateSession.platformRole)
          token.platformRole = updateSession.platformRole as
            | 'MEMBER'
            | 'CREATOR'
            | 'OWNER'
            | undefined;
        if (updateSession.image) token.picture = updateSession.image;
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
            image: true,
          },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.username = dbUser.username ?? undefined;
          token.platformRole = dbUser.platformRole;
          token.isBanned = dbUser.isBanned;
          token.bannedUntil = dbUser.bannedUntil;
          token.name = dbUser.displayName || user.name;
          token.picture = dbUser.image || user.image;
        } else {
          token.id = user.id;
          const u = user as User & { username?: string; platformRole?: string };
          token.username = u.username;
          token.platformRole = u.platformRole as 'MEMBER' | 'CREATOR' | 'OWNER' | undefined;
        }
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      // Keep existing provider accessToken mapping
      (session as { accessToken?: string }).accessToken = token.accessToken as string | undefined;
      (session as { provider?: string }).provider = token.provider as string | undefined;

      if (session.user) {
        const userId = token.id as string;
        // Important: Fetch fresh ban status from DB on every session check
        // This ensures real-time enforcement for active JWT sessions
        const dbUser = await prismaClient.user.findUnique({
          where: { id: userId },
          select: { isBanned: true, bannedUntil: true },
        });

        (session.user as { id?: string }).id = userId;
        (session.user as { username?: string }).username = token.username as string | undefined;
        (session.user as { platformRole?: string }).platformRole = token.platformRole as
          | string
          | undefined;
        (session.user as { isBanned?: boolean }).isBanned =
          dbUser?.isBanned ?? (token.isBanned as boolean | undefined);
        (session.user as { bannedUntil?: Date }).bannedUntil =
          dbUser?.bannedUntil ?? (token.bannedUntil as Date | undefined);
        (session.user as { image?: string }).image = token.picture as string | undefined;
      }
      return session;
    },
    async signIn({ user, account }: { user: User; account?: Account | null }) {
      if (!user.email) return false;

      const existingUser = await prismaClient.user.findUnique({
        where: { email: user.email },
      });

      // Check platform ban
      if (existingUser?.isBanned) {
        const isPermanent = !existingUser.bannedUntil;
        const isActive = existingUser.bannedUntil
          ? new Date(existingUser.bannedUntil) > new Date()
          : false;
        if (isPermanent || isActive) {
          return `/auth/banned?reason=${encodeURIComponent(existingUser.banReason || 'Account suspended')}`;
        }
      }

      // Check for account collision —
      // email exists but this OAuth provider is not yet linked to it
      if (existingUser && account && account.provider !== 'email') {
        const linkedAccount = await prismaClient.account.findFirst({
          where: { userId: existingUser.id, provider: account.provider },
        });

        if (!linkedAccount) {
          const normalizedEmail = user.email.toLowerCase();

          // Check if this linking has been verified via email
          const pendingLink = await prismaClient.verificationToken.findFirst({
            where: { identifier: `pending-link:${account.provider}:${normalizedEmail}` },
          });

           
          logger.info('Auth: Account linking check completed');

          if (pendingLink) {
             
            logger.info('Auth: Account linking check completed');

            await prismaClient.verificationToken.deleteMany({
              where: { identifier: `pending-link:${account.provider}:${normalizedEmail}` },
            });
            return true;
          }

           
          logger.info('Auth: Account linking check completed');
          return `/auth/link-account?email=${encodeURIComponent(normalizedEmail)}&provider=${account.provider}`;
        }
      }

      return true;
    },
    async redirect({ url, baseUrl }) {
      const isInternalHost = (host: string) =>
        host === 'localhost' ||
        host === '127.0.0.1' ||
        !host.includes('.') ||
        /^[a-f0-9]{8,}$/.test(host.split(':')[0]) || // handle cases with ports in host
        host.includes(':3002');

      const nextAuthUrl = process.env.NEXTAUTH_URL;
      let nextAuthOrigin = '';
      try {
        if (nextAuthUrl) nextAuthOrigin = new URL(nextAuthUrl).origin;
      } catch {}

      // Priority 1: Use NEXTAUTH_URL origin if set
      // Priority 2: If baseUrl is internal, fallback to fixed production domain
      // Priority 3: use baseUrl
      let publicBase = nextAuthOrigin;
      if (!publicBase) {
        try {
          const parsedBase = new URL(baseUrl);
          publicBase = isInternalHost(parsedBase.host) ? 'https://echodeck.avianage.in' : baseUrl;
        } catch {
          publicBase = 'https://echodeck.avianage.in';
        }
      }

      // Strip internal Docker container URLs from callbackUrl param
      const sanitizeUrl = (u: string) => {
        try {
          const parsed = new URL(u.startsWith('http') ? u : `${publicBase}${u}`);
          if (isInternalHost(parsed.host)) {
            const sanitized = publicBase + (parsed.pathname !== '/' ? parsed.pathname : '');
             
            logger.info({ url: u, sanitized }, '[Auth] Sanitized internal URL');
            return sanitized;
          }
        } catch {}
        return u;
      };

      // Handle callbackUrl param inside the url
      if (url.includes('callbackUrl=')) {
        try {
          const urlObj = new URL(url.startsWith('http') ? url : `${publicBase}${url}`);
          const callbackUrlParam = urlObj.searchParams.get('callbackUrl');
          if (callbackUrlParam) {
            const sanitized = sanitizeUrl(decodeURIComponent(callbackUrlParam));
            urlObj.searchParams.set('callbackUrl', sanitized);
            const fixedBase = new URL(urlObj.pathname + urlObj.search, publicBase);
            const finalUrl = fixedBase.toString();
             
            logger.info({ url, finalUrl }, '[Auth] Redirect check (with callbackUrl)');
            return finalUrl;
          }
        } catch {}
      }

      if (url.startsWith('/')) return `${publicBase}${url}`;
      if (url.startsWith(publicBase)) return url;

      const finalUrl = sanitizeUrl(url);
      if (finalUrl !== url) {
         
        logger.info({ url, finalUrl }, '[Auth] Redirect sanitized');
      }
      return finalUrl;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/verify', // "check your email" page
    newUser: '/auth/setup', // forced username setup for new accounts
  },
};
