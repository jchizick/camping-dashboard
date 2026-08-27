import 'fake-indexeddb/auto';

import { deleteDB, openDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardData, GearItem, Meal, OfflineStatus } from '@/types';
import { evaluateReadiness } from './readiness';
import { getTripDuration } from './tripDuration';
import {
  ACTIVE_TRIP_STORE_NAME,
  OFFLINE_IDENTITY_STORE_NAME,
  createIndexedDbActiveTripCache,
} from './activeTripCache';
import {
  ACTIVE_TRIP_SNAPSHOT_SCHEMA_VERSION,
  createActiveTripSnapshot,
} from './activeTripSnapshot';
import { createTripRepository } from './tripRepository';
import { createWorkspaceSourceStatus } from './workspaceSources';

vi.mock('./fetchDashboard', () => ({
  fetchDashboardDataWithStatus: vi.fn(),
}));
vi.mock('./env', () => ({
  requiredEnvironmentVariable: () => 'https://test.supabase.co',
}));

const databases = new Set<string>();
let databaseSequence = 0;

function databaseName(label: string) {
  const name = `field-protocol-test-${label}-${databaseSequence++}`;
  databases.add(name);
  return name;
}

afterEach(async () => {
  for (const name of databases) await deleteDB(name);
  databases.clear();
});

function gear(overrides: Partial<GearItem> = {}): GearItem {
  return {
    id: 'gear-1',
    trip_id: 'trip-1',
    name: 'Tent',
    category: 'Shelter',
    acquired: true,
    packed: true,
    owner: null,
    priority: 'critical',
    notes: '',
    weight_kg: 2,
    responsible_crew_member_id: null,
    ...overrides,
  } as GearItem;
}

function meal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 'meal-1',
    trip_id: 'trip-1',
    day_number: 1,
    meal_type: 'breakfast',
    title: 'Oatmeal',
    prep_type: 'dehydrated',
    calories: 500,
    assigned_to: null,
    prep_crew_member_id: null,
    notes: '',
    ...overrides,
  } as Meal;
}

function offline(overrides: Partial<OfflineStatus> = {}): OfflineStatus {
  return {
    trip_id: 'trip-1',
    maps_cached: true,
    permit_saved: true,
    daily_vehicle_permit_saved: true,
    route_downloaded: true,
    satellite_device_connected: true,
    satellite_device_name: 'inReach',
    emergency_contact_ready: true,
    updated_at: '2026-08-24T12:00:00.000Z',
    ...overrides,
  } as OfflineStatus;
}

function dashboard(
  tripId = 'trip-1',
  overrides: Partial<DashboardData> = {}
): DashboardData {
  const retarget = <T extends { trip_id: string }>(rows: T[]) =>
    rows.map((row) => ({ ...row, trip_id: tripId }));
  const defaultGear = retarget([gear()]);
  return {
    trip: {
      id: tripId,
      name: `Trip ${tripId}`,
      start_date: '2026-08-24',
      end_date: '2026-08-24',
      map_style: null,
      theme_mode: null,
    },
    currentWeather: null,
    forecast: [],
    weatherRefresh: null,
    gear: defaultGear,
    timeline: [],
    meals: [],
    crew: [],
    parkIntel: null,
    offlineStatus: null,
    astro: null,
    alerts: [],
    alertRefresh: [],
    prepFeed: [],
    settings: {
      trip_id: tripId,
      manual_theme_override: 'auto',
      preferred_units: 'metric',
      show_astro: true,
      show_crew: true,
      show_meals: false,
      show_offline: false,
      theme_variant: 'expedition',
    },
    ...overrides,
  } as DashboardData;
}

function remote(data: DashboardData, complete = true) {
  return {
    data,
    sourceStatus: createWorkspaceSourceStatus(
      complete ? 'complete' : 'failed'
    ),
  };
}

function repositoryHarness(
  name: string,
  loadRemoteTrip: (tripId: string) => Promise<ReturnType<typeof remote>>,
  projectNamespace = 'https://project-a.supabase.co',
  now = '2026-08-24T12:00:00.000Z'
) {
  const cache = createIndexedDbActiveTripCache(name);
  const repository = createTripRepository({
    projectNamespace,
    cache,
    loadRemoteTrip,
    now: () => now,
    createRevision: () => 'revision-1',
    logCacheError: vi.fn(),
  });
  return { cache, repository };
}

function readiness(data: DashboardData) {
  const duration = getTripDuration(data.trip.start_date, data.trip.end_date);
  return evaluateReadiness({
    tripId: data.trip.id,
    tripDays: duration?.days ?? 0,
    gear: data.gear,
    meals: data.meals,
    timeline: data.timeline,
    currentWeather: data.currentWeather,
    forecast: data.forecast,
    offlineStatus: data.offlineStatus,
    modules: {
      mealsEnabled: data.settings.show_meals,
      offlineEnabled: data.settings.show_offline,
    },
    alerts: data.alerts,
  });
}

describe('TripRepository IndexedDB foundation', () => {
  it('creates, writes, reads, and atomically replaces one active trip per user', async () => {
    const name = databaseName('lifecycle');
    let activeTripId = 'trip-1';
    const { cache, repository } = repositoryHarness(name, async () =>
      remote(dashboard(activeTripId))
    );

    const online = await repository.loadOnlineTrip({
      tripId: 'trip-1',
      userId: 'user-a',
      verifiedRole: 'owner',
    });
    expect(online.cacheWriteOutcome).toBe('stored');
    const db = await openDB(name);
    expect(db.version).toBe(2);
    expect(db.objectStoreNames.contains(ACTIVE_TRIP_STORE_NAME)).toBe(true);
    expect(db.objectStoreNames.contains(OFFLINE_IDENTITY_STORE_NAME)).toBe(true);
    db.close();
    const firstCached = await repository.readCachedTrip({ userId: 'user-a' });
    expect(firstCached).toMatchObject({
      source: 'cache',
      data: { trip: { id: 'trip-1' } },
      verifiedRole: 'owner',
      snapshotRevision: 'revision-1',
    });
    expect(
      new TextEncoder().encode(JSON.stringify(firstCached)).byteLength
    ).toBeLessThan(100_000);

    activeTripId = 'trip-2';
    await repository.loadOnlineTrip({
      tripId: 'trip-2',
      userId: 'user-a',
      verifiedRole: 'editor',
    });
    expect(await repository.readCachedTrip({ userId: 'user-a' })).toMatchObject({
      data: { trip: { id: 'trip-2' } },
      verifiedRole: 'editor',
    });
    await repository.clearCachedTrip({ userId: 'user-a', tripId: 'trip-1' });
    expect(await repository.readCachedTrip({ userId: 'user-a' })).not.toBeNull();
    await repository.clearCachedTrip({ userId: 'user-a', tripId: 'trip-2' });
    expect(await repository.readCachedTrip({ userId: 'user-a' })).toBeNull();
    await cache.close();
  });

  it('keeps users and Supabase deployments isolated and clears only the current account', async () => {
    const name = databaseName('isolation');
    const first = repositoryHarness(name, async () => remote(dashboard()));
    await first.repository.loadOnlineTrip({
      tripId: 'trip-1',
      userId: 'user-a',
      verifiedRole: 'owner',
    });
    await first.repository.loadOnlineTrip({
      tripId: 'trip-1',
      userId: 'user-b',
      verifiedRole: 'viewer',
    });
    expect(await first.repository.readCachedTrip({ userId: 'user-b' })).not.toBeNull();
    expect(await first.repository.readOfflineTrip()).toMatchObject({
      status: 'available',
      identity: { activeUserId: 'user-b' },
    });

    const otherProject = repositoryHarness(
      name,
      async () => remote(dashboard()),
      'https://project-b.supabase.co'
    );
    expect(
      await otherProject.repository.readCachedTrip({ userId: 'user-a' })
    ).toBeNull();

    await first.repository.clearUserCache({ userId: 'user-a' });
    expect(await first.repository.readCachedTrip({ userId: 'user-a' })).toBeNull();
    expect(await first.repository.readCachedTrip({ userId: 'user-b' })).not.toBeNull();
    await first.cache.close();
    await otherProject.cache.close();
  });

  it('does not replace a valid snapshot after an incomplete trip switch or failed refresh', async () => {
    const name = databaseName('preserve');
    let load = remote(dashboard('trip-1'));
    let failure: Error | null = null;
    const { cache, repository } = repositoryHarness(name, async () => {
      if (failure) throw failure;
      return load;
    });
    await repository.loadOnlineTrip({
      tripId: 'trip-1',
      userId: 'user-a',
      verifiedRole: 'owner',
    });

    load = remote(dashboard('trip-2'), false);
    const incomplete = await repository.loadOnlineTrip({
      tripId: 'trip-2',
      userId: 'user-a',
      verifiedRole: 'owner',
    });
    expect(incomplete.cacheWriteOutcome).toBe('skipped-incomplete');
    expect((await repository.readCachedTrip({ userId: 'user-a' }))?.data.trip.id).toBe(
      'trip-1'
    );

    failure = new Error('network failed');
    await expect(
      repository.loadOnlineTrip({
        tripId: 'trip-2',
        userId: 'user-a',
        verifiedRole: 'owner',
      })
    ).rejects.toThrow('network failed');
    expect((await repository.readCachedTrip({ userId: 'user-a' }))?.data.trip.id).toBe(
      'trip-1'
    );

    failure = null;
    load = remote(dashboard('trip-2'));
    await repository.loadOnlineTrip({
      tripId: 'trip-2',
      userId: 'user-a',
      verifiedRole: 'owner',
    });
    expect((await repository.readCachedTrip({ userId: 'user-a' }))?.data.trip.id).toBe(
      'trip-2'
    );
    await cache.close();
  });

  it('keeps online loading usable when IndexedDB writes fail', async () => {
    const cache = {
      readActiveTrip: vi.fn(),
      replaceActiveTrip: vi.fn().mockRejectedValue(new Error('quota exceeded')),
      clearCachedTrip: vi.fn(),
      clearUserCache: vi.fn(),
      readOfflineIdentity: vi.fn(),
      markShellPrepared: vi.fn(),
      clearOfflineIdentity: vi.fn(),
    };
    const logCacheError = vi.fn();
    const repository = createTripRepository({
      projectNamespace: 'https://project-a.supabase.co',
      cache,
      loadRemoteTrip: async () => remote(dashboard()),
      now: () => '2026-08-24T12:00:00.000Z',
      createRevision: () => 'revision-1',
      logCacheError,
    });

    const result = await repository.loadOnlineTrip({
      tripId: 'trip-1',
      userId: 'user-a',
      verifiedRole: 'owner',
    });

    expect(result.source).toBe('online');
    expect(result.data.trip.id).toBe('trip-1');
    expect(result.cacheWriteOutcome).toBe('failed');
    expect(logCacheError).toHaveBeenCalledOnce();
  });

  it('requires shell preparation and enforces the centralized offline access window', async () => {
    const name = databaseName('policy');
    const first = repositoryHarness(name, async () => remote(dashboard()));
    await first.repository.loadOnlineTrip({
      tripId: 'trip-1',
      userId: 'user-a',
      verifiedRole: 'owner',
    });
    expect(
      await first.repository.readOfflineTrip({
        tripId: 'trip-1',
        requirePreparedShell: true,
      })
    ).toMatchObject({ status: 'shell-not-prepared' });
    expect(await first.repository.markShellPrepared({ userId: 'user-a' })).toBe(true);
    expect(
      await first.repository.readOfflineTrip({
        tripId: 'trip-1',
        requirePreparedShell: true,
      })
    ).toMatchObject({ status: 'available' });

    for (const [currentTime, expectedStatus] of [
      ['2026-09-22T12:00:00.000Z', 'available'],
      ['2026-09-23T12:00:00.000Z', 'available'],
      ['2026-09-23T12:00:00.001Z', 'expired'],
    ] as const) {
      const boundary = repositoryHarness(
        name,
        async () => remote(dashboard()),
        'https://project-a.supabase.co',
        currentTime
      );
      expect(
        await boundary.repository.readOfflineTrip({ tripId: 'trip-1' })
      ).toMatchObject({ status: expectedStatus });
      await boundary.cache.close();
    }

    const expired = repositoryHarness(
      name,
      async () => remote(dashboard()),
      'https://project-a.supabase.co',
      '2026-09-24T12:00:00.001Z'
    );
    expect(await expired.repository.readOfflineTrip({ tripId: 'trip-1' })).toMatchObject({
      status: 'expired',
    });
    await first.cache.close();
    await expired.cache.close();
  });

  it('rejects offline access when the device clock moves behind the last verification', async () => {
    const name = databaseName('clock-rollback');
    const online = repositoryHarness(name, async () => remote(dashboard()));
    await online.repository.loadOnlineTrip({
      tripId: 'trip-1',
      userId: 'user-a',
      verifiedRole: 'owner',
    });

    const rolledBack = repositoryHarness(
      name,
      async () => remote(dashboard()),
      'https://project-a.supabase.co',
      '2026-08-23T12:00:00.000Z'
    );

    expect(
      await rolledBack.repository.readOfflineTrip({ tripId: 'trip-1' })
    ).toMatchObject({ status: 'expired' });
    await online.cache.close();
    await rolledBack.cache.close();
  });

  it('upgrades a Phase 1 database without dropping its valid active snapshot', async () => {
    const name = databaseName('v1-upgrade');
    const valid = createActiveTripSnapshot({
      projectNamespace: 'https://project-a.supabase.co',
      userId: 'user-a',
      tripId: 'trip-1',
      verifiedRole: 'owner',
      cachedAt: '2026-08-24T12:00:00.000Z',
      lastOnlineVerifiedAt: '2026-08-24T12:00:00.000Z',
      snapshotRevision: 'revision-v1',
      sourceStatus: createWorkspaceSourceStatus('complete'),
      data: dashboard(),
    });
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore(ACTIVE_TRIP_STORE_NAME, { keyPath: 'cacheKey' });
      },
    });
    await v1.put(ACTIVE_TRIP_STORE_NAME, {
      cacheKey: JSON.stringify(['https://project-a.supabase.co', 'user-a']),
      snapshot: valid,
    });
    v1.close();

    const cache = createIndexedDbActiveTripCache(name);
    expect(
      await cache.readActiveTrip({
        projectNamespace: 'https://project-a.supabase.co',
        userId: 'user-a',
      })
    ).toMatchObject({ snapshotRevision: 'revision-v1' });
    const upgraded = await openDB(name);
    expect(upgraded.version).toBe(2);
    expect(upgraded.objectStoreNames.contains(OFFLINE_IDENTITY_STORE_NAME)).toBe(true);
    upgraded.close();
    await cache.close();
  });

  it.each([
    ['unsupported schema', (snapshot: Record<string, unknown>) => ({ ...snapshot, schemaVersion: 99 })],
    ['missing metadata', (snapshot: Record<string, unknown>) => {
      const rest = { ...snapshot };
      Reflect.deleteProperty(rest, 'userId');
      return rest;
    }],
    ['partial source status', (snapshot: Record<string, unknown>) => ({
      ...snapshot,
      sourceStatus: {
        ...(snapshot.sourceStatus as Record<string, string>),
        gear: 'failed',
      },
    })],
    ['wrong namespace', (snapshot: Record<string, unknown>) => ({
      ...snapshot,
      projectNamespace: 'https://other.supabase.co',
    })],
    ['wrong user', (snapshot: Record<string, unknown>) => ({
      ...snapshot,
      userId: 'user-b',
    })],
    ['malformed payload', (snapshot: Record<string, unknown>) => ({
      ...snapshot,
      data: {
        ...(snapshot.data as Record<string, unknown>),
        gear: 'not-an-array',
      },
    })],
  ])('rejects and removes a corrupt cache entry: %s', async (_label, corrupt) => {
    const name = databaseName('corrupt');
    const cache = createIndexedDbActiveTripCache(name);
    const valid = createActiveTripSnapshot({
      projectNamespace: 'https://project-a.supabase.co',
      userId: 'user-a',
      tripId: 'trip-1',
      verifiedRole: 'owner',
      cachedAt: '2026-08-24T12:00:00.000Z',
      lastOnlineVerifiedAt: '2026-08-24T12:00:00.000Z',
      snapshotRevision: 'revision-1',
      sourceStatus: createWorkspaceSourceStatus('complete'),
      data: dashboard(),
    });
    await cache.readActiveTrip({
      projectNamespace: 'https://project-a.supabase.co',
      userId: 'user-a',
    });
    const db = await openDB(name);
    const cacheKey = JSON.stringify(['https://project-a.supabase.co', 'user-a']);
    await db.put(ACTIVE_TRIP_STORE_NAME, {
      cacheKey,
      snapshot: corrupt(valid as unknown as Record<string, unknown>),
    });
    db.close();

    expect(
      await cache.readActiveTrip({
        projectNamespace: 'https://project-a.supabase.co',
        userId: 'user-a',
      })
    ).toBeNull();
    await cache.close();
  });
});

const readinessCases: Array<[string, Partial<DashboardData>]> = [
  ['ready critical gear', { gear: [gear()] }],
  ['missing required gear', { gear: [gear({ acquired: false, packed: false })] }],
  ['acquired but unpacked gear', { gear: [gear({ packed: false })] }],
  ['no critical gear', { gear: [gear({ priority: 'high' })] }],
  [
    'meals enabled',
    {
      meals: [
        meal({ id: 'breakfast', meal_type: 'breakfast' }),
        meal({ id: 'lunch', meal_type: 'lunch' }),
        meal({ id: 'dinner', meal_type: 'dinner' }),
      ],
      settings: dashboard().settings,
    },
  ],
  ['meals disabled', { meals: [] }],
  ['manual prep complete', { offlineStatus: offline() }],
  ['manual prep partial', { offlineStatus: offline({ maps_cached: false }) }],
  ['manual prep unavailable', { offlineStatus: null }],
];

describe('cached readiness semantics', () => {
  it.each(readinessCases)('preserves canonical readiness for %s', async (_label, changes) => {
    const name = databaseName('readiness');
    const base = dashboard();
    const data = dashboard('trip-1', {
      ...changes,
      settings: {
        ...base.settings,
        ...(changes.settings ?? {}),
        show_meals: _label === 'meals enabled',
        show_offline: _label.startsWith('manual prep'),
      },
    });
    const expected = readiness(data);
    const { cache, repository } = repositoryHarness(name, async () => remote(data));
    await repository.loadOnlineTrip({
      tripId: 'trip-1',
      userId: `user-${databaseSequence}`,
      verifiedRole: 'viewer',
    });
    const cached = await repository.readCachedTrip({
      userId: `user-${databaseSequence}`,
    });

    expect(cached).not.toBeNull();
    expect(readiness(cached!.data)).toEqual(expected);
    expect(ACTIVE_TRIP_SNAPSHOT_SCHEMA_VERSION).toBe(1);
    await cache.close();
  });
});
