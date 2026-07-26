// ============================================================
// fetchDashboard.ts — Supabase batch data fetcher
// Parameterized by tripId — no hardcoded trip IDs.
// ============================================================

import { supabase } from './supabase';
import {
    toAlert,
    toAstroData,
    toCrewMember,
    toGearItem,
    toMeal,
    toOfflineStatus,
    toParkIntel,
    toPrepFeedItem,
    toSettings,
    toTimelineEvent,
    toTripDashboard,
    toTripMemberRole,
    toWeatherCurrent,
    toWeatherForecast,
} from './dashboardMapper';
import type { DashboardData, TripWithAccess } from '@/types';

// ─── Fetch all trips for the authenticated user ──────────────────
export type UserTrip = TripWithAccess;

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

    return data.flatMap((row) => row.trips
        ? [{ ...toTripDashboard(row.trips), role: toTripMemberRole(row.role) }]
        : []);
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
        trip: toTripDashboard(tripResult.data),
        currentWeather: weatherResult.data ? toWeatherCurrent(weatherResult.data) : null,
        forecast: (forecastResult.data ?? []).map(toWeatherForecast),
        gear: (gearResult.data ?? []).map(toGearItem),
        timeline: (timelineResult.data ?? []).map(toTimelineEvent),
        meals: (mealsResult.data ?? []).map(toMeal),
        crew: (crewResult.data ?? []).map(toCrewMember),
        parkIntel: parkIntelResult.data ? toParkIntel(parkIntelResult.data) : null,
        offlineStatus: offlineResult.data ? toOfflineStatus(offlineResult.data) : null,
        astro: astroResult.data ? toAstroData(astroResult.data) : null,
        alerts: (alertsResult.data ?? []).map(toAlert),
        prepFeed: (prepFeedResult.data ?? []).map(toPrepFeedItem),
        settings: toSettings(settingsResult.data),
    };
}
