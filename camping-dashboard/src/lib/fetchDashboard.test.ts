import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
  status?: number;
};

const mocks = vi.hoisted(() => ({
  results: new Map<string, QueryResult>(),
  malformedAlert: false,
  getUser: vi.fn(),
}));

function queryFor(table: string) {
  const result = () =>
    mocks.results.get(table) ?? {
      data: null,
      error: { message: `Missing mocked result for ${table}` },
    };
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    single: () => Promise.resolve(result()),
    maybeSingle: () => Promise.resolve(result()),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve(result()).then(resolve, reject),
  };
  return query;
}

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: (table: string) => queryFor(table),
  },
}));

vi.mock('./dashboardMapper', () => ({
  toAlert: (value: unknown) => {
    if (mocks.malformedAlert) throw new Error('malformed alert');
    return value;
  },
  toAlertRefreshState: (value: unknown) => value,
  toAstroData: (value: unknown) => value,
  toCrewMember: (value: unknown) => value,
  toGearItem: (value: unknown) => value,
  toMeal: (value: unknown) => value,
  toOfflineStatus: (value: unknown) => value,
  toParkIntel: (value: unknown) => value,
  toPrepFeedItem: (value: unknown) => value,
  toSettings: (value: unknown) => value,
  toTimelineEvent: (value: unknown) => value,
  toTripDashboard: (value: unknown) => value,
  toTripMemberRole: (value: unknown) => value,
  toWeatherCurrent: (value: unknown) => value,
  toWeatherForecast: (value: unknown) => value,
  toWeatherRefreshState: (value: unknown) => value,
}));

import {
  fetchDashboardDataWithStatus,
  fetchUserTrips,
} from './fetchDashboard';

const collectionTables = [
  'weather_forecast',
  'gear_items',
  'timeline_events',
  'meals',
  'crew_members',
  'alerts',
  'alert_refresh_state',
  'prep_feed_items',
];
const optionalSingletonTables = [
  'weather_current',
  'weather_refresh_state',
  'park_intel',
  'offline_status',
  'astro_data',
];

beforeEach(() => {
  mocks.results.clear();
  mocks.getUser.mockReset();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });
  mocks.results.set('trips', { data: { id: 'trip-1' }, error: null });
  mocks.results.set('settings', {
    data: { trip_id: 'trip-1' },
    error: null,
  });
  for (const table of collectionTables) {
    mocks.results.set(table, { data: [], error: null });
  }
  for (const table of optionalSingletonTables) {
    mocks.results.set(table, { data: null, error: null });
  }
  mocks.malformedAlert = false;
});

describe('fetchUserTrips', () => {
  it('returns an empty list only when the trip source succeeds with no rows', async () => {
    mocks.results.set('trip_members', { data: [], error: null, status: 200 });

    await expect(fetchUserTrips()).resolves.toEqual([]);
  });

  it('classifies unavailable and forbidden trip-list sources instead of returning empty', async () => {
    mocks.results.set('trip_members', {
      data: null,
      error: { message: 'Service unavailable' },
      status: 503,
    });

    await expect(fetchUserTrips()).rejects.toMatchObject({
      name: 'UserTripsFetchError',
      kind: 'unavailable',
    });

    mocks.results.set('trip_members', {
      data: null,
      error: { message: 'Permission denied' },
      status: 403,
    });

    await expect(fetchUserTrips()).rejects.toMatchObject({
      name: 'UserTripsFetchError',
      kind: 'forbidden',
    });
  });

  it('classifies an explicit anonymous result as unauthenticated', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(fetchUserTrips()).rejects.toMatchObject({
      name: 'UserTripsFetchError',
      kind: 'unauthenticated',
    });

    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token', status: 401 },
    });

    await expect(fetchUserTrips()).rejects.toMatchObject({
      name: 'UserTripsFetchError',
      kind: 'unauthenticated',
    });
  });
});

describe('fetchDashboardDataWithStatus', () => {
  it('distinguishes a successful empty collection from a failed collection', async () => {
    const successfulEmpty = await fetchDashboardDataWithStatus('trip-1');
    expect(successfulEmpty.data.gear).toEqual([]);
    expect(successfulEmpty.sourceStatus.gear).toBe('complete');

    mocks.results.set('gear_items', {
      data: null,
      error: { message: 'permission denied' },
    });
    const failed = await fetchDashboardDataWithStatus('trip-1');
    expect(failed.data.gear).toEqual([]);
    expect(failed.sourceStatus.gear).toBe('failed');
  });

  it('marks a collection incomplete when a malformed row is omitted', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.results.set('alerts', {
      data: [{ id: 'alert-1', trip_id: 'trip-1' }],
      error: null,
    });
    mocks.malformedAlert = true;

    const result = await fetchDashboardDataWithStatus('trip-1');

    expect(result.data.alerts).toEqual([]);
    expect(result.sourceStatus.alerts).toBe('failed');
  });
});
