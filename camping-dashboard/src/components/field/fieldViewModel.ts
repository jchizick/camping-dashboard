import type {
  Alert,
  AlertRefreshState,
  AstroData,
  DashboardData,
  OfflineStatus,
  ParkIntel,
  TripDashboard,
  WeatherCurrent,
  WeatherRefreshState,
} from '@/types';
import type { ReadinessCategoryResult } from '@/lib/readiness';
import {
  priorityAlertDisplayTitle,
  priorityAlertSummary,
} from '@/components/home/PriorityAlertCard';

export interface FieldNotice {
  alert: Alert;
  displayTitle: string;
  summary: string;
  sourceLabel: string;
  updatedLabel: string | null;
  isManual: boolean;
}

export interface FieldNoticeRefresh {
  processing: boolean;
  failed: boolean;
  unsupported: boolean;
  hasSuccessfulRefresh: boolean;
  emptyMessage: string;
}

export interface FieldConditions {
  temperature: string;
  condition: string;
  rainChance: string | null;
  wind: string | null;
  sunset: string | null;
}

export interface FieldSiteContext {
  label: string;
  location: string | null;
  notes: string | null;
}

export interface FieldViewModel {
  trip: TripDashboard;
  alerts: Alert[];
  notices: FieldNotice[];
  noticeRefresh: FieldNoticeRefresh;
  alertRefreshStates: AlertRefreshState[] | null;
  parkIntel: ParkIntel | null;
  offlineStatus: OfflineStatus | null;
  manualPrep: ReadinessCategoryResult;
  currentWeather: WeatherCurrent | null;
  weatherRefresh: WeatherRefreshState | null;
  astro: AstroData | null;
  showOffline: boolean;
  showAstro: boolean;
  essentials: {
    fire: string | null;
    water: string | null;
    ranger: string | null;
    rangerHref: string | null;
    site: FieldSiteContext | null;
    conditions: FieldConditions | null;
  };
  reference: {
    wildlife: string | null;
    firewoodPercent: number | null;
    astro: AstroData | null;
  };
}

function nonBlank(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function fieldContactHref(value: string | null | undefined) {
  const contact = nonBlank(value);
  if (!contact) return null;

  const phone = contact.match(
    /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/
  )?.[0];
  if (!phone) return null;

  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? `tel:${phone.trim().startsWith('+') ? '+' : ''}${digits}` : null;
}

function noticeUpdatedLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function createNoticeRefreshState(refreshStates: AlertRefreshState[] | null) {
  const states = refreshStates ?? [];
  const processing = states.some((state) => state.status === 'processing');
  const failed = states.some(
    (state) => state.status === 'failed' || state.status === 'retry'
  );
  const unsupported =
    refreshStates !== null &&
    (states.length === 0 || states.every((state) => state.status === 'unsupported'));
  const hasSuccessfulRefresh = states.some((state) => state.last_success_at);

  let emptyMessage = 'No active notices were reported by the configured sources.';
  if (refreshStates === null) {
    emptyMessage = 'Notice synchronization status could not be loaded.';
  } else if (unsupported) {
    emptyMessage = 'No automated notice source is configured for this trip.';
  } else if (processing) {
    emptyMessage = 'Notice sources are refreshing.';
  } else if (failed && !hasSuccessfulRefresh) {
    emptyMessage = 'Notice sources could not be checked yet.';
  } else if (!hasSuccessfulRefresh) {
    emptyMessage = 'Notice sources have not been checked yet.';
  }

  return {
    processing,
    failed,
    unsupported,
    hasSuccessfulRefresh,
    emptyMessage,
  };
}

function createSiteContext(trip: TripDashboard, intel: ParkIntel | null) {
  const campsite = nonBlank(trip.campsite_label);
  const site = nonBlank(trip.site_name);
  const lake = nonBlank(trip.lake_name);
  const park = nonBlank(trip.park_name);
  const label = campsite ?? site ?? lake ?? park;
  const notes = nonBlank(intel?.custom_notes);

  if (!label && !notes) return null;

  const location = [lake, park]
    .filter((value): value is string => Boolean(value && value !== label))
    .join(' · ');

  return {
    label: label ?? 'Site notes',
    location: location || null,
    notes,
  };
}

function createConditions(weather: WeatherCurrent | null) {
  if (!weather) return null;
  return {
    temperature: `${Math.round(weather.temperature_c)}°C`,
    condition: weather.condition_label,
    rainChance:
      weather.rain_chance === null ? null : `${weather.rain_chance}% rain`,
    wind: weather.wind_kph === null ? null : `${weather.wind_kph} km/h wind`,
    sunset: weather.sunset_time ? `Sunset ${weather.sunset_time}` : null,
  };
}

export function createFieldViewModel({
  data,
  trip,
  alerts,
  parkIntel,
  offlineStatus,
  manualPrep,
}: {
  data: DashboardData;
  trip: TripDashboard;
  alerts: Alert[];
  parkIntel: ParkIntel | null;
  offlineStatus: OfflineStatus | null;
  manualPrep: ReadinessCategoryResult;
}): FieldViewModel {
  const active = alerts.filter((alert) => alert.is_active && !alert.dismissed_at);
  const ordered = [
    ...active.filter((alert) => alert.provider !== 'manual'),
    ...active.filter((alert) => alert.provider === 'manual'),
  ];
  const notices = ordered.map((alert) => {
    const isManual = alert.provider === 'manual';
    return {
      alert,
      displayTitle: priorityAlertDisplayTitle(alert.title, alert.body),
      summary: priorityAlertSummary(alert.body, 148, alert.title),
      sourceLabel: isManual ? 'Manual note' : alert.source,
      updatedLabel: noticeUpdatedLabel(alert.updated_at),
      isManual,
    };
  });

  return {
    trip,
    alerts,
    notices,
    noticeRefresh: createNoticeRefreshState(data.alertRefresh),
    alertRefreshStates: data.alertRefresh,
    parkIntel,
    offlineStatus,
    manualPrep,
    currentWeather: data.currentWeather,
    weatherRefresh: data.weatherRefresh,
    astro: data.astro,
    showOffline: data.settings.show_offline,
    showAstro: data.settings.show_astro,
    essentials: {
      fire: nonBlank(parkIntel?.fire_restriction),
      water: nonBlank(parkIntel?.water_notes),
      ranger: nonBlank(parkIntel?.ranger_station),
      rangerHref: fieldContactHref(parkIntel?.ranger_station),
      site: createSiteContext(trip, parkIntel),
      conditions: createConditions(data.currentWeather),
    },
    reference: {
      wildlife: nonBlank(parkIntel?.wildlife_notes),
      firewoodPercent: parkIntel ? parkIntel.firewood_percent : null,
      astro: data.settings.show_astro ? data.astro : null,
    },
  };
}
