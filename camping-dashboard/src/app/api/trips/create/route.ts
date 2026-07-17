// ============================================================
// POST /api/trips/create — Server-side trip creation
// Uses service_role to atomically create trip + membership +
// default rows. Prevents orphaned trips under RLS.
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
    // 1. Validate the caller is authenticated
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                },
            },
        }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    let body: {
        name: string;
        park_name?: string;
        lake_name?: string;
        site_name?: string;
        start_date: string;
        end_date: string;
        launch_point_name?: string;
        launch_lat?: number;
        launch_lng?: number;
        site_lat?: number;
        site_lng?: number;
        distance_km?: number;
        notes?: string;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body.name || !body.start_date || !body.end_date) {
        return NextResponse.json({ error: 'name, start_date, and end_date are required' }, { status: 400 });
    }

    // 3. Generate trip ID
    const tripId = `trip-${crypto.randomUUID().slice(0, 12)}`;

    try {
        // 4. Create trip row
        const { error: tripError } = await supabaseAdmin
            .from('trips')
            .insert({
                id: tripId,
                name: body.name,
                park_name: body.park_name ?? '',
                lake_name: body.lake_name ?? '',
                site_name: body.site_name ?? '',
                start_date: body.start_date,
                end_date: body.end_date,
                launch_point_name: body.launch_point_name ?? '',
                launch_lat: body.launch_lat ?? 0,
                launch_lng: body.launch_lng ?? 0,
                site_lat: body.site_lat ?? 0,
                site_lng: body.site_lng ?? 0,
                distance_km: body.distance_km ?? 0,
                notes: body.notes ?? '',
                theme_mode: 'auto',
            });

        if (tripError) throw new Error(`Trip insert failed: ${tripError.message}`);

        // 5. Create trip_members owner row
        const { error: memberError } = await supabaseAdmin
            .from('trip_members')
            .insert({
                trip_id: tripId,
                user_id: user.id,
                role: 'owner',
            });

        if (memberError) throw new Error(`Membership insert failed: ${memberError.message}`);

        // 6. Create default settings
        const { error: settingsError } = await supabaseAdmin
            .from('settings')
            .insert({
                trip_id: tripId,
                manual_theme_override: 'auto',
                preferred_units: 'metric',
                show_astro: true,
                show_meals: true,
                show_offline: true,
                show_crew: true,
                theme_variant: 'expedition',
            });

        if (settingsError) throw new Error(`Settings insert failed: ${settingsError.message}`);

        // 7. Create default park_intel
        const { error: intelError } = await supabaseAdmin
            .from('park_intel')
            .insert({
                trip_id: tripId,
                fire_restriction: 'Unknown',
                wildlife_notes: '',
                ranger_station: '',
                firewood_percent: 0,
                water_notes: '',
                custom_notes: '',
            });

        if (intelError) throw new Error(`Park intel insert failed: ${intelError.message}`);

        // 8. Create default offline_status
        const { error: offlineError } = await supabaseAdmin
            .from('offline_status')
            .insert({
                trip_id: tripId,
                maps_cached: false,
                permit_saved: false,
                daily_vehicle_permit_saved: false,
                route_downloaded: false,
                satellite_device_connected: false,
                satellite_device_name: '',
                emergency_contact_ready: false,
            });

        if (offlineError) throw new Error(`Offline status insert failed: ${offlineError.message}`);

        // 9. Create default astro_data
        const { error: astroError } = await supabaseAdmin
            .from('astro_data')
            .insert({
                trip_id: tripId,
                golden_hour_start: '',
                golden_hour_end: '',
                blue_hour_end: '',
                moon_phase: 'Unknown',
                moon_illumination: 0,
                milky_way_visibility: 'Unknown',
                stargazing_notes: '',
            });

        if (astroError) throw new Error(`Astro data insert failed: ${astroError.message}`);

        return NextResponse.json({ tripId }, { status: 201 });

    } catch (err) {
        console.error('[POST /api/trips/create]', err);

        // Attempt cleanup on failure — delete the trip (cascades to trip_members)
        await supabaseAdmin.from('trips').delete().eq('id', tripId);

        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Failed to create trip' },
            { status: 500 }
        );
    }
}
