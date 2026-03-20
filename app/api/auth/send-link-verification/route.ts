export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prismaClient } from "@/app/lib/db";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
    const { email, provider } = await req.json();
    const normalizedEmail = email.toLowerCase();
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prismaClient.verificationToken.create({
        data: { identifier: `link:${provider}:${normalizedEmail}`, token, expires }
    });

    const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/link-provider?token=${token}&email=${encodeURIComponent(normalizedEmail)}&provider=${provider}`;

    await resend.emails.send({
        from: "EchoDeck <noreply@avianage.in>",
        to: normalizedEmail,
        subject: "Confirm account linking — EchoDeck",
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #111111; color: #ffffff; border-radius: 16px;">
                <h1 style="font-size: 28px; font-weight: 800; color: #4a90e2; margin: 0 0 8px 0;">EchoDeck</h1>
                <p style="color: #cccccc; font-size: 15px; line-height: 1.6; margin-top: 24px;">
                    Click below to connect <strong style="color: #fff;">${provider}</strong> to your existing EchoDeck account.
                    This link expires in <strong style="color: #fff;">15 minutes</strong>.
                </p>
                <a href="${verifyUrl}"
                   style="display: inline-block; margin-top: 28px; padding: 14px 32px; background: #4a90e2; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px;">
                    Connect ${provider.charAt(0).toUpperCase() + provider.slice(1)}
                </a>
                <p style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #222; color: #555; font-size: 12px;">
                    If you didn't request this, ignore this email. Your account will not be changed.
                </p>
            </div>
        `
    });

    return NextResponse.json({ message: "Verification email sent" });
}

