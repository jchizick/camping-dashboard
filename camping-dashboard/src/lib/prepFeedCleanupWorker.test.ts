import { describe, expect, it, vi } from 'vitest';
import {
  createCleanupRequestHandler,
  retryDelayMs,
  runPrepFeedCleanupWorker,
  sanitizeCleanupError,
  type CleanupJob,
  type CleanupOperationError,
  type CleanupWorkerDependencies,
} from '../../supabase/functions/_shared/prepFeedCleanupWorker';

const NOW = new Date('2026-07-26T20:00:00.000Z');

function job(overrides: Partial<CleanupJob> = {}): CleanupJob {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    trip_id: 'trip-1',
    storage_path: 'trip-1/user/photo.jpg',
    attempt_count: 1,
    ...overrides,
  };
}

function dependencies(
  jobs: CleanupJob[],
  options: {
    referenced?: Set<string>;
    removalErrors?: Map<string, CleanupOperationError>;
  } = {}
): CleanupWorkerDependencies & {
  completedIds: string[];
  retriedIds: string[];
  failedIds: string[];
  retryTimes: string[];
} {
  const completedIds: string[] = [];
  const retriedIds: string[] = [];
  const failedIds: string[] = [];
  const retryTimes: string[] = [];
  let claimed = false;

  return {
    completedIds,
    retriedIds,
    failedIds,
    retryTimes,
    async claim() {
      if (claimed) return [];
      claimed = true;
      return jobs;
    },
    async hasLiveReference(candidate) {
      return options.referenced?.has(candidate.id) ?? false;
    },
    async removeStorage(path) {
      return { error: options.removalErrors?.get(path) ?? null };
    },
    async complete(id) {
      completedIds.push(id);
      return true;
    },
    async retry(id, _workerId, nextAttemptAt) {
      retriedIds.push(id);
      retryTimes.push(nextAttemptAt);
      return true;
    },
    async fail(id) {
      failedIds.push(id);
      return true;
    },
    now: () => NOW,
    random: () => 0.5,
  };
}

describe('prep-feed cleanup request authorization', () => {
  it('rejects missing and invalid authorization without running the worker', async () => {
    const run = vi.fn();
    const handler = createCleanupRequestHandler({
      cronSecret: 'cron-secret',
      run,
      log: vi.fn(),
    });

    const missing = await handler(new Request('https://example.test/worker', {
      method: 'POST',
    }));
    const invalid = await handler(new Request('https://example.test/worker', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong' },
    }));

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(missing.headers.get('cache-control')).toBe('private, no-store');
    expect(run).not.toHaveBeenCalled();
  });

  it('accepts the cron secret and returns only sanitized summary counts', async () => {
    const log = vi.fn();
    const summary = {
      runId: 'run-1',
      claimed: 2,
      completed: 1,
      retried: 1,
      failed: 0,
      skippedReferenced: 0,
      durationMs: 12,
    };
    const handler = createCleanupRequestHandler({
      cronSecret: 'cron-secret',
      run: vi.fn().mockResolvedValue(summary),
      log,
    });

    const response = await handler(new Request('https://example.test/worker', {
      method: 'POST',
      headers: { authorization: 'Bearer cron-secret' },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ...summary });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(log).toHaveBeenCalledWith(summary);
  });

  it('rejects non-POST requests after authorization', async () => {
    const run = vi.fn();
    const handler = createCleanupRequestHandler({
      cronSecret: 'cron-secret',
      run,
      log: vi.fn(),
    });

    const response = await handler(new Request('https://example.test/worker', {
      method: 'GET',
      headers: { authorization: 'Bearer cron-secret' },
    }));

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(run).not.toHaveBeenCalled();
  });
});

describe('prep-feed cleanup worker', () => {
  it('handles an empty queue', async () => {
    const deps = dependencies([]);

    await expect(runPrepFeedCleanupWorker('run-empty', deps)).resolves.toEqual({
      runId: 'run-empty',
      claimed: 0,
      completed: 0,
      retried: 0,
      failed: 0,
      skippedReferenced: 0,
      durationMs: 0,
    });
  });

  it('completes successful and already-absent removals', async () => {
    const deps = dependencies([
      job(),
      job({
        id: '00000000-0000-0000-0000-000000000002',
        storage_path: 'trip-1/user/already-absent.jpg',
      }),
    ]);

    const summary = await runPrepFeedCleanupWorker('run-success', deps);

    expect(summary.completed).toBe(2);
    expect(deps.completedIds).toHaveLength(2);
    expect(deps.retriedIds).toHaveLength(0);
  });

  it('processes a mixed batch without allowing one poisoned job to block later jobs', async () => {
    const invalid = job({
      id: '00000000-0000-0000-0000-000000000003',
      storage_path: 'trip-1/../poison.jpg',
    });
    const valid = job({
      id: '00000000-0000-0000-0000-000000000004',
      storage_path: 'trip-1/user/valid.jpg',
    });
    const deps = dependencies([invalid, valid]);

    const summary = await runPrepFeedCleanupWorker('run-mixed', deps);

    expect(summary).toMatchObject({ claimed: 2, completed: 1, failed: 1 });
    expect(deps.failedIds).toEqual([invalid.id]);
    expect(deps.completedIds).toEqual([valid.id]);
  });

  it('isolates an unexpected job exception and continues the batch', async () => {
    const interrupted = job({
      id: '00000000-0000-0000-0000-000000000007',
      storage_path: 'trip-1/user/interrupted.jpg',
    });
    const later = job({
      id: '00000000-0000-0000-0000-000000000008',
      storage_path: 'trip-1/user/later.jpg',
    });
    const deps = dependencies([interrupted, later]);
    const originalRemove = deps.removeStorage;
    deps.removeStorage = async (path) => {
      if (path === interrupted.storage_path) throw new Error('network interruption');
      return originalRemove(path);
    };

    const summary = await runPrepFeedCleanupWorker('run-isolated', deps);

    expect(summary).toMatchObject({ claimed: 2, retried: 1, completed: 1 });
    expect(deps.retriedIds).toEqual([interrupted.id]);
    expect(deps.completedIds).toEqual([later.id]);
  });

  it('marks namespace mismatches as permanent failures', async () => {
    const mismatched = job({ storage_path: 'trip-2/user/photo.jpg' });
    const deps = dependencies([mismatched]);

    const summary = await runPrepFeedCleanupWorker('run-namespace', deps);

    expect(summary.failed).toBe(1);
    expect(deps.failedIds).toEqual([mismatched.id]);
  });

  it('does not delete a live referenced path', async () => {
    const referenced = job();
    const deps = dependencies(
      [referenced],
      { referenced: new Set([referenced.id]) }
    );
    const removeStorage = vi.spyOn(deps, 'removeStorage');

    const summary = await runPrepFeedCleanupWorker('run-reference', deps);

    expect(summary).toMatchObject({ failed: 1, skippedReferenced: 1 });
    expect(removeStorage).not.toHaveBeenCalled();
  });

  it('schedules a bounded retry for transient Storage failures', async () => {
    const transient = job();
    const deps = dependencies(
      [transient],
      {
        removalErrors: new Map([
          [transient.storage_path, { message: 'temporary outage', statusCode: 503 }],
        ]),
      }
    );

    const summary = await runPrepFeedCleanupWorker('run-retry', deps);

    expect(summary.retried).toBe(1);
    expect(deps.retryTimes).toEqual(['2026-07-26T20:05:00.000Z']);
  });

  it('marks authorization failures and the fifth failed attempt permanent', async () => {
    const authorization = job({
      id: '00000000-0000-0000-0000-000000000005',
      storage_path: 'trip-1/user/auth.jpg',
    });
    const exhausted = job({
      id: '00000000-0000-0000-0000-000000000006',
      storage_path: 'trip-1/user/exhausted.jpg',
      attempt_count: 5,
    });
    const deps = dependencies(
      [authorization, exhausted],
      {
        removalErrors: new Map([
          [authorization.storage_path, { message: 'forbidden', statusCode: 403 }],
          [exhausted.storage_path, { message: 'timeout', statusCode: 503 }],
        ]),
      }
    );

    const summary = await runPrepFeedCleanupWorker('run-failed', deps);

    expect(summary.failed).toBe(2);
    expect(summary.retried).toBe(0);
  });

  it('does not claim the same fake queue twice across duplicate invocations', async () => {
    const deps = dependencies([job()]);

    const first = await runPrepFeedCleanupWorker('run-one', deps);
    const second = await runPrepFeedCleanupWorker('run-two', deps);

    expect(first.claimed).toBe(1);
    expect(second.claimed).toBe(0);
  });
});

describe('cleanup retry and diagnostic helpers', () => {
  it('uses the expected exponential backoff with bounded jitter', () => {
    expect(retryDelayMs(1, () => 0.5)).toBe(5 * 60_000);
    expect(retryDelayMs(2, () => 0.5)).toBe(15 * 60_000);
    expect(retryDelayMs(3, () => 0.5)).toBe(60 * 60_000);
    expect(retryDelayMs(4, () => 0.5)).toBe(6 * 60 * 60_000);
    expect(retryDelayMs(4, () => 0)).toBe(324 * 60_000);
    expect(retryDelayMs(4, () => 1)).toBe(396 * 60_000);
  });

  it('removes URLs, bearer values, and secret parameters from diagnostics', () => {
    const diagnostic = sanitizeCleanupError({
      code: 'Timeout',
      message: 'Bearer abc https://private.test/a?token=secret',
    });

    expect(diagnostic).toEqual({
      code: 'timeout',
      summary: 'Bearer [redacted] [url]',
    });
    expect(JSON.stringify(diagnostic)).not.toContain('abc');
    expect(JSON.stringify(diagnostic)).not.toContain('secret');
  });
});
