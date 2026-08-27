import type {
  AlertRefreshState,
  WeatherCurrent,
  WeatherForecast,
  WeatherRefreshState,
} from '@/types';

export const PREVIOUS_CONDITIONS_AGE_MS = 24 * 60 * 60 * 1000;

function timestampValue(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function relativeAge(timestamp: number, now: number) {
  const age = Math.max(0, now - timestamp);
  const minutes = Math.floor(age / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function cachedWeatherPresentation(
  weather: WeatherCurrent | null,
  refresh: WeatherRefreshState | null,
  forecast: readonly WeatherForecast[],
  now = new Date()
) {
  const timestamp =
    timestampValue(refresh?.source_observed_at) ??
    timestampValue(refresh?.last_success_at) ??
    timestampValue(weather?.updated_at);
  const currentTime = now.getTime();
  const today = now.toISOString().slice(0, 10);
  return {
    label: timestamp === null
      ? 'Cached · update time unavailable'
      : `Cached · updated ${relativeAge(timestamp, currentTime)}`,
    exactTimestamp: timestamp === null ? null : new Date(timestamp).toISOString(),
    isPrevious:
      timestamp !== null && currentTime - timestamp >= PREVIOUS_CONDITIONS_AGE_MS,
    futureForecast: forecast.filter((entry) => entry.forecast_date >= today),
  };
}

export function cachedNoticePresentation(
  refreshStates: readonly AlertRefreshState[] | null,
  now = new Date()
) {
  const successfulChecks = (refreshStates ?? [])
    .map((state) => timestampValue(state.last_success_at))
    .filter((value): value is number => value !== null);
  const latest = successfulChecks.length ? Math.max(...successfulChecks) : null;
  const unsupported =
    refreshStates !== null &&
    refreshStates.length > 0 &&
    refreshStates.every((state) => state.status === 'unsupported');
  return {
    label:
      latest === null
        ? 'Cached · may have changed'
        : `Cached · last checked ${relativeAge(latest, now.getTime())}`,
    exactTimestamp: latest === null ? null : new Date(latest).toISOString(),
    trustedEmpty: latest !== null || unsupported,
  };
}
