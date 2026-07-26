import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
    getUser: vi.fn(),
    getSession: vi.fn(),
}));

vi.mock('next/headers', () => ({
    cookies: vi.fn(async () => ({
        getAll: vi.fn(() => []),
        set: vi.fn(),
    })),
}));

vi.mock('@supabase/ssr', () => ({
    createServerClient: vi.fn(() => ({
        auth: {
            getUser: mocks.getUser,
            getSession: mocks.getSession,
        },
    })),
}));

import { POST } from './route';

function request(body: unknown) {
    return new NextRequest('http://localhost/api/refresh-weather', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('authenticated manual weather refresh proxy', () => {
    beforeEach(() => {
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
        vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'public-anon-key');
        mocks.getUser.mockReset();
        mocks.getSession.mockReset();
        mocks.getUser.mockResolvedValue({
            data: { user: { id: 'verified-user' } },
            error: null,
        });
        mocks.getSession.mockResolvedValue({
            data: { session: { access_token: 'user-access-token' } },
            error: null,
        });
    });

    it('denies unauthenticated requests before invoking the Edge Function', async () => {
        mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const response = await POST(request({ tripId: 'trip-one' }));

        expect(response.status).toBe(401);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('requires a trip in the JSON body and never accepts query secrets', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const response = await POST(request({}));

        expect(response.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('forwards only the verified user token and trip to the shared pipeline', async () => {
        const fetchMock = vi.fn(async () => new Response(
            JSON.stringify({ completed: 1 }),
            { status: 200 }
        ));
        vi.stubGlobal('fetch', fetchMock);

        const response = await POST(request({ tripId: 'trip-one' }));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true });
        const [url, options] = fetchMock.mock.calls[0] as unknown as [
            string,
            RequestInit,
        ];
        expect(url).toBe(
            'https://example.supabase.co/functions/v1/refresh-trip-weather'
        );
        expect(options).toMatchObject({
            method: 'POST',
            cache: 'no-store',
            headers: {
                Authorization: 'Bearer user-access-token',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ mode: 'manual', tripId: 'trip-one' }),
        });
        expect(JSON.stringify(options)).not.toContain('service_role');
    });

    it.each([
        [403, 'not_authorized'],
        [409, 'weather_refresh_cooldown'],
        [503, 'weather_refresh_failed'],
    ])('maps Edge status %s to sanitized application errors', async (status, code) => {
        vi.stubGlobal('fetch', vi.fn(async () => new Response(
            JSON.stringify({ privateDetail: 'must not pass through' }),
            { status }
        )));

        const response = await POST(request({ tripId: 'trip-one' }));
        const body = await response.json();

        expect(response.status).toBe(status);
        expect(body.code).toBe(code);
        expect(JSON.stringify(body)).not.toContain('privateDetail');
        expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    });
});
