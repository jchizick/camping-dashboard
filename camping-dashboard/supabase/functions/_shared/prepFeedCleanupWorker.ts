export const MAX_CLEANUP_ATTEMPTS = 5;
export const CLEANUP_BATCH_SIZE = 10;
export const CLEANUP_STALE_LOCK_SECONDS = 15 * 60;

const BACKOFF_MS = [
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
] as const;

export interface CleanupJob {
  id: string;
  trip_id: string;
  storage_path: string;
  attempt_count: number;
}

export interface CleanupOperationError {
  code?: string;
  message?: string;
  statusCode?: number;
}

export interface CleanupRunSummary {
  runId: string;
  claimed: number;
  completed: number;
  retried: number;
  failed: number;
  skippedReferenced: number;
  durationMs: number;
}

export interface CleanupWorkerDependencies {
  claim(
    workerId: string,
    batchSize: number,
    staleAfterSeconds: number
  ): Promise<CleanupJob[]>;
  hasLiveReference(job: CleanupJob): Promise<boolean>;
  removeStorage(path: string): Promise<{ error: CleanupOperationError | null }>;
  complete(jobId: string, workerId: string): Promise<boolean>;
  retry(
    jobId: string,
    workerId: string,
    nextAttemptAt: string,
    errorCode: string,
    errorSummary: string
  ): Promise<boolean>;
  fail(
    jobId: string,
    workerId: string,
    errorCode: string,
    errorSummary: string
  ): Promise<boolean>;
  now(): Date;
  random(): number;
}

export function isCanonicalCleanupPath(path: string, tripId: string): boolean {
  if (
    !path.startsWith(`${tripId}/`)
    || path.length > 1024
    || path.includes('\\')
    || path.includes('..')
  ) {
    return false;
  }

  const parts = path.split('/');
  return parts.length >= 2
    && parts.every((part) => part !== '' && part !== '.' && part !== '..');
}

export function retryDelayMs(attemptCount: number, random: () => number): number {
  const base = BACKOFF_MS[Math.min(Math.max(attemptCount - 1, 0), BACKOFF_MS.length - 1)];
  const jitter = 0.9 + (Math.min(Math.max(random(), 0), 1) * 0.2);
  return Math.round(base * jitter);
}

export function sanitizeCleanupError(error: CleanupOperationError): {
  code: string;
  summary: string;
} {
  const statusCode = error.statusCode;
  const code = typeof error.code === 'string' && /^[a-z0-9_-]{1,64}$/i.test(error.code)
    ? error.code.toLowerCase()
    : statusCode
      ? `storage_${statusCode}`
      : 'storage_error';
  const rawSummary = typeof error.message === 'string'
    ? error.message
    : 'Storage cleanup failed.';
  const summary = rawSummary
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/[?&](token|key|secret|signature)=[^&\s]+/gi, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500) || 'Storage cleanup failed.';

  return { code, summary };
}

export function isPermanentCleanupError(error: CleanupOperationError): boolean {
  return error.statusCode === 400
    || error.statusCode === 401
    || error.statusCode === 403;
}

export async function runPrepFeedCleanupWorker(
  runId: string,
  dependencies: CleanupWorkerDependencies
): Promise<CleanupRunSummary> {
  const startedAt = dependencies.now().getTime();
  const jobs = await dependencies.claim(
    runId,
    CLEANUP_BATCH_SIZE,
    CLEANUP_STALE_LOCK_SECONDS
  );
  const summary: CleanupRunSummary = {
    runId,
    claimed: jobs.length,
    completed: 0,
    retried: 0,
    failed: 0,
    skippedReferenced: 0,
    durationMs: 0,
  };

  for (const job of jobs) {
    try {
      if (!isCanonicalCleanupPath(job.storage_path, job.trip_id)) {
        if (await dependencies.fail(
          job.id,
          runId,
          'invalid_storage_path',
          'Queued Storage path failed canonical validation.'
        )) {
          summary.failed += 1;
        }
        continue;
      }

      if (await dependencies.hasLiveReference(job)) {
        if (await dependencies.fail(
          job.id,
          runId,
          'storage_path_referenced',
          'Queued Storage path is referenced by a live prep-feed item.'
        )) {
          summary.failed += 1;
          summary.skippedReferenced += 1;
        }
        continue;
      }

      const removed = await dependencies.removeStorage(job.storage_path);
      if (!removed.error) {
        if (await dependencies.complete(job.id, runId)) {
          summary.completed += 1;
        }
        continue;
      }

      const diagnostic = sanitizeCleanupError(removed.error);
      if (
        isPermanentCleanupError(removed.error)
        || job.attempt_count >= MAX_CLEANUP_ATTEMPTS
      ) {
        if (await dependencies.fail(
          job.id,
          runId,
          diagnostic.code,
          diagnostic.summary
        )) {
          summary.failed += 1;
        }
        continue;
      }

      const nextAttemptAt = new Date(
        dependencies.now().getTime() + retryDelayMs(job.attempt_count, dependencies.random)
      ).toISOString();
      if (await dependencies.retry(
        job.id,
        runId,
        nextAttemptAt,
        diagnostic.code,
        diagnostic.summary
      )) {
        summary.retried += 1;
      }
    } catch (error) {
      const diagnostic = sanitizeCleanupError({
        message: error instanceof Error
          ? error.message
          : 'Cleanup operation failed unexpectedly.',
      });
      if (job.attempt_count >= MAX_CLEANUP_ATTEMPTS) {
        if (await dependencies.fail(
          job.id,
          runId,
          diagnostic.code,
          diagnostic.summary
        )) {
          summary.failed += 1;
        }
      } else {
        const nextAttemptAt = new Date(
          dependencies.now().getTime()
            + retryDelayMs(job.attempt_count, dependencies.random)
        ).toISOString();
        if (await dependencies.retry(
          job.id,
          runId,
          nextAttemptAt,
          diagnostic.code,
          diagnostic.summary
        )) {
          summary.retried += 1;
        }
      }
    }
  }

  summary.durationMs = Math.max(0, dependencies.now().getTime() - startedAt);
  return summary;
}

export interface CleanupRequestHandlerDependencies {
  cronSecret: string | undefined;
  run(): Promise<CleanupRunSummary>;
  log(summary: CleanupRunSummary): void;
}

export function createCleanupRequestHandler(
  dependencies: CleanupRequestHandlerDependencies
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const authorization = request.headers.get('authorization');
    if (
      !dependencies.cronSecret
      || authorization !== `Bearer ${dependencies.cronSecret}`
    ) {
      return Response.json({ ok: false }, {
        status: 401,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    if (request.method !== 'POST') {
      return Response.json({ ok: false }, {
        status: 405,
        headers: {
          'Allow': 'POST',
          'Cache-Control': 'private, no-store',
        },
      });
    }

    const summary = await dependencies.run();
    dependencies.log(summary);
    return Response.json({ ok: true, ...summary }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  };
}
