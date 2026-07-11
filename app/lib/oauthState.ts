import crypto from 'crypto';

const STATE_TTL_MS = 10 * 60 * 1000;

function sign(payload: string): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is not configured');
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Signs a userId + timestamp into an opaque OAuth `state` value so a callback
 * can verify the state actually originated from our own redirect (and hasn't
 * expired or been replayed) before trusting the userId embedded in it.
 */
export function createOAuthState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifyOAuthState(state: string): { userId: string } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const [userId, tsStr, sig] = decoded.split('.');
    if (!userId || !tsStr || !sig) return null;

    const expected = sign(`${userId}.${tsStr}`);
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const ts = parseInt(tsStr, 10);
    if (!Number.isFinite(ts) || Date.now() - ts > STATE_TTL_MS) return null;

    return { userId };
  } catch {
    return null;
  }
}
