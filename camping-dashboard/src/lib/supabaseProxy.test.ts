import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const proxyMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  refreshCookies: false,
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
        getUser: async () => {
          if (proxyMocks.refreshCookies) {
            options.cookies.setAll([
              {
                name: 'sb-refreshed-session',
                value: 'refreshed-test-value',
                options: { httpOnly: true, path: '/', sameSite: 'lax' },
              },
            ]);
          }
          return proxyMocks.getUser();
        },
      },
    })
  ),
}));

import { updateSupabaseSession } from './supabaseProxy';

describe('Supabase session proxy', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-test-key');
    proxyMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    proxyMocks.refreshCookies = false;
  });

  it('redirects an anonymous protected request to sign-in with a safe next path', async () => {
    const request = new NextRequest(
      'https://dashboard.example/trips/trip-123?tab=timeline'
    );

    const response = await updateSupabaseSession(request);
    const location = new URL(response.headers.get('location') ?? '');

    expect(location.pathname).toBe('/trips');
    expect(location.searchParams.get('next')).toBe('/trips/trip-123?tab=timeline');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('allows the callback through without authentication or a redirect loop', async () => {
    const request = new NextRequest(
      'https://dashboard.example/auth/callback?code=one-time-code'
    );

    const response = await updateSupabaseSession(request);

    expect(proxyMocks.getUser).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBeNull();
  });

  it('allows an authenticated protected request and forwards refreshed cookies', async () => {
    proxyMocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    proxyMocks.refreshCookies = true;
    const request = new NextRequest('https://dashboard.example/trips/trip-123');

    const response = await updateSupabaseSession(request);

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('set-cookie')).toContain('sb-refreshed-session=');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('keeps the public sign-in page available to anonymous users', async () => {
    const request = new NextRequest('https://dashboard.example/trips');

    const response = await updateSupabaseSession(request);

    expect(response.headers.get('location')).toBeNull();
  });

  it('does not cache an authenticated protected response without a refresh', async () => {
    proxyMocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    const request = new NextRequest('https://dashboard.example/trips/trip-123');

    const response = await updateSupabaseSession(request);

    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('redirects an expired or invalid protected session without looping', async () => {
    proxyMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('invalid session'),
    });
    const request = new NextRequest('https://dashboard.example/trips/trip-123');

    const response = await updateSupabaseSession(request);

    expect(response.headers.get('location')).toBe(
      'https://dashboard.example/trips?next=%2Ftrips%2Ftrip-123'
    );
  });
});
