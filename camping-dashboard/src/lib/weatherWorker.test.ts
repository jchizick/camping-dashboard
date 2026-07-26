import { describe, expect, it, vi } from 'vitest';
import {
  WeatherProviderError,
  type NormalizedWeatherPayload,
  type WeatherProvider,
} from '../../supabase/functions/_shared/weatherProvider';
import {
  processWeatherClaims,
  runWeatherCoordinator,
  type WeatherClaim,
  type WeatherWorkerDatabase,
} from '../../supabase/functions/_shared/weatherWorker';

const payload = {
  provider: 'open-meteo',
  requestedAt: '2026-07-26T16:05:00.000Z',
  providerGeneratedAt: null,
  sourceObservedAt: '2026-07-26T16:00:00.000Z',
  timezone: 'America/Toronto',
  utcOffsetSeconds: -14400,
  requestFingerprint: 'a'.repeat(64),
  current: {
    temperatureC: 21,
    weatherCode: 2,
    conditionLabel: 'Partly Cloudy',
    icon: 'cloud-sun',
    windKph: 12,
    humidity: 60,
    rainChance: 20,
    sunriseTime: '05:57',
    sunsetTime: '20:46',
    visibilityMeters: 20000,
  },
  daily: [{
    forecast_date: '2026-07-26',
    high_c: 23,
    low_c: 12,
    condition_label: 'Partly Cloudy',
    rain_chance: 20,
    wind_kph: 15,
    icon: 'cloud-sun',
  }],
  fingerprint: 'b'.repeat(64),
} satisfies NormalizedWeatherPayload;

function claim(id: string): WeatherClaim {
  return {
    trip_id: id,
    latitude: 45,
    longitude: -78,
    timezone: null,
    attempt_count: 1,
  };
}

function database(overrides?: Partial<WeatherWorkerDatabase>): WeatherWorkerDatabase {
  return {
    claimScheduled: vi.fn(async () => []),
    persist: vi.fn(async (): Promise<'updated'> => 'updated'),
    retry: vi.fn(async () => true),
    fail: vi.fn(async () => true),
    ...overrides,
  };
}

describe('weather coordinator', () => {
  it('treats an empty due set as a successful run', async () => {
    const db = database();
    const provider: WeatherProvider = { fetchWeather: vi.fn() };
    const summary = await runWeatherCoordinator('run-empty', db, provider, {
      now: () => 100,
    });

    expect(summary).toEqual({
      runId: 'run-empty',
      claimed: 0,
      completed: 0,
      retried: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
    });
    expect(provider.fetchWeather).not.toHaveBeenCalled();
  });

  it('persists each successful claim through the common transaction boundary', async () => {
    const claims = [claim('one'), claim('two')];
    const db = database({ claimScheduled: vi.fn(async () => claims) });
    const provider: WeatherProvider = {
      fetchWeather: vi.fn(async () => payload),
    };

    const summary = await runWeatherCoordinator('run-success', db, provider);

    expect(summary.completed).toBe(2);
    expect(db.persist).toHaveBeenCalledTimes(2);
  });

  it('isolates retryable and permanent failures in one mixed batch', async () => {
    const claims = [claim('good'), claim('retry'), claim('bad')];
    const db = database();
    const provider: WeatherProvider = {
      fetchWeather: vi.fn(async (location) => {
        if (location.latitude !== 45) return payload;
        const call = (provider.fetchWeather as ReturnType<typeof vi.fn>).mock.calls.length;
        if (call === 2) {
          throw new WeatherProviderError('provider_timeout', true, 'Weather provider timed out.');
        }
        if (call === 3) {
          throw new WeatherProviderError('provider_contract', false, 'Provider response is invalid.');
        }
        return payload;
      }),
    };

    const summary = await processWeatherClaims(
      'run-mixed',
      claims,
      db,
      provider,
      { concurrency: 1 }
    );

    expect(summary).toMatchObject({
      claimed: 3,
      completed: 1,
      retried: 1,
      failed: 1,
    });
    expect(db.retry).toHaveBeenCalledWith(
      'retry',
      'run-mixed',
      'provider_timeout',
      'Weather provider timed out.'
    );
    expect(db.fail).toHaveBeenCalledWith(
      'bad',
      'run-mixed',
      'provider_contract',
      'Provider response is invalid.'
    );
  });

  it('bounds provider concurrency', async () => {
    let active = 0;
    let maximum = 0;
    const release: Array<() => void> = [];
    const provider: WeatherProvider = {
      fetchWeather: vi.fn(async () => {
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise<void>((resolve) => release.push(resolve));
        active -= 1;
        return payload;
      }),
    };
    const db = database();
    const running = processWeatherClaims(
      'run-bounded',
      [claim('a'), claim('b'), claim('c')],
      db,
      provider,
      { concurrency: 2 }
    );
    await vi.waitFor(() => expect(active).toBe(2));
    release.splice(0).forEach((resolve) => resolve());
    await vi.waitFor(() => expect(release.length).toBe(1));
    release.splice(0).forEach((resolve) => resolve());
    await running;

    expect(maximum).toBe(2);
  });

  it('sanitizes unexpected pipeline failures', async () => {
    const db = database();
    const provider: WeatherProvider = {
      fetchWeather: vi.fn(async () => {
        throw new Error('secret provider URL with coordinates');
      }),
    };

    await processWeatherClaims('run-sanitize', [claim('trip')], db, provider);

    expect(db.retry).toHaveBeenCalledWith(
      'trip',
      'run-sanitize',
      'weather_pipeline_error',
      'Weather refresh failed inside the processing pipeline.'
    );
  });

  it('continues after one trip cannot record its failure transition', async () => {
    let providerCall = 0;
    const db = database({
      retry: vi.fn(async () => {
        throw new Error('temporary database failure');
      }),
    });
    const provider: WeatherProvider = {
      fetchWeather: vi.fn(async () => {
        providerCall += 1;
        if (providerCall === 1) {
          throw new WeatherProviderError(
            'provider_timeout',
            true,
            'Weather provider timed out.'
          );
        }
        return payload;
      }),
    };

    const summary = await processWeatherClaims(
      'run-poisoned',
      [claim('poisoned'), claim('healthy')],
      db,
      provider,
      { concurrency: 1 }
    );

    expect(summary).toMatchObject({ completed: 1, skipped: 1 });
    expect(db.persist).toHaveBeenCalledWith('healthy', 'run-poisoned', payload);
  });
});
