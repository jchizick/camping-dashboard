import type { DashboardData, GearItem, TimelineEvent, TripDashboard, OfflineStatus, Alert } from '../../../src/types';
import { createHomeViewModel } from './historical/components/home/homeViewModel';
import { evaluateReadiness } from './historical/lib/readiness';
export const trip = {
    id: 'demo',
    name: 'Pine Lake Weekend',
    park_name: 'Northwoods Park',
    lake_name: 'Pine Lake',
    site_name: 'Site 4',
    start_date: '2027-07-05',
    end_date: '2027-07-08',
    campsite_latitude: null,
    campsite_longitude: null
} as TripDashboard;
export const timeline = [
    {
        id: 'e1',
        trip_id: 'demo',
        day_number: 1,
        event_time: '09:00',
        title: 'Meet at the trailhead',
        sort_order: 0
    },
    {
        id: 'e2',
        trip_id: 'demo',
        day_number: 1,
        event_time: '11:30',
        title: 'Set up base camp',
        sort_order: 1
    }
] as TimelineEvent[];
export const gear = [
    'Tent', 'Sleeping bag', 'Water filter', 'First aid kit'
].map((name, i) => ({
    id: 'g' + i,
    trip_id: 'demo', name,
    priority: 'critical',
    acquired: true,
    packed: true
})) as GearItem[];
export const offlineStatus = {
    maps_cached: true,
    permit_saved: true,
    daily_vehicle_permit_saved: false,
    route_downloaded: true,
    satellite_device_connected: false,
    emergency_contact_ready: true
} as OfflineStatus;
export const data = {
    currentWeather: {
        temperature_c: 18,
        condition_label: 'Mainly clear',
        sunset_time: '20:47',
        updated_at: '2027-07-05T12:00:00Z'
    },
    weatherRefresh: null,
    forecast: [
        {
            id: 'f1',
            forecast_date: '2027-07-05',
            high_c: 22,
            low_c: 13,
            condition_label: 'Mainly clear',
            rain_chance: 10
        },
        {
            id: 'f2',
            forecast_date: '2027-07-06',
            high_c: 24,
            low_c: 14,
            condition_label: 'Partly cloudy',
            rain_chance: 20
        },
        {
            id: 'f3',
            forecast_date: '2027-07-07',
            high_c: 20,
            low_c: 12,
            condition_label: 'Light showers',
            rain_chance: 60
        },
        {
            id: 'f4',
            forecast_date: '2027-07-08',
            high_c: 23,
            low_c: 13,
            condition_label: 'Mainly clear',
            rain_chance: 10
        },
        {
            id: 'f5',
            forecast_date: '2027-07-09',
            high_c: 25,
            low_c: 15,
            condition_label: 'Partly cloudy',
            rain_chance: 15
        }
    ],
    astro: null
} as unknown as DashboardData;
export const readiness = evaluateReadiness({
    tripId: 'demo',
    tripDays: 4, gear,
    meals: [], timeline,
    currentWeather: null,
    forecast: [], offlineStatus,
    modules: {
        mealsEnabled: false,
        offlineEnabled: true
    }
});
export const model = createHomeViewModel({
    data, trip,
    tripDays: 4, timeline,
    alerts: [
        {
            id: 'demo-notice',
            trip_id: 'demo',
            title: 'Use designated tent pads to protect lakeshore vegetation.',
            body: 'Keep camp within the established site.',
            severity: 'info',
            source: 'manual',
            is_active: true,
            dismissed_at: null,
            created_at: '2027-07-05T12:00:00Z'
        } as Alert
    ], gear, readiness
});
