import { describe, expect, it, vi } from 'vitest';
import {
  WeatherProviderError,
  buildOpenMeteoUrl,
  createOpenMeteoProvider,
} from '../../supabase/functions/_shared/weatherProvider';

const fixture = {
  timezone: 'America/Toronto',
  utc_offset_seconds: -14400,
  current: {
    time: '2026-07-26T12:00',
    temperature_2m: 21.25,
    relative_humidity_2m: 64,
    wind_speed_10m: 12.34,
    weather_code: 2,
    precipitation_probability: 18,
    visibility: 23456,
  },
  daily: {
    time: ['2026-07-26', '2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30'],
    weather_code: [2, 61, 0, 3, 80],
    temperature_2m_max: [23.25, 19, 22, 20, 18],
    temperature_2m_min: [12.24, 10, 11, 9, 8],
    precipitation_probability_max: [18, 70, 5, 20, 60],
    wind_speed_10m_max: [15.56, 21, 10, 13, 25],
    sunrise: [
      '2026-07-26T05:57',
      '2026-07-27T05:58',
      '2026-07-28T05:59',
      '2026-07-29T06:00',
      '2026-07-30T06:01',
    ],
    sunset: [
      '2026-07-26T20:46',
      '2026-07-27T20:45',
      '2026-07-28T20:44',
      '2026-07-29T20:43',
      '2026-07-30T20:42',
    ],
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Open-Meteo weather provider', () => {
  it('constructs a deterministic five-day metric request', () => {
    const first = buildOpenMeteoUrl({ latitude: 45.1, longitude: -78.2 });
    const second = buildOpenMeteoUrl({ latitude: 45.1, longitude: -78.2 });

    expect(first.toString()).toBe(second.toString());
    expect(first.searchParams.get('forecast_days')).toBe('5');
    expect(first.searchParams.get('timezone')).toBe('auto');
    expect(first.searchParams.get('wind_speed_unit')).toBe('kmh');
    expect(first.searchParams.get('daily')).toContain('sunrise');
  });

  it('normalizes provider data, timezone, optional values, and WMO codes', async () => {
    const provider = createOpenMeteoProvider({
      fetch: vi.fn(async () => jsonResponse(fixture)),
      now: () => new Date('2026-07-26T16:05:00.000Z'),
    });

    const result = await provider.fetchWeather({
      latitude: 45.1,
      longitude: -78.2,
    });

    expect(result.provider).toBe('open-meteo');
    expect(result.sourceObservedAt).toBe('2026-07-26T16:00:00.000Z');
    expect(result.current).toMatchObject({
      temperatureC: 21.25,
      conditionLabel: 'Partly Cloudy',
      icon: 'cloud-sun',
      windKph: 12.3,
      sunriseTime: '05:57',
    });
    expect(result.daily[1]).toMatchObject({
      forecast_date: '2026-07-27',
      condition_label: 'Light Rain',
      rain_chance: 70,
    });
    expect(result.requestFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(result.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps missing optional fields null instead of fabricating values', async () => {
    const body = structuredClone(fixture);
    body.current.visibility = null as unknown as number;
    body.current.precipitation_probability = null as unknown as number;
    body.daily.temperature_2m_max[0] = null as unknown as number;
    const provider = createOpenMeteoProvider({
      fetch: vi.fn(async () => jsonResponse(body)),
    });

    const result = await provider.fetchWeather({
      latitude: 45.1,
      longitude: -78.2,
    });

    expect(result.current.visibilityMeters).toBeNull();
    expect(result.current.rainChance).toBeNull();
    expect(result.daily[0].high_c).toBeNull();
  });

  it('produces stable fingerprints independent of request time', async () => {
    const first = createOpenMeteoProvider({
      fetch: vi.fn(async () => jsonResponse(fixture)),
      now: () => new Date('2026-07-26T16:05:00.000Z'),
    });
    const second = createOpenMeteoProvider({
      fetch: vi.fn(async () => jsonResponse(fixture)),
      now: () => new Date('2026-07-26T17:05:00.000Z'),
    });

    const [a, b] = await Promise.all([
      first.fetchWeather({ latitude: 45.1, longitude: -78.2 }),
      second.fetchWeather({ latitude: 45.1, longitude: -78.2 }),
    ]);

    expect(a.requestedAt).not.toBe(b.requestedAt);
    expect(a.requestFingerprint).toBe(b.requestFingerprint);
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it.each([
    [429, 'provider_rate_limited', true],
    [503, 'provider_unavailable', true],
    [400, 'provider_rejected', false],
  ])('classifies HTTP %s without exposing a response body', async (status, code, retryable) => {
    const provider = createOpenMeteoProvider({
      fetch: vi.fn(async () => jsonResponse({ private: 'do not expose' }, status)),
    });

    await expect(
      provider.fetchWeather({ latitude: 45.1, longitude: -78.2 })
    ).rejects.toMatchObject({ code, retryable });
  });

  it('rejects malformed and misaligned responses before persistence', async () => {
    const body = structuredClone(fixture);
    body.daily.weather_code.pop();
    const provider = createOpenMeteoProvider({
      fetch: vi.fn(async () => jsonResponse(body)),
    });

    await expect(
      provider.fetchWeather({ latitude: 45.1, longitude: -78.2 })
    ).rejects.toMatchObject({
      code: 'provider_contract',
      retryable: false,
    });
  });

  it('classifies an aborted provider request as retryable timeout', async () => {
    const provider = createOpenMeteoProvider({
      timeoutMs: 1,
      fetch: vi.fn((_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      })),
    });

    await expect(
      provider.fetchWeather({ latitude: 45.1, longitude: -78.2 })
    ).rejects.toEqual(
      expect.objectContaining<Partial<WeatherProviderError>>({
        code: 'provider_timeout',
        retryable: true,
      })
    );
  });
});
