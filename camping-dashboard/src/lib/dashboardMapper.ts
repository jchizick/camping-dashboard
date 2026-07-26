import type {
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
} from '@/types/database';
import type {
  Alert,
  AstroData,
  CrewMember,
  GearItem,
  Meal,
  OfflineStatus,
  ParkIntel,
  PrepFeedItem,
  Settings,
  TimelineEvent,
  TimelinePhase,
  TripDashboard,
  TripMemberRole,
  WeatherCurrent,
  WeatherForecast,
} from '@/types';

function requireColumns<T, K extends keyof T>(
  row: T,
  table: string,
  keys: readonly K[]
): asserts row is T & { [P in K]-?: NonNullable<T[P]> } {
  for (const key of keys) {
    if (row[key] === null || row[key] === undefined) {
      throw new Error(`[dashboardMapper] ${table}.${String(key)} is unexpectedly null.`);
    }
  }
}

function checkedValue<T extends string>(
  value: string,
  values: readonly T[],
  field: string
): T {
  if (!values.some((candidate) => candidate === value)) {
    throw new Error(`[dashboardMapper] ${field} has unsupported value "${value}".`);
  }
  return value as T;
}

export function toTripDashboard(row: TripRow): TripDashboard {
  requireColumns(row, 'trips', [
    'end_date',
    'start_date',
  ]);
  const themeMode = row.theme_mode === null
    ? null
    : checkedValue(row.theme_mode, ['auto', 'day', 'night'], 'trips.theme_mode');
  const mapStyle = row.map_style === null
    ? null
    : checkedValue(row.map_style, ['openstreetmap', 'expedition'], 'trips.map_style');
  return { ...row, map_style: mapStyle, theme_mode: themeMode };
}

export function toTripMemberRole(value: string): TripMemberRole {
  return checkedValue(value, ['owner', 'editor', 'viewer'], 'trip_members.role');
}

export function toWeatherCurrent(row: WeatherCurrentRow): WeatherCurrent {
  requireColumns(row, 'weather_current', [
    'condition_label', 'humidity', 'icon', 'moonset_time', 'rain_chance',
    'sunrise_time', 'sunset_time', 'temperature_c', 'updated_at', 'visibility', 'wind_kph',
  ]);
  return row;
}

export function toWeatherForecast(row: WeatherForecastRow): WeatherForecast {
  requireColumns(row, 'weather_forecast', [
    'condition_label', 'high_c', 'icon', 'low_c', 'rain_chance', 'wind_kph',
  ]);
  return row;
}

export function toGearItem(row: GearItemRow): GearItem {
  requireColumns(row, 'gear_items', [
    'category', 'notes', 'owner', 'packed', 'priority', 'trip_id', 'weight_kg',
  ]);
  return {
    ...row,
    priority: checkedValue(row.priority, ['critical', 'high', 'low'], 'gear_items.priority'),
  };
}

export function toTimelineEvent(row: TimelineEventRow): TimelineEvent {
  requireColumns(row, 'timeline_events', [
    'day_number', 'details', 'event_time', 'sort_order', 'title', 'trip_id',
  ]);
  return {
    ...row,
    phase: row.phase === null
      ? null
      : checkedValue<TimelinePhase>(
          row.phase,
          ['Transit', 'Setup', 'Sustain', 'Leisure', 'None'],
          'timeline_events.phase'
        ),
  };
}

export function toTimelineEvents(rows: TimelineEventRow[]): TimelineEvent[] {
  return rows.flatMap((row) => {
    try {
      return [toTimelineEvent(row)];
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[dashboardMapper] Omitting a malformed timeline event.');
      }
      return [];
    }
  });
}

export function toMeal(row: MealRow): Meal {
  requireColumns(row, 'meals', [
    'assigned_to', 'calories', 'day_number', 'meal_type', 'notes', 'prep_type', 'title', 'trip_id',
  ]);
  return {
    ...row,
    meal_type: checkedValue(
      row.meal_type,
      ['breakfast', 'lunch', 'dinner', 'snack'],
      'meals.meal_type'
    ),
    prep_type: checkedValue(
      row.prep_type,
      ['dehydrated', 'fresh', 'fire', 'restaurant'],
      'meals.prep_type'
    ),
  };
}

export function toCrewMember(row: CrewMemberRow): CrewMember {
  requireColumns(row, 'crew_members', [
    'canoe_number', 'load_item', 'load_weight_kg', 'notes', 'role', 'trip_id',
  ]);
  return row;
}

export function toParkIntel(row: ParkIntelRow): ParkIntel {
  requireColumns(row, 'park_intel', [
    'custom_notes', 'fire_restriction', 'firewood_percent', 'ranger_station',
    'updated_at', 'water_notes', 'wildlife_notes',
  ]);
  return row;
}

export function toOfflineStatus(row: OfflineStatusRow): OfflineStatus {
  requireColumns(row, 'offline_status', [
    'daily_vehicle_permit_saved', 'emergency_contact_ready', 'maps_cached',
    'permit_saved', 'route_downloaded', 'satellite_device_connected',
    'satellite_device_name', 'updated_at',
  ]);
  return row;
}

export function toAstroData(row: AstroDataRow): AstroData {
  requireColumns(row, 'astro_data', [
    'blue_hour_end', 'golden_hour_end', 'golden_hour_start', 'milky_way_visibility',
    'moon_illumination', 'moon_phase', 'stargazing_notes', 'updated_at',
  ]);
  return row;
}

export function toAlert(row: AlertRow): Alert {
  requireColumns(row, 'alerts', [
    'body', 'created_at', 'is_active', 'severity', 'source', 'title', 'trip_id',
  ]);
  return {
    ...row,
    severity: checkedValue(row.severity, ['info', 'warning', 'critical'], 'alerts.severity'),
  };
}

export function toPrepFeedItem(row: PrepFeedItemRow): PrepFeedItem {
  requireColumns(row, 'prep_feed_items', ['caption']);
  return {
    ...row,
    category: checkedValue(
      row.category,
      ['Gear', 'Food', 'Shelter', 'Cook Kit', 'Route', 'Campsite', 'Misc'],
      'prep_feed_items.category'
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readApiItem(value: unknown): unknown {
  return isRecord(value) ? value.item : undefined;
}

export function readApiError(value: unknown): string | null {
  return isRecord(value) && typeof value.error === 'string' ? value.error : null;
}

export function parsePrepFeedItem(value: unknown): PrepFeedItem {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.trip_id !== 'string'
    || (typeof value.image_url !== 'string' && value.image_url !== null)
    || (typeof value.storage_path !== 'string' && value.storage_path !== null)
    || (typeof value.caption !== 'string' && value.caption !== null)
    || typeof value.category !== 'string'
    || typeof value.uploaded_by !== 'string'
    || typeof value.created_at !== 'string'
  ) {
    throw new Error('The prep-feed API returned an invalid item.');
  }

  return toPrepFeedItem({
    id: value.id,
    trip_id: value.trip_id,
    image_url: value.image_url,
    storage_path: value.storage_path,
    caption: value.caption,
    category: value.category,
    uploaded_by: value.uploaded_by,
    created_at: value.created_at,
  });
}

export function toSettings(row: SettingsRow): Settings {
  requireColumns(row, 'settings', [
    'manual_theme_override', 'preferred_units', 'show_astro', 'show_crew',
    'show_meals', 'show_offline', 'theme_variant',
  ]);
  return {
    ...row,
    manual_theme_override: checkedValue(
      row.manual_theme_override,
      ['auto', 'day', 'night'],
      'settings.manual_theme_override'
    ),
    preferred_units: checkedValue(row.preferred_units, ['metric', 'imperial'], 'settings.preferred_units'),
    theme_variant: checkedValue(row.theme_variant, ['expedition', 'clean'], 'settings.theme_variant'),
  };
}
