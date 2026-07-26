import { describe, expect, it } from 'vitest';
import { mapOpenMeteoToSupabase, type OpenMeteoResponse } from './weatherMapper';

const response: OpenMeteoResponse = {
  current: {
    time: '2026-07-25T12:00',
    temperature_2m: 22.26,
    relative_humidity_2m: 67.6,
    wind_speed_10m: 13.44,
    weather_code: 2,
    precipitation_probability: 18.7,
    visibility: 24140,
  },
  daily: {
    time: ['2026-07-25', '2026-07-26', '2026-07-27'],
    weather_code: [2, 61, 0],
    temperature_2m_max: [24.24, 20.16, 26.04],
    temperature_2m_min: [12.16, 10.04, 13.95],
    precipitation_probability_max: [20.2, 72.8, 4.4],
    wind_speed_10m_max: [18.26, 27.94, 9.96],
    sunrise: ['2026-07-25T05:52', '2026-07-26T05:53', '2026-07-27T05:54'],
    sunset: ['2026-07-25T20:48', '2026-07-26T20:47', '2026-07-27T20:46'],
  },
};

describe('mapOpenMeteoToSupabase', () => {
  it('maps current conditions to the requested trip without a legacy singleton id', () => {
    const { current } = mapOpenMeteoToSupabase(response, 'trip-test', 2);

    expect(current).toMatchObject({
      trip_id: 'trip-test',
      temperature_c: 22.3,
      humidity: 68,
      rain_chance: 19,
      sunrise_time: '05:52',
      sunset_time: '20:48',
      condition_label: 'Partly Cloudy',
    });
    expect(current).not.toHaveProperty('id');
  });

  it('preserves forecasts as one row per trip and date', () => {
    const { forecasts } = mapOpenMeteoToSupabase(response, 'trip-test', 2);

    expect(forecasts).toHaveLength(2);
    expect(
      forecasts.map(({ trip_id, forecast_date }) => [trip_id, forecast_date])
    ).toEqual([
      ['trip-test', '2026-07-25'],
      ['trip-test', '2026-07-26'],
    ]);
    expect(new Set(forecasts.map(({ forecast_date }) => forecast_date)).size).toBe(2);
  });
});
