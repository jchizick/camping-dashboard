import {
  WeatherProviderError,
  type NormalizedWeatherPayload,
  type WeatherProvider,
} from './weatherProvider.ts';

export type WeatherClaim = {
  trip_id: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
  attempt_count: number;
};

export type WeatherRunSummary = {
  runId: string;
  claimed: number;
  completed: number;
  retried: number;
  failed: number;
  skipped: number;
  durationMs: number;
};

export interface WeatherWorkerDatabase {
  claimScheduled(workerId: string, batchSize: number, staleAfterSeconds: number): Promise<WeatherClaim[]>;
  persist(tripId: string, workerId: string, payload: NormalizedWeatherPayload): Promise<'updated' | 'unchanged'>;
  retry(tripId: string, workerId: string, code: string, summary: string): Promise<boolean>;
  fail(tripId: string, workerId: string, code: string, summary: string): Promise<boolean>;
}

export type WeatherWorkerOptions = {
  batchSize?: number;
  concurrency?: number;
  staleAfterSeconds?: number;
  now?: () => number;
};

type ClassifiedFailure = {
  code: string;
  summary: string;
  retryable: boolean;
};

function classifyFailure(error: unknown): ClassifiedFailure {
  if (error instanceof WeatherProviderError) {
    return {
      code: error.code,
      summary: error.message.slice(0, 300),
      retryable: error.retryable,
    };
  }
  return {
    code: 'weather_pipeline_error',
    summary: 'Weather refresh failed inside the processing pipeline.',
    retryable: true,
  };
}

async function mapBounded<T>(
  values: T[],
  concurrency: number,
  operation: (value: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  async function consume() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      await operation(values[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, consume)
  );
}

export async function processWeatherClaims(
  runId: string,
  claims: WeatherClaim[],
  database: Pick<WeatherWorkerDatabase, 'persist' | 'retry' | 'fail'>,
  provider: WeatherProvider,
  options?: WeatherWorkerOptions
): Promise<Omit<WeatherRunSummary, 'durationMs'>> {
  let completed = 0;
  let retried = 0;
  let failed = 0;
  let skipped = 0;

  await mapBounded(claims, options?.concurrency ?? 2, async (claim) => {
    try {
      const payload = await provider.fetchWeather({
        latitude: claim.latitude,
        longitude: claim.longitude,
        timezone: claim.timezone,
      });
      const result = await database.persist(claim.trip_id, runId, payload);
      completed += 1;
      if (result === 'unchanged') skipped += 1;
    } catch (error) {
      const classified = classifyFailure(error);
      if (classified.retryable) {
        try {
          const transitioned = await database.retry(
            claim.trip_id,
            runId,
            classified.code,
            classified.summary
          );
          if (transitioned) retried += 1;
          else skipped += 1;
        } catch {
          skipped += 1;
        }
      } else {
        try {
          const transitioned = await database.fail(
            claim.trip_id,
            runId,
            classified.code,
            classified.summary
          );
          if (transitioned) failed += 1;
          else skipped += 1;
        } catch {
          skipped += 1;
        }
      }
    }
  });

  return {
    runId,
    claimed: claims.length,
    completed,
    retried,
    failed,
    skipped,
  };
}

export async function runWeatherCoordinator(
  runId: string,
  database: WeatherWorkerDatabase,
  provider: WeatherProvider,
  options?: WeatherWorkerOptions
): Promise<WeatherRunSummary> {
  const now = options?.now ?? Date.now;
  const startedAt = now();
  const claims = await database.claimScheduled(
    runId,
    options?.batchSize ?? 10,
    options?.staleAfterSeconds ?? 900
  );
  const summary = await processWeatherClaims(
    runId,
    claims,
    database,
    provider,
    options
  );
  return { ...summary, durationMs: Math.max(0, now() - startedAt) };
}
