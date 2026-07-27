import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getSession: vi.fn() }));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ getAll: vi.fn(() => []), set: vi.fn() })),
}));
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mocks.getUser, getSession: mocks.getSession },
  })),
}));
import { POST } from './route';

function request(body: unknown) {
  return new NextRequest('http://localhost/api/refresh-alerts?secret=ignored', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('authenticated manual alert refresh proxy', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-anon-key');
    mocks.getUser.mockReset().mockResolvedValue({
      data: { user: { id: 'verified-user' } },
      error: null,
    });
    mocks.getSession.mockReset().mockResolvedValue({
      data: { session: { access_token: 'user-access-token' } },
      error: null,
    });
  });

  it('denies anonymous callers before invoking the Edge Function', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await POST(request({ tripId: 'trip' }))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards only the verified token and trip, ignoring provider context', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(request({
      tripId: 'trip-one',
      provider: 'attacker-provider',
      regionCode: 'attacker-region',
    }));
    expect(response.status).toBe(200);
    const [, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(options.body).toBe(JSON.stringify({ mode: 'manual', tripId: 'trip-one' }));
    expect(JSON.stringify(options)).not.toContain('attacker-provider');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it.each([
    [403, 'not_authorized'],
    [409, 'alert_refresh_unavailable_for_trip'],
    [503, 'alert_refresh_failed'],
  ])('maps Edge status %s without exposing its response', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ privateDetail: 'must not pass through' }),
      { status }
    )));
    const response = await POST(request({ tripId: 'trip-one' }));
    const body = await response.json();
    expect(response.status).toBe(status);
    expect(body.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain('privateDetail');
  });
});
