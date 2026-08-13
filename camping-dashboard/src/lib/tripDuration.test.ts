import { describe, expect, it } from 'vitest';
import { formatTripDuration, getTripDuration } from './tripDuration';

describe('trip duration', () => {
  it.each([
    ['same-day trip', '2026-07-05', '2026-07-05', 1, 0],
    ['one-night trip', '2026-07-05', '2026-07-06', 2, 1],
    ['Algonquin trip', '2026-07-05', '2026-07-09', 5, 4],
    ['month boundary', '2026-07-31', '2026-08-02', 3, 2],
    ['year boundary', '2026-12-31', '2027-01-01', 2, 1],
  ])(
    'counts the %s by inclusive calendar dates',
    (_label, startDate, endDate, days, nights) => {
      expect(getTripDuration(startDate, endDate)).toEqual({ days, nights });
    }
  );

  it('is unaffected by a daylight-saving boundary', () => {
    expect(getTripDuration('2026-10-31', '2026-11-02')).toEqual({
      days: 3,
      nights: 2,
    });
  });

  it.each([
    ['reversed range', '2026-07-09', '2026-07-05'],
    ['invalid day', '2026-02-30', '2026-03-01'],
    ['non-date value', 'TBD', '2026-07-05'],
  ])('returns null for a %s', (_label, startDate, endDate) => {
    expect(getTripDuration(startDate, endDate)).toBeNull();
  });

  it.each([
    [{ days: 1, nights: 0 }, '1 day · 0 nights'],
    [{ days: 2, nights: 1 }, '2 days · 1 night'],
    [{ days: 5, nights: 4 }, '5 days · 4 nights'],
  ])('formats pluralization for %j', (duration, label) => {
    expect(formatTripDuration(duration)).toBe(label);
  });
});
