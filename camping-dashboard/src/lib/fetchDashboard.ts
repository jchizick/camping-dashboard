// ============================================================
// fetchDashboard.ts — Supabase batch data fetcher
// Parameterized by tripId — no hardcoded trip IDs.
// ============================================================

import { supabase } from './supabase';
import {
    toAlert,
    toAlertRefreshState,
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
    toWeatherRefreshState,
} from './dashboardMapper';
import type { DashboardData, TripWithAccess } from '@/types';
import {
    createWorkspaceSourceStatus,
    type WorkspaceSourceKey,
    type WorkspaceSourceStatus,
} from './workspaceSources';
import {
    RemoteWorkspaceError,
    type RemoteWorkspaceFailureKind,
} from './remoteWorkspaceError';

export interface RemoteDashboardLoad {
    data: DashboardData;
    sourceStatus: WorkspaceSourceStatus;
}

function markFailed(
    status: WorkspaceSourceStatus,
    key: WorkspaceSourceKey,
    failed: unknown
) {
    if (failed) status[key] = 'failed';
}

function mapRowsWithStatus<Row, Value>(
    rows: readonly Row[],
    key: WorkspaceSourceKey,
    status: WorkspaceSourceStatus,
    mapper: (row: Row) => Value,
    warning: string
): Value[] {
    return rows.flatMap((row) => {
        try {
            return [mapper(row)];
        } catch {
            status[key] = 'failed';
            if (process.env.NODE_ENV !== 'production') console.warn(warning);
            return [];
        }
    });
}

// ─── Fetch all trips for the authenticated user ──────────────────
export type UserTrip = TripWithAccess;

export type UserTripsFetchFailureKind =
    | 'unauthenticated'
    | 'forbidden'
    | 'unavailable';

export class UserTripsFetchError extends Error {
    constructor(
        readonly kind: UserTripsFetchFailureKind,
        message: string
    ) {
        super(message);
        this.name = 'UserTripsFetchError';
    }
}

function classifyUserTripsFailure(status: number | undefined) {
    if (status === 401) return 'unauthenticated' as const;
    if (status === 403) return 'forbidden' as const;
    return 'unavailable' as const;
}

export async function fetchUserTrips(): Promise<UserTrip[]> {
    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError) {
        throw new UserTripsFetchError(
            authError.status === 401 || authError.status === 403
                ? 'unauthenticated'
                : 'unavailable',
            'The current session could not be verified.'
        );
    }
    if (!userData.user) {
        throw new UserTripsFetchError(
            'unauthenticated',
            'No authenticated user is available.'
        );
    }

    const { data, error, status } = await supabase
        .from('trip_members')
        .select('role, trips(*)')
        .eq('user_id', userData.user.id);

    if (error || !data) {
        throw new UserTripsFetchError(
            classifyUserTripsFailure(status),
            error?.message ?? 'The trip list source returned no data.'
        );
    }

    return data.flatMap((row) => row.trips
        ? [{ ...toTripDashboard(row.trips), role: toTripMemberRole(row.role) }]
        : []);
}

// ─── Fetch full dashboard data for a specific trip ───────────────
export async function fetchDashboardDataWithStatus(
    tripId: string
): Promise<RemoteDashboardLoad> {
    const [
        tripResult,
        weatherResult,
        forecastResult,
        weatherRefreshResult,
        gearResult,
        timelineResult,
        mealsResult,
        crewResult,
        parkIntelResult,
        offlineResult,
        astroResult,
        alertsResult,
        alertRefreshResult,
        settingsResult,
        prepFeedResult,
    ] = await Promise.all([
        supabase.from('trips').select('*').eq('id', tripId).single(),
        supabase.from('weather_current').select('*').eq('trip_id', tripId).maybeSingle(),
        supabase.from('weather_forecast').select('*').eq('trip_id', tripId).order('forecast_date'),
        supabase.from('weather_refresh_state').select('*').eq('trip_id', tripId).maybeSingle(),
        supabase.from('gear_items').select('*').eq('trip_id', tripId).order('category').order('name'),
        supabase.from('timeline_events').select('*').eq('trip_id', tripId).order('day_number').order('sort_order'),
        supabase.from('meals').select('*').eq('trip_id', tripId).order('day_number').order('meal_type'),
        supabase.from('crew_members').select('*').eq('trip_id', tripId).order('canoe_number'),
        supabase.from('park_intel').select('*').eq('trip_id', tripId).maybeSingle(),
        supabase.from('offline_status').select('*').eq('trip_id', tripId).maybeSingle(),
        supabase.from('astro_data').select('*').eq('trip_id', tripId).maybeSingle(),
        supabase.from('alerts').select('*').eq('trip_id', tripId).eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('alert_refresh_state').select('*').eq('trip_id', tripId).order('provider'),
        supabase.from('settings').select('*').eq('trip_id', tripId).single(),
        supabase.from('prep_feed_items').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
    ]);

    const sourceStatus = createWorkspaceSourceStatus('complete');
    markFailed(sourceStatus, 'trip', tripResult.error);
    markFailed(sourceStatus, 'currentWeather', weatherResult.error);
    markFailed(sourceStatus, 'forecast', forecastResult.error);
    markFailed(sourceStatus, 'weatherRefresh', weatherRefreshResult.error);
    markFailed(sourceStatus, 'gear', gearResult.error);
    markFailed(sourceStatus, 'timeline', timelineResult.error);
    markFailed(sourceStatus, 'meals', mealsResult.error);
    markFailed(sourceStatus, 'crew', crewResult.error);
    markFailed(sourceStatus, 'parkIntel', parkIntelResult.error);
    markFailed(sourceStatus, 'offlineStatus', offlineResult.error);
    markFailed(sourceStatus, 'astro', astroResult.error);
    markFailed(sourceStatus, 'alerts', alertsResult.error);
    markFailed(sourceStatus, 'alertRefresh', alertRefreshResult.error);
    markFailed(sourceStatus, 'settings', settingsResult.error);
    markFailed(sourceStatus, 'prepFeed', prepFeedResult.error);

    if (tripResult.error || !tripResult.data) {
        const kind: RemoteWorkspaceFailureKind =
            tripResult.status === 401 || tripResult.status === 403
                ? 'denied'
                : tripResult.status === 404 || tripResult.error?.code === 'PGRST116' || !tripResult.error
                    ? 'not-found'
                    : tripResult.status >= 500
                        ? 'temporary'
                        : 'temporary';
        throw new RemoteWorkspaceError(
            `[fetchDashboard] Failed to fetch trip details: ${tripResult.error?.message ?? 'trip not found'}`,
            kind
        );
    }

    if (settingsResult.error || !settingsResult.data) {
        throw new RemoteWorkspaceError(
            `[fetchDashboard] Failed to fetch required trip settings: ${settingsResult.error?.message ?? 'missing settings row'}`,
            settingsResult.status === 401 || settingsResult.status === 403
                ? 'denied'
                : 'temporary'
        );
    }

    const optionalErrors = [
        parkIntelResult.error,
        offlineResult.error,
        astroResult.error,
    ].filter(Boolean);
    if (optionalErrors.length > 0) {
        throw new RemoteWorkspaceError(
            `[fetchDashboard] Failed to fetch optional trip data: ${optionalErrors[0]?.message}`,
            'temporary'
        );
    }

    let currentWeather: DashboardData['currentWeather'] = null;
    let forecast: DashboardData['forecast'] = [];
    let weatherRefresh: DashboardData['weatherRefresh'] = null;
    if (weatherResult.error) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[fetchDashboard] Current weather could not be loaded.');
        }
    } else {
        try {
            currentWeather = weatherResult.data ? toWeatherCurrent(weatherResult.data) : null;
        } catch {
            sourceStatus.currentWeather = 'failed';
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[fetchDashboard] Current weather is malformed.');
            }
        }
    }

    if (forecastResult.error) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[fetchDashboard] Weather forecast could not be loaded.');
        }
    } else {
        forecast = mapRowsWithStatus(
            forecastResult.data ?? [],
            'forecast',
            sourceStatus,
            toWeatherForecast,
            '[fetchDashboard] Omitting malformed weather forecast data.'
        );
    }

    if (weatherRefreshResult.error) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[fetchDashboard] Weather refresh status could not be loaded.');
        }
    } else {
        try {
            weatherRefresh = weatherRefreshResult.data
                ? toWeatherRefreshState(weatherRefreshResult.data)
                : null;
        } catch {
            sourceStatus.weatherRefresh = 'failed';
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[fetchDashboard] Weather refresh status is malformed.');
            }
        }
    }

    if (alertsResult.error && process.env.NODE_ENV !== 'production') {
        console.warn('[fetchDashboard] Alerts could not be loaded.');
    }
    if (alertRefreshResult.error && process.env.NODE_ENV !== 'production') {
        console.warn('[fetchDashboard] Alert synchronization status could not be loaded.');
    }

    const timeline = mapRowsWithStatus(
        timelineResult.data ?? [],
        'timeline',
        sourceStatus,
        toTimelineEvent,
        '[fetchDashboard] Omitting a malformed timeline event.'
    );
    const alerts = mapRowsWithStatus(
        alertsResult.data ?? [],
        'alerts',
        sourceStatus,
        toAlert,
        '[fetchDashboard] Omitting malformed alert data.'
    );
    const alertRefresh =
        alertsResult.error || alertRefreshResult.error
            ? null
            : mapRowsWithStatus(
                alertRefreshResult.data ?? [],
                'alertRefresh',
                sourceStatus,
                toAlertRefreshState,
                '[fetchDashboard] Omitting malformed alert refresh state.'
            );

    const data: DashboardData = {
        trip: toTripDashboard(tripResult.data),
        currentWeather,
        forecast,
        weatherRefresh,
        gear: (gearResult.data ?? []).map(toGearItem),
        timeline,
        meals: (mealsResult.data ?? []).map(toMeal),
        crew: (crewResult.data ?? []).map(toCrewMember),
        parkIntel: parkIntelResult.data ? toParkIntel(parkIntelResult.data) : null,
        offlineStatus: offlineResult.data ? toOfflineStatus(offlineResult.data) : null,
        astro: astroResult.data ? toAstroData(astroResult.data) : null,
        alerts,
        alertRefresh,
        prepFeed: (prepFeedResult.data ?? []).map(toPrepFeedItem),
        settings: toSettings(settingsResult.data),
    };

    return { data, sourceStatus };
}

export async function fetchDashboardData(tripId: string): Promise<DashboardData> {
    return (await fetchDashboardDataWithStatus(tripId)).data;
}
