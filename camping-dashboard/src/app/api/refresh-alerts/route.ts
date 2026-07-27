import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';
import { requiredEnvironmentVariable } from '@/lib/env';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

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
                setAll(values) {
                    values.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                },
            },
        }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return json({ code: 'not_authenticated', error: 'Please sign in to refresh alerts.' }, 401);
    }

    let body: { tripId?: unknown };
    try {
        body = await request.json() as typeof body;
    } catch {
        return json({ code: 'invalid_request', error: 'The alert refresh request could not be read.' }, 400);
    }
    if (typeof body.tripId !== 'string' || body.tripId.length < 1 || body.tripId.length > 200) {
        return json({ code: 'invalid_trip', error: 'A valid trip is required.' }, 400);
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (sessionError || !accessToken) {
        return json({ code: 'not_authenticated', error: 'Please sign in again to refresh alerts.' }, 401);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
        response = await fetch(`${supabaseUrl}/functions/v1/refresh-trip-alerts`, {
            method: 'POST',
            signal: controller.signal,
            cache: 'no-store',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ mode: 'manual', tripId: body.tripId }),
        });
    } catch {
        return json({
            code: 'alert_refresh_unavailable',
            error: 'Alert refresh is temporarily unavailable.',
        }, 503);
    } finally {
        clearTimeout(timeout);
    }
    if (response.status === 401) {
        return json({ code: 'not_authenticated', error: 'Please sign in again to refresh alerts.' }, 401);
    }
    if (response.status === 403) {
        return json({ code: 'not_authorized', error: 'Trip editor access is required.' }, 403);
    }
    if (response.status === 409) {
        return json({
            code: 'alert_refresh_unavailable_for_trip',
            error: 'No automated source is configured, or refresh is already running or cooling down.',
        }, 409);
    }
    if (!response.ok) {
        return json({
            code: 'alert_refresh_failed',
            error: 'Alerts could not be refreshed. Existing alerts remain available.',
        }, 503);
    }
    return json({ ok: true }, 200);
}
