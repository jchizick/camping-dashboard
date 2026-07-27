import {
  AlertProviderError,
  type AlertProviderName,
  type AlertProviderResult,
  type TripAlertContext,
  type TripAlertProvider,
} from './alertProvider.ts';

export type AlertClaim = {
  trip_id: string;
  provider: AlertProviderName;
  provider_external_id: string;
  country_code: string | null;
  region_code: string | null;
  attempt_count: number;
};

export type AlertRunSummary = {
  runId: string;
  claimed: number;
  providersRun: number;
  completed: number;
  retried: number;
  failed: number;
  skipped: number;
  durationMs: number;
};

export interface AlertWorkerDatabase {
  claimScheduled(workerId: string, batchSize: number, staleAfterSeconds: number): Promise<AlertClaim[]>;
  persist(claim: AlertClaim, workerId: string, result: AlertProviderResult): Promise<'updated' | 'unchanged'>;
  retry(claim: AlertClaim, workerId: string, code: string, summary: string): Promise<boolean>;
  fail(claim: AlertClaim, workerId: string, code: string, summary: string): Promise<boolean>;
}

export type AlertWorkerOptions = {
  batchSize?: number;
  concurrency?: number;
  staleAfterSeconds?: number;
  now?: () => number;
};

function context(claim: AlertClaim): TripAlertContext {
  return {
    tripId: claim.trip_id,
    provider: claim.provider,
    providerExternalId: claim.provider_external_id,
    countryCode: claim.country_code,
    regionCode: claim.region_code,
  };
}

function classify(error: unknown): { code: string; summary: string; retryable: boolean } {
  if (error instanceof AlertProviderError) {
    return {
      code: error.code,
      summary: error.message.slice(0, 300),
      retryable: error.retryable,
    };
  }
  return {
    code: 'alert_pipeline_error',
    summary: 'Alert refresh failed inside the processing pipeline.',
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
      const index = cursor++;
      await operation(values[index]);
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(concurrency, values.length) },
    consume
  ));
}

export async function processAlertClaims(
  runId: string,
  claims: AlertClaim[],
  database: Pick<AlertWorkerDatabase, 'persist' | 'retry' | 'fail'>,
  providers: Map<AlertProviderName, TripAlertProvider>,
  options?: AlertWorkerOptions
): Promise<Omit<AlertRunSummary, 'durationMs'>> {
  let completed = 0;
  let retried = 0;
  let failed = 0;
  let skipped = 0;
  let providersRun = 0;
  await mapBounded(claims, options?.concurrency ?? 2, async (claim) => {
    const provider = providers.get(claim.provider);
    if (!provider) {
      const transitioned = await database.fail(
        claim,
        runId,
        'invalid_provider_configuration',
        'Configured alert provider is unavailable.'
      ).catch(() => false);
      if (transitioned) failed++;
      else skipped++;
      return;
    }
    providersRun++;
    try {
      const result = await provider.fetchAlerts(context(claim));
      const persisted = await database.persist(claim, runId, result);
      completed++;
      if (persisted === 'unchanged') skipped++;
    } catch (error) {
      const failure = classify(error);
      const transitioned = await (
        failure.retryable
          ? database.retry(claim, runId, failure.code, failure.summary)
          : database.fail(claim, runId, failure.code, failure.summary)
      ).catch(() => false);
      if (!transitioned) skipped++;
      else if (failure.retryable) retried++;
      else failed++;
    }
  });
  return { runId, claimed: claims.length, providersRun, completed, retried, failed, skipped };
}

export async function runAlertCoordinator(
  runId: string,
  database: AlertWorkerDatabase,
  providers: Map<AlertProviderName, TripAlertProvider>,
  options?: AlertWorkerOptions
): Promise<AlertRunSummary> {
  const now = options?.now ?? Date.now;
  const startedAt = now();
  const claims = await database.claimScheduled(
    runId,
    options?.batchSize ?? 10,
    options?.staleAfterSeconds ?? 900
  );
  const summary = await processAlertClaims(runId, claims, database, providers, options);
  return { ...summary, durationMs: Math.max(0, now() - startedAt) };
}
