const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 86_400_000;

export interface TripDuration {
  /** Inclusive number of calendar dates from the start date through the end date. */
  days: number;
  /** Number of overnight intervals between the start date and the end date. */
  nights: number;
}

function calendarDateOrdinal(value: string): number | null {
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ordinal = Date.UTC(year, month - 1, day);
  const date = new Date(ordinal);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return ordinal;
}

/**
 * Calculates duration from date-only values without involving local time or
 * elapsed wall-clock hours. Invalid dates and reversed ranges return null.
 */
export function getTripDuration(
  startDate: string,
  endDate: string
): TripDuration | null {
  const start = calendarDateOrdinal(startDate);
  const end = calendarDateOrdinal(endDate);
  if (start === null || end === null || end < start) return null;

  const nights = (end - start) / MILLISECONDS_PER_DAY;
  return {
    days: nights + 1,
    nights,
  };
}

export function formatTripDuration({ days, nights }: TripDuration): string {
  return `${days} day${days === 1 ? '' : 's'} · ${nights} night${nights === 1 ? '' : 's'}`;
}
