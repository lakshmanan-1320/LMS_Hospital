import { registerAs } from '@nestjs/config';

/**
 * Converts a duration string ("90s", "15m", "3h", "7d") or plain milliseconds into ms.
 * Keeps JWT expiry and cookie maxAge driven by the same env value.
 */
const durationToMs = (value: string, fallbackMs: number): number => {
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec((value || '').trim());
  if (!match) return fallbackMs;

  const amount = parseInt(match[1], 10);
  const unitMs: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * unitMs[match[2] || 'ms'];
};

const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '3h';
const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export const authConfig = registerAs('auth', () => ({
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'default_jwt_access_secret_key_32chars!',
  jwtAccessExpiresIn: accessExpiresIn,
  accessTokenTtlMs: durationToMs(accessExpiresIn, 3 * 60 * 60 * 1000), // default 3 hours
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret_key_32chars!',
  jwtRefreshExpiresIn: refreshExpiresIn,
  refreshTokenTtlMs: durationToMs(refreshExpiresIn, 7 * 24 * 60 * 60 * 1000), // default 7 days
  passwordResetTtlMs: 60 * 60 * 1000, // 1 hour in ms
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieSameSite: (process.env.COOKIE_SAME_SITE || 'lax') as 'lax' | 'strict' | 'none',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
}));
