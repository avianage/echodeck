export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prismaClient } from '@/app/lib/db';
import { Resend } from 'resend';
import crypto from 'crypto';
import { z } from 'zod';
import { isRateLimited } from '@/app/lib/rateLimit';

const SendLinkSchema = z.object({
  email: z.string().email('Invalid email format'),
  provider: z.enum(['email', 'spotify']),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, provider } = SendLinkSchema.parse(body);

  const rateKey = `send-link:${email.toLowerCase()}`;
  if (isRateLimited(rateKey, 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again later.' },
      { status: 429 },
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const normalizedEmail = email.toLowerCase();
  const token = crypto.randomBytes(32).toString('hex');
  const expiryMinutes = parseInt(process.env.MAGIC_LINK_EXPIRY_MINUTES || '15', 10);
  const expires = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await prismaClient.verificationToken.create({
    data: { identifier: `link:${provider}:${normalizedEmail}`, token, expires },
  });

  const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/link-provider?token=${token}&email=${encodeURIComponent(normalizedEmail)}&provider=${provider}`;

  await resend.emails.send({
    from: 'EchoDeck <noreply@avianage.in>',
    to: normalizedEmail,
    subject: 'Confirm account linking — EchoDeck',
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
                                                <span style="background-color: #222222; color: #888888; font-size: 10px; font-weight: 900; text-transform: uppercase; padding: 4px 8px; border-radius: 6px; tracking: 0.1em;">Verification</span>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Content -->
                                    <h2 style="margin: 32px 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff;">Complete your connection 🔒</h2>
                                    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #aaaaaa;">
                                        You're about to link your <strong style="color: #fff;">${provider}</strong> account to EchoDeck. Your existing data, queue, and friends will be preserved.
                                    </p>

                                    <!-- CTA Button -->
                                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 32px;">
                                        <tr>
                                            <td align="center">
                                                <a href="${verifyUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #4a90e2 0%, #2563eb 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);">
                                                    Connect ${provider.charAt(0).toUpperCase() + provider.slice(1)} →
                                                </a>
                                            </td>
                                        </tr>
                                    </table>

                                    <!-- Info Box -->
                                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 32px; background-color: #1a1a1a; border-radius: 12px;">
                                        <tr>
                                            <td style="padding: 16px;">
                                                <p style="margin: 0; font-size: 12px; color: #777777; line-height: 1.5;">
                                                    <strong style="color: #999999;">Security Note:</strong> This link expires in 15 minutes. If you didn't request this linking, please ignore this email.
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

  return NextResponse.json({ message: 'Verification email sent' });
}
