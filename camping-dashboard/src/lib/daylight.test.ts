import { describe, expect, it } from 'vitest';
import {
  formatDaylightDuration,
  getDaylightSummary,
  getDaylightWindow,
} from './daylight';

describe('daylight indicator calculations', () => {
  it('positions sunrise, sunset, and a daytime marker on a 24-hour track', () => {
    const summary = getDaylightSummary(
      '06:00',
      '18:00',
      new Date(2026, 6, 29, 12, 0)
    );

    expect(summary).toMatchObject({
      sunrisePercent: 25,
      daylightPercent: 50,
      currentPercent: 50,
      state: 'during',
    });
  });

  it('formats daylight duration without unnecessary zero minutes', () => {
    expect(formatDaylightDuration(885)).toBe('14h 45m');
    expect(formatDaylightDuration(720)).toBe('12h');
    expect(getDaylightWindow('05:45', '20:30')?.durationLabel).toBe('14h 45m');
  });

  it('omits invalid, missing, or overnight windows', () => {
    expect(getDaylightWindow(null, '20:30')).toBeNull();
    expect(getDaylightWindow('not-a-time', '20:30')).toBeNull();
    expect(getDaylightWindow('20:30', '05:45')).toBeNull();
  });

  it.each([
    ['before', new Date(2026, 6, 29, 5, 0), 20.83],
    ['during', new Date(2026, 6, 29, 12, 0), 50],
    ['after', new Date(2026, 6, 29, 21, 0), 87.5],
  ] as const)('places a %s-daylight marker outside or inside the segment', (
    state,
    now,
    expectedPercent
  ) => {
    const summary = getDaylightSummary('06:00', '18:00', now);

    expect(summary?.state).toBe(state);
    expect(summary?.currentPercent).toBeCloseTo(expectedPercent, 1);
  });
});
