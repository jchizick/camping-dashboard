// ============================================================
// POST /api/trips/create — authenticated transactional creation
// Postgres derives the owner from auth.uid() inside create_trip.
// ============================================================

import { createServerClient } from '@supabase/ssr';
import type { CreateTripArgs, Database } from '@/types/database';
import type { CreateTripRequest } from '@/types';
import { requiredEnvironmentVariable } from '@/lib/env';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

type CreateTripBody = Partial<CreateTripRequest>;

function rpcErrorResponse(error: {
    code?: string;
    message?: string;
} | null) {
    if (error?.code === '42501') {
        return NextResponse.json(
            {
                code: 'not_authorized',
                error: 'Your session cannot create this trip. Please sign in again.',
            },
            { status: 403 }
        );
    }

    if (error?.code === '22023') {
        return NextResponse.json(
            { code: 'invalid_trip', error: error.message ?? 'Trip details are invalid.' },
            { status: 400 }
        );
    }

    return NextResponse.json(
        {
            code: 'trip_creation_failed',
            error: error?.message ?? 'The trip could not be created.',
        },
        { status: 500 }
    );
}

export async function POST(request: NextRequest) {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
        requiredEnvironmentVariable(
            'NEXT_PUBLIC_SUPABASE_URL',
            process.env.NEXT_PUBLIC_SUPABASE_URL
        ),
        requiredEnvironmentVariable(
            'NEXT_PUBLIC_SUPABASE_ANON_KEY',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ),
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
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
        console.error('[POST /api/trips/create] Authentication failed', authError);
        return NextResponse.json(
            { code: 'not_authenticated', error: 'Please sign in before creating a trip.' },
            { status: 401 }
        );
    }

    let body: CreateTripBody;
    try {
        body = await request.json();
    } catch (error) {
        console.error('[POST /api/trips/create] Invalid JSON', error);
        return NextResponse.json(
            { code: 'invalid_request', error: 'The trip request could not be read.' },
            { status: 400 }
        );
    }

    const name = body.name?.trim() ?? '';
    if (!name || !body.start_date || !body.end_date) {
        return NextResponse.json(
            {
                code: 'missing_fields',
                error: 'Trip name, start date, and end date are required.',
            },
            { status: 400 }
        );
    }

    if (body.end_date < body.start_date) {
        return NextResponse.json(
            { code: 'invalid_dates', error: 'End date cannot be before start date.' },
            { status: 400 }
        );
    }

    const latitude = body.campsite_latitude;
    const longitude = body.campsite_longitude;
    if (
        typeof latitude !== 'number'
        || !Number.isFinite(latitude)
        || latitude < -90
        || latitude > 90
        || typeof longitude !== 'number'
        || !Number.isFinite(longitude)
        || longitude < -180
        || longitude > 180
    ) {
        return NextResponse.json(
            {
                code: 'missing_campsite',
                error: 'Select a valid campsite location before creating the trip.',
            },
            { status: 400 }
        );
    }

    const campsiteLabel = body.campsite_label?.trim() || undefined;
    const campsiteOsmId = body.campsite_osm_id?.trim() || undefined;
    const createTripArgs = {
        p_name: name,
        p_start_date: body.start_date,
        p_end_date: body.end_date,
        p_campsite_latitude: latitude,
        p_campsite_longitude: longitude,
        p_park_name: body.park_name?.trim() ?? '',
        p_lake_name: body.lake_name?.trim() ?? '',
        p_site_name: body.site_name?.trim() ?? '',
        p_campsite_source: body.campsite_source?.trim() || 'manual_map_selection',
        ...(campsiteLabel ? { p_campsite_label: campsiteLabel } : {}),
        ...(campsiteOsmId ? { p_campsite_osm_id: campsiteOsmId } : {}),
    } satisfies CreateTripArgs;
    const { data: tripId, error: createError } =
        await supabase.rpc('create_trip', createTripArgs);

    if (createError || typeof tripId !== 'string') {
        console.error('[POST /api/trips/create] RPC failed', {
            userId: user.id,
            error: createError,
            returnedTripId: tripId,
        });
        return rpcErrorResponse(createError);
    }

    return NextResponse.json({ tripId }, { status: 201 });
}
