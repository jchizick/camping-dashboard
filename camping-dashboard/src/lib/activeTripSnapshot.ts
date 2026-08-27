import type {
  AlertRefreshStateRow,
  AlertRow,
  AstroDataRow,
  CrewMemberRow,
  GearItemRow,
  MealRow,
  OfflineStatusRow,
  ParkIntelRow,
  PrepFeedItemRow,
  SettingsRow,
  TimelineEventRow,
  TripRow,
  WeatherCurrentRow,
  WeatherForecastRow,
  WeatherRefreshStateRow,
} from '@/types/database';
import type { DashboardData, TripMemberRole } from '@/types';
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
  toWeatherCurrent,
  toWeatherForecast,
  toWeatherRefreshState,
} from './dashboardMapper';
import {
  WORKSPACE_SOURCE_KEYS,
  hasCompleteWorkspaceSources,
  type WorkspaceSourceStatus,
} from './workspaceSources';

export const ACTIVE_TRIP_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export interface ActiveTripSnapshot {
  schemaVersion: typeof ACTIVE_TRIP_SNAPSHOT_SCHEMA_VERSION;
  projectNamespace: string;
  userId: string;
  tripId: string;
  cachedAt: string;
  lastOnlineVerifiedAt: string;
  verifiedRole: TripMemberRole;
  snapshotRevision: string;
  sourceStatus: WorkspaceSourceStatus;
  data: DashboardData;
}

export interface CreateActiveTripSnapshotInput {
  projectNamespace: string;
  userId: string;
  tripId: string;
  verifiedRole: TripMemberRole;
  lastOnlineVerifiedAt: string;
  cachedAt: string;
  snapshotRevision: string;
  sourceStatus: WorkspaceSourceStatus;
  data: DashboardData;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isIsoDate(value: unknown): value is string {
  return (
    isNonEmptyString(value) && Number.isFinite(new Date(value).getTime())
  );
}

function isRole(value: unknown): value is TripMemberRole {
  return value === 'owner' || value === 'editor' || value === 'viewer';
}

function readSourceStatus(value: unknown): WorkspaceSourceStatus | null {
  if (!isRecord(value)) return null;
  const status = {} as WorkspaceSourceStatus;
  for (const key of WORKSPACE_SOURCE_KEYS) {
    const state = value[key];
    if (state !== 'complete' && state !== 'failed') return null;
    status[key] = state;
  }
  return status;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Invalid cached ${label}.`);
  return value;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid cached ${label}.`);
  return value;
}

function requireTripScope(
  rows: readonly unknown[],
  tripId: string,
  label: string
) {
  for (const row of rows) {
    if (!isRecord(row) || row.trip_id !== tripId) {
      throw new Error(`Cached ${label} escaped the trip namespace.`);
    }
  }
}

function validateDashboardData(value: unknown, tripId: string): DashboardData {
  const data = requireRecord(value, 'workspace data');
  const tripRecord = requireRecord(data.trip, 'trip');
  const settingsRecord = requireRecord(data.settings, 'settings');
  const forecastRecords = requireArray(data.forecast, 'forecast');
  const gearRecords = requireArray(data.gear, 'gear');
  const timelineRecords = requireArray(data.timeline, 'timeline');
  const mealRecords = requireArray(data.meals, 'meals');
  const crewRecords = requireArray(data.crew, 'crew');
  const alertRecords = requireArray(data.alerts, 'alerts');
  const prepFeedRecords = requireArray(data.prepFeed, 'prep feed');
  const alertRefreshRecords =
    data.alertRefresh === null
      ? null
      : requireArray(data.alertRefresh, 'alert refresh state');

  if (tripRecord.id !== tripId || settingsRecord.trip_id !== tripId) {
    throw new Error('Cached workspace identity does not match its trip.');
  }

  requireTripScope(forecastRecords, tripId, 'forecast');
  requireTripScope(gearRecords, tripId, 'gear');
  requireTripScope(timelineRecords, tripId, 'timeline');
  requireTripScope(mealRecords, tripId, 'meals');
  requireTripScope(crewRecords, tripId, 'crew');
  requireTripScope(alertRecords, tripId, 'alerts');
  requireTripScope(prepFeedRecords, tripId, 'prep feed');
  if (alertRefreshRecords) {
    requireTripScope(alertRefreshRecords, tripId, 'alert refresh state');
  }

  for (const [label, singleton] of [
    ['current weather', data.currentWeather],
    ['weather refresh state', data.weatherRefresh],
    ['park intelligence', data.parkIntel],
    ['Field Prep', data.offlineStatus],
    ['astronomy', data.astro],
  ] as const) {
    if (
      singleton !== null &&
      (!isRecord(singleton) || singleton.trip_id !== tripId)
    ) {
      throw new Error(`Cached ${label} does not match its trip.`);
    }
  }

  return {
    trip: toTripDashboard(tripRecord as unknown as TripRow),
    currentWeather:
      data.currentWeather === null
        ? null
        : toWeatherCurrent(data.currentWeather as unknown as WeatherCurrentRow),
    forecast: forecastRecords.map((row) =>
      toWeatherForecast(row as WeatherForecastRow)
    ),
    weatherRefresh:
      data.weatherRefresh === null
        ? null
        : toWeatherRefreshState(
            data.weatherRefresh as unknown as WeatherRefreshStateRow
          ),
    gear: gearRecords.map((row) => toGearItem(row as GearItemRow)),
    timeline: timelineRecords.map((row) =>
      toTimelineEvent(row as TimelineEventRow)
    ),
    meals: mealRecords.map((row) => toMeal(row as MealRow)),
    crew: crewRecords.map((row) => toCrewMember(row as CrewMemberRow)),
    parkIntel:
      data.parkIntel === null
        ? null
        : toParkIntel(data.parkIntel as unknown as ParkIntelRow),
    offlineStatus:
      data.offlineStatus === null
        ? null
        : toOfflineStatus(data.offlineStatus as unknown as OfflineStatusRow),
    astro:
      data.astro === null
        ? null
        : toAstroData(data.astro as unknown as AstroDataRow),
    alerts: alertRecords.map((row) => toAlert(row as AlertRow)),
    alertRefresh:
      alertRefreshRecords === null
        ? null
        : alertRefreshRecords.map((row) =>
            toAlertRefreshState(row as AlertRefreshStateRow)
          ),
    prepFeed: prepFeedRecords.map((row) =>
      toPrepFeedItem(row as PrepFeedItemRow)
    ),
    settings: toSettings(settingsRecord as unknown as SettingsRow),
  };
}

export function validateActiveTripSnapshot(
  value: unknown
): ActiveTripSnapshot | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== ACTIVE_TRIP_SNAPSHOT_SCHEMA_VERSION) return null;
  if (
    !isNonEmptyString(value.projectNamespace) ||
    !isNonEmptyString(value.userId) ||
    !isNonEmptyString(value.tripId) ||
    !isIsoDate(value.cachedAt) ||
    !isIsoDate(value.lastOnlineVerifiedAt) ||
    !isRole(value.verifiedRole) ||
    !isNonEmptyString(value.snapshotRevision)
  ) {
    return null;
  }

  const sourceStatus = readSourceStatus(value.sourceStatus);
  if (!sourceStatus || !hasCompleteWorkspaceSources(sourceStatus)) return null;

  try {
    return {
      schemaVersion: ACTIVE_TRIP_SNAPSHOT_SCHEMA_VERSION,
      projectNamespace: value.projectNamespace,
      userId: value.userId,
      tripId: value.tripId,
      cachedAt: value.cachedAt,
      lastOnlineVerifiedAt: value.lastOnlineVerifiedAt,
      verifiedRole: value.verifiedRole,
      snapshotRevision: value.snapshotRevision,
      sourceStatus,
      data: validateDashboardData(value.data, value.tripId),
    };
  } catch {
    return null;
  }
}

export function createActiveTripSnapshot(
  input: CreateActiveTripSnapshotInput
): ActiveTripSnapshot {
  const snapshot: ActiveTripSnapshot = {
    schemaVersion: ACTIVE_TRIP_SNAPSHOT_SCHEMA_VERSION,
    ...input,
  };
  const validated = validateActiveTripSnapshot(snapshot);
  if (!validated) {
    throw new Error('The remote workspace is not a complete cacheable snapshot.');
  }
  return validated;
}
