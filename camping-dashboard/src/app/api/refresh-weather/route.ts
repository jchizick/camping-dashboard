import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { requiredEnvironmentVariable } from '@/lib/env';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

type RefreshWeatherBody = {
    tripId?: unknown;
};

function json(body: unknown, status: number) {
    return NextResponse.json(body, {
        status,
        headers: { 'Cache-Control': 'private, no-store' },
    });
}

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const supabaseUrl = requiredEnvironmentVariable(
        'NEXT_PUBLIC_SUPABASE_URL',
        process.env.NEXT_PUBLIC_SUPABASE_URL
    );
    const supabase = createServerClient<Database>(
        supabaseUrl,
        requiredEnvironmentVariable(
            'NEXT_PUBLIC_SUPABASE_ANON_KEY',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ),
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                },
            },
        }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return json(
            { code: 'not_authenticated', error: 'Please sign in to refresh weather.' },
            401
        );
    }

    let body: RefreshWeatherBody;
    try {
        body = await request.json() as RefreshWeatherBody;
    } catch {
        return json(
            { code: 'invalid_request', error: 'The weather refresh request could not be read.' },
            400
        );
    }
    if (typeof body.tripId !== 'string' || body.tripId.length < 1 || body.tripId.length > 200) {
        return json(
            { code: 'invalid_trip', error: 'A valid trip is required.' },
            400
        );
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (sessionError || !accessToken) {
        return json(
            { code: 'not_authenticated', error: 'Please sign in again to refresh weather.' },
            401
        );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let edgeResponse: Response;
    try {
        edgeResponse = await fetch(`${supabaseUrl}/functions/v1/refresh-trip-weather`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ mode: 'manual', tripId: body.tripId }),
            cache: 'no-store',
        });
    } catch {
        return json(
            {
                code: 'weather_refresh_unavailable',
                error: 'Weather refresh is temporarily unavailable.',
            },
            503
        );
    } finally {
        clearTimeout(timeout);
    }

    if (edgeResponse.status === 401) {
        return json(
            { code: 'not_authenticated', error: 'Please sign in again to refresh weather.' },
            401
        );
    }
    if (edgeResponse.status === 403) {
        return json(
            { code: 'not_authorized', error: 'Trip editor access is required.' },
            403
        );
    }
    if (edgeResponse.status === 409) {
        return json(
            {
                code: 'weather_refresh_cooldown',
                error: 'Weather refresh is already running or was requested recently.',
            },
            409
        );
    }
    if (!edgeResponse.ok) {
        return json(
            {
                code: 'weather_refresh_failed',
                error: 'Weather could not be refreshed. Existing weather remains available.',
            },
            503
        );
    }

    return json({ ok: true }, 200);
}
