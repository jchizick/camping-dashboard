import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  PrepFeedItemRow,
  TimelineEventRow,
  TripRow,
  WeatherCurrentRow,
} from '@/types/database';
import {
  parsePrepFeedItem,
  toPrepFeedItem,
  toTimelineEvent,
  toTimelineEvents,
  toTripDashboard,
  toTripMemberRole,
  toWeatherCurrent,
} from './dashboardMapper';

const weatherRow: WeatherCurrentRow = {
  trip_id: 'trip-test',
  temperature_c: 18,
  wind_kph: 12,
  humidity: 65,
  rain_chance: 20,
  sunset_time: '20:30',
  sunrise_time: '05:45',
  moonset_time: '02:10',
  visibility: 10000,
  condition_label: 'Partly Cloudy',
  icon: 'partly-cloudy',
  updated_at: '2026-07-26T12:00:00.000Z',
};

const prepFeedRow: PrepFeedItemRow = {
  id: '00000000-0000-4000-8000-000000000001',
  trip_id: 'trip-test',
  image_url: null,
  storage_path: null,
  caption: 'External/no-image items remain valid',
  category: 'Misc',
  uploaded_by: 'QA',
  created_at: '2026-07-26T12:00:00.000Z',
};

const newTripRow: TripRow = {
  id: 'trip-test',
  name: 'New trip',
  park_name: 'Local park',
  lake_name: '',
  site_name: '',
  start_date: '2026-08-10',
  end_date: '2026-08-12',
  launch_point_name: null,
  launch_lat: null,
  launch_lng: null,
  site_lat: 45.5,
  site_lng: -78.4,
  campsite_latitude: 45.5,
  campsite_longitude: -78.4,
  campsite_label: null,
  campsite_source: 'manual_map_selection',
  campsite_osm_id: null,
  country_code: null,
  region_code: null,
  park_alert_provider: null,
  park_alert_external_id: null,
  weather_alert_provider: null,
  weather_alert_region_code: null,
  map_style: 'openstreetmap',
  distance_km: null,
  notes: null,
  theme_mode: 'auto',
  deletion_pending_at: null,
  deletion_token: null,
  created_at: '2026-07-26T12:00:00.000Z',
  updated_at: '2026-07-26T12:00:00.000Z',
};

const timelineRow: TimelineEventRow = {
  id: 'timeline-test',
  trip_id: 'trip-test',
  day_number: 1,
  event_time: '09:00',
  title: 'Legacy event',
  details: '',
  sort_order: 10,
  phase: null,
};

describe('dashboard row transformations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves provider-optional values while validating required weather identity', () => {
    expect(toWeatherCurrent(weatherRow)).toEqual(weatherRow);
    expect(toWeatherCurrent({ ...weatherRow, humidity: null }).humidity).toBeNull();
    expect(() => toWeatherCurrent({ ...weatherRow, temperature_c: null })).toThrow(
      'weather_current.temperature_c is unexpectedly null'
    );
  });

  it('keeps nullable legacy trip fields valid in a newly created dashboard', () => {
    expect(toTripDashboard(newTripRow)).toEqual(newTripRow);
    expect(() => toTripDashboard({ ...newTripRow, start_date: null })).toThrow(
      'trips.start_date is unexpectedly null'
    );
  });

  it('narrows generated strings after checking database constraints', () => {
    expect(toTripMemberRole('editor')).toBe('editor');
    expect(() => toTripMemberRole('administrator')).toThrow(
      'trip_members.role has unsupported value'
    );
  });

  it('preserves nullable prep-feed image fields while narrowing category', () => {
    expect(toPrepFeedItem(prepFeedRow)).toEqual(prepFeedRow);
    expect(parsePrepFeedItem(prepFeedRow)).toEqual(prepFeedRow);
    expect(() => parsePrepFeedItem({ ...prepFeedRow, category: 'Unknown' })).toThrow(
      'prep_feed_items.category has unsupported value'
    );
  });

  it('preserves a null timeline phase as an uncategorized event', () => {
    expect(toTimelineEvent(timelineRow)).toEqual(timelineRow);
  });

  it('omits one malformed timeline event without rejecting valid rows', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const malformed = { ...timelineRow, id: 'timeline-invalid', phase: 'Unknown' };

    expect(toTimelineEvents([malformed, timelineRow])).toEqual([timelineRow]);
    expect(warning).toHaveBeenCalledWith(
      '[dashboardMapper] Omitting a malformed timeline event.'
    );
  });

  it('rejects malformed prep-feed API transport data', () => {
    expect(() => parsePrepFeedItem({ ...prepFeedRow, storage_path: 42 })).toThrow(
      'prep-feed API returned an invalid item'
    );
  });
});
