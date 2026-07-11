import crypto from 'crypto';
import { logger } from '@/lib/logger';

const ALGORITHM = 'aes-256-gcm';
const ENC_PREFIX = 'enc:v1:';

let warnedMissingKey = false;

function getKey(): Buffer | null {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      const message = 'TOKEN_ENCRYPTION_KEY is not set — Spotify tokens will be stored in plaintext.';
      if (process.env.NODE_ENV === 'production') {
        logger.error(message);
      } else {
        logger.warn(message);
      }
    }
    return null;
  }
  // Accept a 32-byte hex/base64 key, or derive a 32-byte key from an arbitrary secret.
  if (/^[0-9a-fA-F]{64}$/.test(secret)) return Buffer.from(secret, 'hex');
  try {
    const b64 = Buffer.from(secret, 'base64');
    if (b64.length === 32) return b64;
  } catch {}
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a token for storage. Falls back to storing the plaintext value
 * (unprefixed) if TOKEN_ENCRYPTION_KEY isn't configured, so local/dev setups
 * without the env var still function.
 */
export function encryptToken(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return value;
  const key = getKey();
  if (!key) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return ENC_PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/**
 * Decrypts a token read from storage. Values without the enc:v1: prefix are
 * treated as legacy plaintext and returned as-is, so pre-existing rows keep
 * working until they're next rewritten.
 */
export function decryptToken(value: string | null | undefined): string | null | undefined {
  if (value === null || value === undefined) return value;
  if (!value.startsWith(ENC_PREFIX)) return value;

  const key = getKey();
  if (!key) return value;

  try {
    const raw = Buffer.from(value.slice(ENC_PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
