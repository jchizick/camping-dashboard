import { createClient } from 'npm:@supabase/supabase-js@2.98.0';
import {
  createCleanupRequestHandler,
  runPrepFeedCleanupWorker,
  type CleanupJob,
  type CleanupOperationError,
} from '../_shared/prepFeedCleanupWorker.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const cronSecret = Deno.env.get('PREP_FEED_CLEANUP_CRON_SECRET');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase worker environment is incomplete.');
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function operationError(error: {
  code?: string;
  message?: string;
  status?: number;
  statusCode?: number;
} | null): CleanupOperationError | null {
  if (!error) return null;
  const rawStatus = error.statusCode ?? error.status;
  const parsedStatus = typeof rawStatus === 'number'
    ? rawStatus
    : Number(rawStatus);
  return {
    code: error.code,
    message: error.message,
    statusCode: Number.isFinite(parsedStatus) ? parsedStatus : undefined,
  };
}

async function storageObjectExists(path: string): Promise<{
  exists: boolean;
  error: CleanupOperationError | null;
}> {
  const separator = path.lastIndexOf('/');
  const folder = path.slice(0, separator);
  const fileName = path.slice(separator + 1);
  const { data, error } = await admin.storage
    .from('prep-feed')
    .list(folder, { limit: 100, search: fileName });
  return {
    exists: data?.some((object) => object.name === fileName) ?? false,
    error: operationError(error),
  };
}

async function removeStorageIdempotently(path: string): Promise<{
  error: CleanupOperationError | null;
}> {
  const before = await storageObjectExists(path);
  if (before.error || !before.exists) return { error: before.error };

  const { error } = await admin.storage.from('prep-feed').remove([path]);
  if (!error) return { error: null };

  const after = await storageObjectExists(path);
  if (after.error) return { error: after.error };
  return after.exists ? { error: operationError(error) } : { error: null };
}

const handler = createCleanupRequestHandler({
  cronSecret,
  async run() {
    const runId = crypto.randomUUID();
    return runPrepFeedCleanupWorker(runId, {
      async claim(workerId, batchSize, staleAfterSeconds) {
        const { data, error } = await admin.rpc(
          'claim_prep_feed_storage_cleanup_jobs',
          {
            p_worker_id: workerId,
            p_batch_size: batchSize,
            p_stale_after_seconds: staleAfterSeconds,
          }
        );
        if (error) throw error;
        return (data ?? []) as CleanupJob[];
      },
      async hasLiveReference(job) {
        const { count, error } = await admin
          .from('prep_feed_items')
          .select('id', { count: 'exact', head: true })
          .eq('storage_path', job.storage_path);
        if (error) throw error;
        return (count ?? 0) > 0;
      },
      removeStorage: removeStorageIdempotently,
      async complete(jobId, workerId) {
        const { data, error } = await admin.rpc(
          'complete_prep_feed_storage_cleanup_job',
          { p_job_id: jobId, p_worker_id: workerId }
        );
        if (error) throw error;
        return data === true;
      },
      async retry(jobId, workerId, nextAttemptAt, errorCode, errorSummary) {
        const { data, error } = await admin.rpc(
          'retry_prep_feed_storage_cleanup_job',
          {
            p_job_id: jobId,
            p_worker_id: workerId,
            p_next_attempt_at: nextAttemptAt,
            p_error_code: errorCode,
            p_error_summary: errorSummary,
          }
        );
        if (error) throw error;
        return data === true;
      },
      async fail(jobId, workerId, errorCode, errorSummary) {
        const { data, error } = await admin.rpc(
          'fail_prep_feed_storage_cleanup_job',
          {
            p_job_id: jobId,
            p_worker_id: workerId,
            p_error_code: errorCode,
            p_error_summary: errorSummary,
          }
        );
        if (error) throw error;
        return data === true;
      },
      now: () => new Date(),
      random: () => Math.random(),
    });
  },
  log(summary) {
    console.log(JSON.stringify({
      event: 'prep_feed_storage_cleanup_run',
      ...summary,
    }));
  },
});

Deno.serve(handler);
