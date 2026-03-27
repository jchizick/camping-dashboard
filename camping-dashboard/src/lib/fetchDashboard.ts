// ============================================================
// fetchDashboard.ts — Server-side Supabase batch data fetcher
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
    Settings,
} from '@/types';

const TRIP_ID = 'trip-maple-lake-001';

export async function fetchDashboardData(): Promise<DashboardData> {
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
    ] = await Promise.all([
        supabase.from('trips').select('*').eq('id', TRIP_ID).single(),
        supabase.from('weather_current').select('*').eq('id', 'weather-maple-lake-current').single(),
        supabase.from('weather_forecast').select('*').eq('trip_id', TRIP_ID).order('forecast_date'),
        supabase.from('gear_items').select('*').eq('trip_id', TRIP_ID).order('category').order('name'),
        supabase.from('timeline_events').select('*').eq('trip_id', TRIP_ID).order('day_number').order('sort_order'),
        supabase.from('meals').select('*').eq('trip_id', TRIP_ID).order('day_number').order('meal_type'),
        supabase.from('crew_members').select('*').eq('trip_id', TRIP_ID).order('canoe_number'),
        supabase.from('park_intel').select('*').eq('trip_id', TRIP_ID).single(),
        supabase.from('offline_status').select('*').eq('trip_id', TRIP_ID).single(),
        supabase.from('astro_data').select('*').eq('trip_id', TRIP_ID).single(),
        supabase.from('alerts').select('*').eq('trip_id', TRIP_ID).eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('settings').select('*').eq('trip_id', TRIP_ID).single(),
    ]);

    if (tripResult.error || !tripResult.data) {
        throw new Error(`[fetchDashboard] Failed to fetch trip details: ${tripResult.error?.message}`);
    }

    return {
        trip: tripResult.data as Trip,
        currentWeather: weatherResult.data as WeatherCurrent,
        forecast: forecastResult.data as WeatherForecast[],
        gear: gearResult.data as GearItem[],
        timeline: timelineResult.data as TimelineEvent[],
        meals: mealsResult.data as Meal[],
        crew: crewResult.data as CrewMember[],
        parkIntel: parkIntelResult.data as ParkIntel,
        offlineStatus: offlineResult.data as OfflineStatus,
        astro: astroResult.data as AstroData,
        alerts: alertsResult.data as Alert[],
        settings: settingsResult.data as Settings,
    };
}
