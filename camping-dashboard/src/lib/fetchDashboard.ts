// ============================================================
// fetchDashboard.ts — Supabase batch data fetcher
// Parameterized by tripId — no hardcoded trip IDs.
// ============================================================

import { supabase } from './supabase';
import type {
    DashboardData,
    Trip,
    WeatherCurrent,
    WeatherForecast,
    GearItem,
    TimelineEvent,
    Meal,
    CrewMember,
    ParkIntel,
    OfflineStatus,
    AstroData,
    Alert,
    PrepFeedItem,
    Settings,
    TripMemberRole,
} from '@/types';

// ─── Fetch all trips for the authenticated user ──────────────────
export interface UserTrip extends Trip {
    role: TripMemberRole;
}

export async function fetchUserTrips(): Promise<UserTrip[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('trip_members')
        .select('role, trips(*)')
        .eq('user_id', user.id);

    if (error || !data) {
        console.error('[fetchUserTrips]', error?.message);
        return [];
    }

    // Supabase returns { role, trips: { ...tripFields } }
    return data
        .filter((row: Record<string, unknown>) => row.trips)
        .map((row: Record<string, unknown>) => ({
            ...(row.trips as Trip),
            role: row.role as TripMemberRole,
        }));
}

// ─── Fetch full dashboard data for a specific trip ───────────────
export async function fetchDashboardData(tripId: string): Promise<DashboardData> {
    const [
        tripResult,
        weatherResult,
        forecastResult,
        gearResult,
        timelineResult,
        mealsResult,
        crewResult,
        parkIntelResult,
        offlineResult,
        astroResult,
        alertsResult,
        settingsResult,
        prepFeedResult,
    ] = await Promise.all([
        supabase.from('trips').select('*').eq('id', tripId).single(),
        supabase.from('weather_current').select('*').eq('trip_id', tripId).maybeSingle(),
        supabase.from('weather_forecast').select('*').eq('trip_id', tripId).order('forecast_date'),
        supabase.from('gear_items').select('*').eq('trip_id', tripId).order('category').order('name'),
        supabase.from('timeline_events').select('*').eq('trip_id', tripId).order('day_number').order('sort_order'),
        supabase.from('meals').select('*').eq('trip_id', tripId).order('day_number').order('meal_type'),
        supabase.from('crew_members').select('*').eq('trip_id', tripId).order('canoe_number'),
        supabase.from('park_intel').select('*').eq('trip_id', tripId).maybeSingle(),
        supabase.from('offline_status').select('*').eq('trip_id', tripId).maybeSingle(),
        supabase.from('astro_data').select('*').eq('trip_id', tripId).maybeSingle(),
        supabase.from('alerts').select('*').eq('trip_id', tripId).eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('settings').select('*').eq('trip_id', tripId).single(),
        supabase.from('prep_feed_items').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
    ]);

    if (tripResult.error || !tripResult.data) {
        throw new Error(`[fetchDashboard] Failed to fetch trip details: ${tripResult.error?.message}`);
    }

    if (settingsResult.error || !settingsResult.data) {
        throw new Error(`[fetchDashboard] Failed to fetch required trip settings: ${settingsResult.error?.message ?? 'missing settings row'}`);
    }

    const optionalErrors = [
        weatherResult.error,
        parkIntelResult.error,
        offlineResult.error,
        astroResult.error,
    ].filter(Boolean);
    if (optionalErrors.length > 0) {
        throw new Error(`[fetchDashboard] Failed to fetch optional trip data: ${optionalErrors[0]?.message}`);
    }

    return {
        trip: tripResult.data as Trip,
        currentWeather: (weatherResult.data as WeatherCurrent | null) ?? null,
        forecast: (forecastResult.data as WeatherForecast[]) ?? [],
        gear: (gearResult.data as GearItem[]) ?? [],
        timeline: (timelineResult.data as TimelineEvent[]) ?? [],
        meals: (mealsResult.data as Meal[]) ?? [],
        crew: (crewResult.data as CrewMember[]) ?? [],
        parkIntel: (parkIntelResult.data as ParkIntel | null) ?? null,
        offlineStatus: (offlineResult.data as OfflineStatus | null) ?? null,
        astro: (astroResult.data as AstroData | null) ?? null,
        alerts: (alertsResult.data as Alert[]) ?? [],
        prepFeed: (prepFeedResult.data as PrepFeedItem[]) ?? [],
        settings: settingsResult.data as Settings,
    };
}
