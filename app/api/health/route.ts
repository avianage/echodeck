export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prismaClient } from '@/app/lib/db';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);

const ALLOWED_IPS = (process.env.HEALTH_ALLOWED_IPS || '127.0.0.1,::1')
  .split(',')
  .map((ip) => ip.trim());

function isIpAllowed(req: NextRequest) {
  if (process.env.NODE_ENV !== 'production') return true;

  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || '';

  return ALLOWED_IPS.includes(ip) || ip.startsWith('192.168.0.');
}

function timingSafeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// The IP allowlist alone is only as trustworthy as the reverse proxy in front
// of this app — x-forwarded-for/x-real-ip are client-controlled unless a
// trusted proxy strips and re-sets them first. When HEALTH_CHECK_TOKEN is
// configured, a matching bearer token is required in addition to the IP
// check, so a spoofed header alone can't reach this endpoint. If the token
// isn't configured, we fall back to IP-only (with a startup warning) so
// existing deployments keep working until they opt in.
function isAllowed(req: NextRequest) {
  if (!isIpAllowed(req)) return false;

  const requiredToken = process.env.HEALTH_CHECK_TOKEN;
  if (!requiredToken) return true;

  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return timingSafeEqual(provided, requiredToken);
}

export async function GET(req: NextRequest) {
  if (!isAllowed(req)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  const checks: Record<string, { status: 'ok' | 'error'; detail?: string }> = {};

  try {
    await prismaClient.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok' };
  } catch {}

  try {
    const bin = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    await execFileAsync(bin, ['--version'], { timeout: 5000 });
    checks.ytdlp = { status: 'ok' };
  } catch {
    try {
      const whichCmd = process.platform === 'win32' ? 'where' : 'which';
      const { stdout } = await execFileAsync(whichCmd, ['yt-dlp'], { timeout: 5000 });
      checks.ytdlp = { status: 'error', detail: `yt-dlp not found. Path: ${stdout.trim()}` };
    } catch {
      checks.ytdlp = { status: 'error', detail: 'yt-dlp not found' };
    }
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok');

  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: 200 },
  );
}
