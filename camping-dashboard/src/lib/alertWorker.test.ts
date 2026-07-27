import { describe, expect, it, vi } from 'vitest';
import {
  AlertProviderError,
  type AlertProviderName,
  type AlertProviderResult,
  type TripAlertProvider,
} from '../../supabase/functions/_shared/alertProvider';
import {
  processAlertClaims,
  runAlertCoordinator,
  type AlertClaim,
  type AlertWorkerDatabase,
} from '../../supabase/functions/_shared/alertWorker';

const result: AlertProviderResult = {
  provider: 'ontario-parks',
  fetchedAt: '2026-07-27T03:00:00.000Z',
  alerts: [],
  fingerprint: 'a'.repeat(64),
  complete: true,
};
function claim(id: string, provider: AlertProviderName = 'ontario-parks'): AlertClaim {
  return {
    trip_id: id,
    provider,
    provider_external_id: provider === 'ontario-parks' ? 'algonquin/backcountry' : 'onrm31',
    country_code: 'CA',
    region_code: 'ON',
    attempt_count: 1,
  };
}
function database(overrides?: Partial<AlertWorkerDatabase>): AlertWorkerDatabase {
  return {
    claimScheduled: vi.fn(async () => []),
    persist: vi.fn(async () => 'updated' as const),
    retry: vi.fn(async () => true),
    fail: vi.fn(async () => true),
    ...overrides,
  };
}
function provider(
  name: AlertProviderName,
  fetchAlerts: TripAlertProvider['fetchAlerts']
): TripAlertProvider {
  return { name, supports: () => true, fetchAlerts };
}

describe('alert coordinator', () => {
  it('returns a successful empty summary for no due providers', async () => {
    const summary = await runAlertCoordinator('empty', database(), new Map(), { now: () => 100 });
    expect(summary).toEqual({
      runId: 'empty',
      claimed: 0,
      providersRun: 0,
      completed: 0,
      retried: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
    });
  });

  it('processes two providers for one trip independently', async () => {
    const db = database();
    const providers = new Map<AlertProviderName, TripAlertProvider>([
      ['ontario-parks', provider('ontario-parks', vi.fn(async () => result))],
      ['environment-canada', provider('environment-canada', vi.fn(async () => ({
        ...result,
        provider: 'environment-canada' as const,
      })))],
    ]);
    const summary = await processAlertClaims(
      'both',
      [claim('trip'), claim('trip', 'environment-canada')],
      db,
      providers
    );
    expect(summary).toMatchObject({ providersRun: 2, completed: 2 });
    expect(db.persist).toHaveBeenCalledTimes(2);
  });

  it('isolates retryable and permanent failures', async () => {
    let calls = 0;
    const providers = new Map<AlertProviderName, TripAlertProvider>([
      ['ontario-parks', provider('ontario-parks', vi.fn(async () => {
        calls++;
        if (calls === 1) throw new AlertProviderError('provider_timeout', true, 'Alert provider timed out.');
        throw new AlertProviderError('provider_contract', false, 'Alert provider response is invalid.');
      }))],
    ]);
    const db = database();
    const summary = await processAlertClaims(
      'mixed',
      [claim('retry'), claim('fail')],
      db,
      providers,
      { concurrency: 1 }
    );
    expect(summary).toMatchObject({ retried: 1, failed: 1 });
    expect(db.retry).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: 'retry' }),
      'mixed',
      'provider_timeout',
      'Alert provider timed out.'
    );
  });

  it('bounds concurrency and sanitizes unknown errors', async () => {
    let active = 0;
    let maximum = 0;
    const releases: Array<() => void> = [];
    const db = database();
    const providers = new Map<AlertProviderName, TripAlertProvider>([
      ['ontario-parks', provider('ontario-parks', vi.fn(async () => {
        active++;
        maximum = Math.max(maximum, active);
        await new Promise<void>((resolve) => releases.push(resolve));
        active--;
        throw new Error('private provider body and URL');
      }))],
    ]);
    const running = processAlertClaims(
      'bounded',
      [claim('a'), claim('b'), claim('c')],
      db,
      providers,
      { concurrency: 2 }
    );
    await vi.waitFor(() => expect(active).toBe(2));
    releases.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(releases.length).toBe(1));
    releases.splice(0).forEach((release) => release());
    await running;
    expect(maximum).toBe(2);
    expect(db.retry).toHaveBeenCalledWith(
      expect.anything(),
      'bounded',
      'alert_pipeline_error',
      'Alert refresh failed inside the processing pipeline.'
    );
  });
});
