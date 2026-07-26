import { describe, expect, it } from 'vitest';
import {
  buildOAuthCallbackUrl,
  getAuthErrorMessage,
  getRequestedAuthDestination,
  getSafeNextPath,
} from './authRedirect';

describe('OAuth redirect safety', () => {
  it('preserves a protected app-relative destination in the callback URL', () => {
    const callbackUrl = new URL(
      buildOAuthCallbackUrl({
        origin: 'https://dashboard.example',
        pathname: '/trips',
        search: '?next=%2Ftrips%2Ftrip-123%3Ftab%3Dtimeline',
      })
    );

    expect(callbackUrl.origin).toBe('https://dashboard.example');
    expect(callbackUrl.pathname).toBe('/auth/callback');
    expect(callbackUrl.searchParams.get('next')).toBe('/trips/trip-123?tab=timeline');
  });

  it.each([
    'https://malicious.example/trips',
    '//malicious.example/trips',
    '/%2Fmalicious.example/trips',
    '/%5Cmalicious.example/trips',
    '/\\malicious.example/trips',
  ])('rejects an unsafe destination: %s', (destination) => {
    expect(getSafeNextPath(destination)).toBeNull();
  });

  it('falls back to the public trip list when no safe destination exists', () => {
    const params = new URLSearchParams('next=https://malicious.example');
    expect(getRequestedAuthDestination(params)).toBe('/trips');
  });

  it('does not carry a previous callback error into a new sign-in attempt', () => {
    const callbackUrl = new URL(
      buildOAuthCallbackUrl({
        origin: 'https://dashboard.example',
        pathname: '/trips',
        search: '?auth_error=exchange_failed',
      })
    );

    expect(callbackUrl.searchParams.get('next')).toBe('/trips');
  });

  it('only exposes known, user-safe callback error messages', () => {
    expect(getAuthErrorMessage('exchange_failed')).toContain('could not be completed');
    expect(getAuthErrorMessage('private-provider-detail')).toBeNull();
  });
});
