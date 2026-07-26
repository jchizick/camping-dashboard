import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const supabaseMocks = vi.hoisted(() => ({
    single: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
    supabaseAdmin: {
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    single: supabaseMocks.single,
                })),
            })),
        })),
    },
}));

import { GET } from './route';

describe('refresh-weather trip validation', () => {
    beforeEach(() => {
        vi.stubEnv('WEATHER_REFRESH_SECRET', 'test-secret');
        supabaseMocks.single.mockReset();
    });

    it('requires an explicit trip_id instead of falling back to a legacy trip', async () => {
        const response = await GET(new NextRequest(
            'http://localhost/api/refresh-weather?secret=test-secret'
        ));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'trip_id is required' });
        expect(supabaseMocks.single).not.toHaveBeenCalled();
    });

    it('returns a clear response when a legacy trip has no campsite coordinates', async () => {
        supabaseMocks.single.mockResolvedValue({
            data: { campsite_latitude: null, campsite_longitude: null },
            error: null,
        });

        const response = await GET(new NextRequest(
            'http://localhost/api/refresh-weather?secret=test-secret&trip_id=legacy-trip'
        ));

        expect(response.status).toBe(422);
        expect(await response.json()).toEqual({
            error: 'Trip campsite coordinates are required before refreshing weather',
        });
    });
});
