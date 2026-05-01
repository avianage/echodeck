export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prismaClient } from '@/app/lib/db';
import crypto from 'crypto';

import { isRateLimited } from '@/app/lib/rateLimit';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const email = req.nextUrl.searchParams.get('email');
  const provider = req.nextUrl.searchParams.get('provider');

  if (!token || !email || !provider) {
    return NextResponse.redirect(
      new URL(
        '/auth/error?error=MissingParams',
        process.env.NEXTAUTH_URL || 'https://echodeck.avianage.in',
      ),
    );
  }

  const rateKey = `link-provider:${email.toLowerCase()}`;
  if (isRateLimited(rateKey, 10, 60 * 60 * 1000)) {
    return NextResponse.redirect(
      new URL(
        '/auth/error?error=TooManyRequests',
        process.env.NEXTAUTH_URL || 'https://echodeck.avianage.in',
      ),
    );
  }

  const normalizedEmail = email.toLowerCase();

  const record = await prismaClient.verificationToken.findUnique({
    where: { token },
  });

  if (!record || record.identifier !== `link:${provider}:${normalizedEmail}`) {
    return NextResponse.redirect(
      new URL(
        '/auth/error?error=InvalidToken',
        process.env.NEXTAUTH_URL || 'https://echodeck.avianage.in',
      ),
    );
  }

  if (new Date(record.expires) < new Date()) {
    return NextResponse.redirect(
      new URL(
        '/auth/error?error=TokenExpired',
        process.env.NEXTAUTH_URL || 'https://echodeck.avianage.in',
      ),
    );
  }

  // Delete used token
  await prismaClient.verificationToken.delete({ where: { token } });

  // Mark provider as pending link — user will complete this on next OAuth sign in
  await prismaClient.verificationToken.create({
    data: {
      identifier: `pending-link:${provider}:${normalizedEmail}`,
      token: crypto.randomUUID(),
      expires: new Date(Date.now() + 10 * 60 * 1000), // 10 min to complete OAuth
    },
  });

  // Redirect them directly to trigger the Google/Provider connection
  // This will start the OAuth flow, and the signIn callback will find the pending-link token
  // Redirect them to a bridge page that correctly initiates the OAuth flow with POST/CSRF
  // This resolves the error on the sign-in page.
  return NextResponse.redirect(
    new URL(
      `/auth/confirm-link?provider=${provider}&email=${encodeURIComponent(normalizedEmail)}`,
      process.env.NEXTAUTH_URL || 'https://echodeck.avianage.in',
    ),
  );
}
