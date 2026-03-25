// ============================================================
// /api/refresh-weather/route.ts — Weather refresh endpoint
// Fetches live data from Open-Meteo and upserts into Supabase
// Secured: requires ?secret=WEATHER_REFRESH_SECRET query param
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { mapOpenMeteoToSupabase } from '@/lib/weatherMapper';
import type { OpenMeteoResponse } from '@/lib/weatherMapper';

const TRIP_ID = 'trip-maple-lake-001';
const FORECAST_DAYS = 5;

// ─── Auth guard ──────────────────────────────────────────────────────────────
// Accepts two methods:
//   1. Vercel Cron:  Authorization: Bearer {CRON_SECRET}  (set in Vercel dashboard)
//   2. Manual call: GET /api/refresh-weather?secret={WEATHER_REFRESH_SECRET}
function isAuthorized(req: NextRequest): boolean {
    // Method 1: Vercel Cron header
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

    // Method 2: Legacy query param (manual trigger)
    const querySecret = process.env.WEATHER_REFRESH_SECRET;
    if (querySecret) {
        const provided = req.nextUrl.searchParams.get('secret');
        if (provided === querySecret) return true;
    }

    return false;
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── 1. Fetch trip coordinates from Supabase ───────────────────────────────
    const { data: trip, error: tripErr } = await supabaseAdmin
        .from('trips')
        .select('site_lat, site_lng')
        .eq('id', TRIP_ID)
        .single();

    if (tripErr || !trip) {
        console.error('[refresh-weather] Could not load trip:', tripErr?.message);
        return NextResponse.json(
            { error: 'Trip not found', detail: tripErr?.message },
            { status: 500 }
        );
    }

    const { site_lat, site_lng } = trip;

    // ── 2. Fetch from Open-Meteo ──────────────────────────────────────────────
    // Docs: https://open-meteo.com/en/docs
    const currentFields = [
        'temperature_2m',
        'relative_humidity_2m',
        'wind_speed_10m',
        'weather_code',
        'precipitation_probability',
        'visibility',
    ];
    const dailyFields = [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
        'wind_speed_10m_max',
        'sunrise',
        'sunset',
        // moonrise / moonset are NOT available from Open-Meteo — defaulted to '--:--' in mapper
    ];

    // Open-Meteo requires repeated query keys for array params (not comma-joined strings)
    const baseParams = new URLSearchParams({
        latitude: String(site_lat),
        longitude: String(site_lng),
        timezone: 'America/Toronto',
        forecast_days: String(FORECAST_DAYS),
    });
    currentFields.forEach(f => baseParams.append('current', f));
    dailyFields.forEach(f => baseParams.append('daily', f));

    const meteoUrl = `https://api.open-meteo.com/v1/forecast?${baseParams.toString()}`;

    let meteoData: OpenMeteoResponse;
    try {
        const res = await fetch(meteoUrl, { next: { revalidate: 0 } });
        if (!res.ok) {
            const body = await res.text();
            console.error('[refresh-weather] Open-Meteo error:', body);
            return NextResponse.json(
                { error: 'Open-Meteo request failed', detail: body },
                { status: 502 }
            );
        }
        meteoData = await res.json();
    } catch (err) {
        console.error('[refresh-weather] Fetch to Open-Meteo threw:', err);
        return NextResponse.json(
            { error: 'Network error reaching Open-Meteo' },
            { status: 502 }
        );
    }

    // ── 3. Map to our schema ──────────────────────────────────────────────────
    const { current, forecasts } = mapOpenMeteoToSupabase(meteoData, TRIP_ID, FORECAST_DAYS);

    // ── 4. Upsert weather_current ─────────────────────────────────────────────
    const { error: currentErr } = await supabaseAdmin
        .from('weather_current')
        .upsert(
            { ...current, id: 'weather-maple-lake-current' },
            { onConflict: 'id' }
        );

    if (currentErr) {
        console.error('[refresh-weather] Upsert weather_current failed:', currentErr.message);
        return NextResponse.json(
            { error: 'Failed to write weather_current', detail: currentErr.message },
            { status: 500 }
        );
    }

    // ── 5. Delete old forecast rows, then insert fresh ones ───────────────────
    const { error: deleteErr } = await supabaseAdmin
        .from('weather_forecast')
        .delete()
        .eq('trip_id', TRIP_ID);

    if (deleteErr) {
        console.error('[refresh-weather] Delete old forecast failed:', deleteErr.message);
        return NextResponse.json(
            { error: 'Failed to clear old forecasts', detail: deleteErr.message },
            { status: 500 }
        );
    }

    const { error: insertErr } = await supabaseAdmin
        .from('weather_forecast')
        .insert(forecasts);

    if (insertErr) {
        console.error('[refresh-weather] Insert forecasts failed:', insertErr.message);
        return NextResponse.json(
            { error: 'Failed to write weather_forecast', detail: insertErr.message },
            { status: 500 }
        );
    }

    // ── 6. Done ───────────────────────────────────────────────────────────────
    console.log(`[refresh-weather] ✅ Weather updated for ${TRIP_ID} at ${current.updated_at}`);
    return NextResponse.json({
        ok: true,
        updated_at: current.updated_at,
        current: {
            temperature_c: current.temperature_c,
            condition_label: current.condition_label,
            icon: current.icon,
        },
        forecast_days: forecasts.length,
    });
}
