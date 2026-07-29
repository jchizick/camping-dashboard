export type DaylightState = 'before' | 'during' | 'after';

export interface DaylightWindow {
  sunriseMinutes: number;
  sunsetMinutes: number;
  sunriseLabel: string;
  sunsetLabel: string;
  sunrisePercent: number;
  daylightPercent: number;
  durationLabel: string;
}

export interface DaylightSummary extends DaylightWindow {
  currentPercent: number;
  state: DaylightState;
}

const MINUTES_PER_DAY = 24 * 60;

function parseClockTime(value: string | null): number | null {
  if (!value) return null;

  const match = value
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?:\s*([ap])\.?m\.?)?$/i);
  if (!match) return null;

  const rawHour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (minute > 59) return null;

  let hour = rawHour;
  if (meridiem) {
    if (rawHour < 1 || rawHour > 12) return null;
    hour = rawHour % 12;
    if (meridiem === 'p') hour += 12;
  } else if (rawHour > 23) {
    return null;
  }

  return (hour * 60) + minute;
}

function formatClockTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function formatDaylightDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function getDaylightWindow(
  sunriseTime: string | null,
  sunsetTime: string | null
): DaylightWindow | null {
  const sunriseMinutes = parseClockTime(sunriseTime);
  const sunsetMinutes = parseClockTime(sunsetTime);
  if (
    sunriseMinutes === null
    || sunsetMinutes === null
    || sunsetMinutes <= sunriseMinutes
  ) {
    return null;
  }

  const daylightMinutes = sunsetMinutes - sunriseMinutes;
  return {
    sunriseMinutes,
    sunsetMinutes,
    sunriseLabel: formatClockTime(sunriseMinutes),
    sunsetLabel: formatClockTime(sunsetMinutes),
    sunrisePercent: (sunriseMinutes / MINUTES_PER_DAY) * 100,
    daylightPercent: (daylightMinutes / MINUTES_PER_DAY) * 100,
    durationLabel: formatDaylightDuration(daylightMinutes),
  };
}

export function getDaylightSummary(
  sunriseTime: string | null,
  sunsetTime: string | null,
  now: Date
): DaylightSummary | null {
  const window = getDaylightWindow(sunriseTime, sunsetTime);
  if (!window || Number.isNaN(now.getTime())) return null;

  const currentMinutes = (now.getHours() * 60)
    + now.getMinutes()
    + (now.getSeconds() / 60);
  const state: DaylightState = currentMinutes < window.sunriseMinutes
    ? 'before'
    : currentMinutes > window.sunsetMinutes
      ? 'after'
      : 'during';

  return {
    ...window,
    currentPercent: Math.min(100, Math.max(0, (currentMinutes / MINUTES_PER_DAY) * 100)),
    state,
  };
}
