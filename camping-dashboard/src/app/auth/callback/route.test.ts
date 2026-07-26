import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(
    (
      _url: string,
      _key: string,
      options: {
        cookies: {
          setAll: (
            cookies: Array<{
              name: string;
              value: string;
              options?: { httpOnly?: boolean; path?: string; sameSite?: 'lax' };
            }>
          ) => void;
        };
      }
    ) => ({
      auth: {
        exchangeCodeForSession: async (code: string) => {
          const result = await authMocks.exchangeCodeForSession(code);
          if (!result.error) {
            options.cookies.setAll([
              {
                name: 'sb-session',
                value: 'test-session-value',
                options: { httpOnly: true, path: '/', sameSite: 'lax' },
              },
            ]);
          }
          return result;
        },
      },
    })
  ),
}));

import { GET } from './route';

describe('OAuth callback', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
    authMocks.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
  });

  it('exchanges the PKCE code, sets the session cookie on the redirect, and restores next', async () => {
    const request = new NextRequest(
      'https://dashboard.example/auth/callback?code=one-time-code&next=%2Ftrips%2Ftrip-123'
    );

    const response = await GET(request);

    expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith('one-time-code');
    expect(response.headers.get('location')).toBe(
      'https://dashboard.example/trips/trip-123'
    );
    expect(response.headers.get('set-cookie')).toContain('sb-session=');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('does not exchange a code when the provider reports cancellation', async () => {
    const request = new NextRequest(
      'https://dashboard.example/auth/callback?error=access_denied&next=%2Ftrips'
    );

    const response = await GET(request);

    expect(authMocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(
      'https://dashboard.example/trips?auth_error=cancelled'
    );
  });

  it('rejects external next destinations', async () => {
    const request = new NextRequest(
      'https://dashboard.example/auth/callback?code=one-time-code&next=https%3A%2F%2Fmalicious.example'
    );

    const response = await GET(request);

    expect(authMocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(
      'https://dashboard.example/trips?auth_error=invalid_redirect'
    );
  });

  it('handles a missing authorization code without starting an exchange', async () => {
    const request = new NextRequest(
      'https://dashboard.example/auth/callback?next=%2Ftrips%2Ftrip-123'
    );

    const response = await GET(request);

    expect(authMocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(
      'https://dashboard.example/trips?auth_error=missing_code'
        + '&next=%2Ftrips%2Ftrip-123'
    );
  });

  it('returns a safe error without leaking the exchange failure', async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue({
      data: null,
      error: new Error('sensitive provider detail'),
    });
    const request = new NextRequest(
      'https://dashboard.example/auth/callback?code=bad-code&next=%2Ftrips%2Ftrip-123'
    );

    const response = await GET(request);

    expect(response.headers.get('location')).toBe(
      'https://dashboard.example/trips?auth_error=exchange_failed'
        + '&next=%2Ftrips%2Ftrip-123'
    );
    expect(response.headers.get('location')).not.toContain('sensitive');
  });
});
