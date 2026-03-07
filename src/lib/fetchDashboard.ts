// ============================================================
// fetchDashboard.ts — Server-side Supabase batch data fetcher
// Replaces all mockData.ts imports in page.tsx
// Falls back to mockDashboardData if Supabase is unreachable
// ============================================================

import { supabase } from './supabase';
import { mockDashboardData } from './mockData';
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
    try {
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
            supabase.from('weather_current').select('*').eq('trip_id', TRIP_ID).single(),
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

        // If any critical query failed, fall back to mock data
        if (tripResult.error || !tripResult.data) {
            console.warn('[fetchDashboard] Supabase fetch failed, falling back to mock data:', tripResult.error?.message);
            return mockDashboardData;
        }

        return {
            trip: tripResult.data as Trip,
            currentWeather: (weatherResult.data ?? mockDashboardData.currentWeather) as WeatherCurrent,
            forecast: (forecastResult.data ?? mockDashboardData.forecast) as WeatherForecast[],
            gear: (gearResult.data ?? mockDashboardData.gear) as GearItem[],
            timeline: (timelineResult.data ?? mockDashboardData.timeline) as TimelineEvent[],
            meals: (mealsResult.data ?? mockDashboardData.meals) as Meal[],
            crew: (crewResult.data ?? mockDashboardData.crew) as CrewMember[],
            parkIntel: (parkIntelResult.data ?? mockDashboardData.parkIntel) as ParkIntel,
            offlineStatus: (offlineResult.data ?? mockDashboardData.offlineStatus) as OfflineStatus,
            astro: (astroResult.data ?? mockDashboardData.astro) as AstroData,
            alerts: (alertsResult.data ?? mockDashboardData.alerts) as Alert[],
            settings: (settingsResult.data ?? mockDashboardData.settings) as Settings,
        };
    } catch (err) {
        console.error('[fetchDashboard] Unexpected error, falling back to mock data:', err);
        return mockDashboardData;
    }
}
