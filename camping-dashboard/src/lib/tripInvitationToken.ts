import 'server-only';
import { createHash, randomBytes } from 'node:crypto';

/** Canonical 32-byte base64url token. Only its digest crosses the DB boundary. */
export function hashTripInvitationToken(rawToken: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)
    || Buffer.from(rawToken, 'base64url').toString('base64url') !== rawToken) {
    throw new Error('Invalid invitation token');
  }
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/** Transient trusted-server payload; never log or persist rawToken. */
export function createTripInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString('base64url');
  return { rawToken, tokenHash: hashTripInvitationToken(rawToken) };
}
