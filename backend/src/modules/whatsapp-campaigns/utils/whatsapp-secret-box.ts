import * as crypto from 'crypto';

function getKey(): Buffer {
  const raw = (
    process.env.SETTINGS_ENCRYPTION_KEY ||
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'elevate-lms-secure-default-key-32'
  ).trim();
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  const b64 = Buffer.from(raw, 'base64');
  if (b64.length === 32 && /^[A-Za-z0-9+/=]+$/.test(raw)) return b64;
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(payload: string): string | null {
  if (!payload || typeof payload !== 'string') return null;
  const [version, iv, tag, data] = payload.split(':');
  if (version !== 'v1' || !iv || !tag || !data) return null;
  try {
    const key = getKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

