import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createTripInvitationToken, hashTripInvitationToken } from './tripInvitationToken';

describe('trip invitation token boundary', () => {
  it('creates 32 random bytes and hashes the exact URL token', () => {
    const { rawToken, tokenHash } = createTripInvitationToken();
    expect(Buffer.from(rawToken, 'base64url')).toHaveLength(32);
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toBe(createHash('sha256').update(rawToken).digest('hex'));
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).not.toContain(rawToken);
  });

  it('rotations produce independently generated tokens and digests', () => {
    const first = createTripInvitationToken();
    const second = createTripInvitationToken();
    expect(second.rawToken).not.toBe(first.rawToken);
    expect(second.tokenHash).not.toBe(first.tokenHash);
    expect(hashTripInvitationToken(first.rawToken)).toBe(first.tokenHash);
  });

  it.each(['', 'short', 'a'.repeat(64), 'a'.repeat(42) + '+', 'a'.repeat(42) + '/', 'a'.repeat(43), ' '.repeat(43)])(
    'rejects malformed or noncanonical input without echoing it: %j', (value) => {
      expect(() => hashTripInvitationToken(value)).toThrow('Invalid invitation token');
    },
  );
});
