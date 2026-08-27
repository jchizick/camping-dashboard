import { describe, expect, it } from 'vitest';
import type { AlertRefreshState, WeatherCurrent, WeatherForecast } from '@/types';
import {
  cachedNoticePresentation,
  cachedWeatherPresentation,
} from './offlineFreshness';

const now = new Date('2026-08-24T12:00:00.000Z');

function weather(updatedAt: string): WeatherCurrent {
  return { updated_at: updatedAt } as WeatherCurrent;
}

describe('offline freshness presentation', () => {
  it('labels recent cached weather and omits expired forecast dates', () => {
    const result = cachedWeatherPresentation(
      weather('2026-08-24T08:00:00.000Z'),
      null,
      [
        { forecast_date: '2026-08-23' } as WeatherForecast,
        { forecast_date: '2026-08-24' } as WeatherForecast,
        { forecast_date: '2026-08-25' } as WeatherForecast,
      ],
      now
    );
    expect(result.label).toBe('Cached · updated 4h ago');
    expect(result.isPrevious).toBe(false);
    expect(result.futureForecast.map((entry) => entry.forecast_date)).toEqual([
      '2026-08-24',
      '2026-08-25',
    ]);
  });

  it('treats weather at least 24 hours old as previous conditions', () => {
    expect(
      cachedWeatherPresentation(
        weather('2026-08-23T12:00:00.000Z'),
        null,
        [],
        now
      ).isPrevious
    ).toBe(true);
  });

  it.each([
    ['6h', '2026-08-24T06:00:00.000Z', 'Cached · updated 6h ago', false],
    ['24h', '2026-08-23T12:00:00.000Z', 'Cached · updated 24h ago', true],
    ['7d', '2026-08-17T12:00:00.000Z', 'Cached · updated 7d ago', true],
    ['29d', '2026-07-26T12:00:00.000Z', 'Cached · updated 29d ago', true],
    ['30d', '2026-07-25T12:00:00.000Z', 'Cached · updated 30d ago', true],
    ['31d', '2026-07-24T12:00:00.000Z', 'Cached · updated 31d ago', true],
  ] as const)(
    'keeps long-offline weather truthful at %s',
    (_age, updatedAt, label, isPrevious) => {
      expect(cachedWeatherPresentation(weather(updatedAt), null, [], now)).toMatchObject({
        label,
        isPrevious,
      });
    }
  );

  it('computes timestamp freshness across a representative DST transition', () => {
    const afterFallback = new Date('2026-11-01T07:30:00.000Z');
    expect(
      cachedWeatherPresentation(
        weather('2026-11-01T05:30:00.000Z'),
        null,
        [],
        afterFallback
      ).label
    ).toBe('Cached · updated 2h ago');
  });

  it('preserves notice checks and distinguishes trusted from unknown emptiness', () => {
    const checked = cachedNoticePresentation(
      [{ last_success_at: '2026-08-24T10:00:00.000Z' } as AlertRefreshState],
      now
    );
    expect(checked).toMatchObject({
      label: 'Cached · last checked 2h ago',
      trustedEmpty: true,
    });
    expect(cachedNoticePresentation(null, now)).toMatchObject({
      label: 'Cached · may have changed',
      trustedEmpty: false,
    });
  });
});
