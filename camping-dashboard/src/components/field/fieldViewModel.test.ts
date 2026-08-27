import { describe, expect, it } from 'vitest';
import { evaluateOfflineCategory } from '@/lib/readiness';
import type {
  Alert,
  DashboardData,
  OfflineStatus,
  ParkIntel,
  TripDashboard,
} from '@/types';
import { createFieldViewModel, fieldContactHref } from './fieldViewModel';

const trip = {
  id: 'trip-1',
  name: 'North Lake',
  park_name: 'Algonquin Park',
  lake_name: 'North Tea Lake',
  site_name: 'Site 12',
  campsite_label: 'North Tea — 12',
  start_date: '2026-08-01',
  end_date: '2026-08-03',
} as unknown as TripDashboard;

const intel = {
  trip_id: 'trip-1',
  fire_restriction: 'Partial fire ban after 7 PM',
  wildlife_notes: 'Store food in the bear cache.',
  ranger_station: 'West Gate · 705-555-0142',
  firewood_percent: 60,
  water_notes: 'Boil or filter lake water.',
  custom_notes: 'Landing is rocky in low water.',
  updated_at: '2026-08-23T16:00:00Z',
} as ParkIntel;

const offlineStatus = {
  trip_id: 'trip-1',
  maps_cached: true,
  permit_saved: true,
  daily_vehicle_permit_saved: false,
  route_downloaded: true,
  satellite_device_connected: false,
  satellite_device_name: null,
  emergency_contact_ready: false,
  updated_at: '2026-08-23T16:00:00Z',
} as OfflineStatus;

function alert(overrides: Partial<Alert>): Alert {
  return {
    id: 'notice-1',
    trip_id: 'trip-1',
    title: 'Portage closure',
    body: 'The north portage is closed. Use the marked west bypass until repairs are complete.',
    severity: 'warning',
    source: 'Ontario Parks',
    is_active: true,
    created_at: '2026-08-23T12:00:00Z',
    provider: 'ontario-parks',
    external_id: 'closure-1',
    category: 'closure',
    status: 'active',
    source_url: 'https://example.com/notices/closure-1',
    issued_at: null,
    effective_at: null,
    expires_at: null,
    provider_updated_at: null,
    fingerprint: 'a'.repeat(64),
    dismissed_at: null,
    acknowledged_at: null,
    last_seen_at: '2026-08-23T12:00:00Z',
    resolved_at: null,
    updated_at: '2026-08-23T12:00:00Z',
    ...overrides,
  };
}

const data = {
  trip,
  currentWeather: {
    temperature_c: 18.4,
    condition_label: 'Light rain',
    rain_chance: 70,
    wind_kph: 16,
    sunset_time: '8:11 PM',
    icon: 'rain',
    updated_at: '2026-08-23T12:00:00Z',
  },
  astro: {
    moon_phase: 'Waxing gibbous',
    moon_illumination: 74,
    stargazing_notes: 'Best after midnight.',
  },
  alertRefresh: [],
  settings: { show_offline: true, show_astro: true },
} as unknown as DashboardData;

describe('Field view model', () => {
  it('builds a readiness-first brief while preserving canonical source data', () => {
    const manual = alert({ id: 'manual', provider: 'manual', source: 'manual' });
    const dismissed = alert({ id: 'dismissed', dismissed_at: '2026-08-23T13:00:00Z' });
    const system = alert({ id: 'system' });
    const manualPrep = evaluateOfflineCategory(offlineStatus, true, trip.id);

    const model = createFieldViewModel({
      data,
      trip,
      alerts: [manual, dismissed, system],
      parkIntel: intel,
      offlineStatus,
      manualPrep,
    });

    expect(model.notices.map((notice) => notice.alert.id)).toEqual(['system', 'manual']);
    expect(model.notices[0].summary.length).toBeLessThanOrEqual(148);
    expect(model.notices[0].sourceLabel).toBe('Ontario Parks');
    expect(model.notices[1].sourceLabel).toBe('Manual note');
    expect(model.essentials).toMatchObject({
      fire: 'Partial fire ban after 7 PM',
      water: 'Boil or filter lake water.',
      rangerHref: 'tel:7055550142',
      site: {
        label: 'North Tea — 12',
        location: 'North Tea Lake · Algonquin Park',
        notes: 'Landing is rocky in low water.',
      },
      conditions: {
        temperature: '18°C',
        condition: 'Light rain',
        rainChance: '70% rain',
        wind: '16 km/h wind',
        sunset: 'Sunset 8:11 PM',
      },
    });
    expect(model.reference).toMatchObject({
      wildlife: 'Store food in the bear cache.',
      firewoodPercent: 60,
    });
    expect(model.manualPrep).toBe(manualPrep);
    expect(model.alerts).toEqual([manual, dismissed, system]);
  });

  it('keeps optional sections absent when their source values are absent', () => {
    const model = createFieldViewModel({
      data: {
        ...data,
        currentWeather: null,
        astro: null,
        settings: { ...data.settings, show_astro: false },
      },
      trip: { ...trip, park_name: null, lake_name: null, site_name: null, campsite_label: null },
      alerts: [],
      parkIntel: null,
      offlineStatus: null,
      manualPrep: evaluateOfflineCategory(null, true, trip.id),
    });

    expect(model.essentials.conditions).toBeNull();
    expect(model.essentials.site).toBeNull();
    expect(model.reference.astro).toBeNull();
    expect(model.notices).toEqual([]);
  });

  it('creates telephone links only for contact strings containing a phone number', () => {
    expect(fieldContactHref('Call +1 (705) 555-0142')).toBe('tel:+17055550142');
    expect(fieldContactHref('West Gate ranger station')).toBeNull();
  });
});
