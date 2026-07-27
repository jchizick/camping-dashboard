import { createClient } from 'npm:@supabase/supabase-js@2.98.0';
import {
  createAlertProviders,
  type AlertProviderResult,
} from '../_shared/alertProvider.ts';
import {
  processAlertClaims,
  runAlertCoordinator,
  type AlertClaim,
  type AlertWorkerDatabase,
} from '../_shared/alertWorker.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const cronSecret = Deno.env.get('ALERT_REFRESH_CRON_SECRET');

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('Alert worker environment is incomplete.');
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const providers = createAlertProviders();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  });
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

function database(): AlertWorkerDatabase {
  return {
    async claimScheduled(workerId, batchSize, staleAfterSeconds) {
      const { data, error } = await admin.rpc('claim_due_trip_alerts', {
        p_worker_id: workerId,
        p_batch_size: batchSize,
        p_stale_after_seconds: staleAfterSeconds,
      });
      if (error) throw error;
      return (data ?? []) as AlertClaim[];
    },
    async persist(claim, workerId, result) {
      const { data, error } = await admin.rpc('persist_trip_alerts', {
        p_trip_id: claim.trip_id,
        p_provider: claim.provider,
        p_worker_id: workerId,
        p_payload: result as AlertProviderResult,
      });
      if (error) throw error;
      return data === 'unchanged' ? 'unchanged' : 'updated';
    },
    async retry(claim, workerId, code, summary) {
      const { data, error } = await admin.rpc('retry_trip_alerts', {
        p_trip_id: claim.trip_id,
        p_provider: claim.provider,
        p_worker_id: workerId,
        p_error_code: code,
        p_error_summary: summary,
      });
      if (error) throw error;
      return data === true;
    },
    async fail(claim, workerId, code, summary) {
      const { data, error } = await admin.rpc('fail_trip_alerts', {
        p_trip_id: claim.trip_id,
        p_provider: claim.provider,
        p_worker_id: workerId,
        p_error_code: code,
        p_error_summary: summary,
      });
      if (error) throw error;
      return data === true;
    },
  };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const token = bearerToken(request);
  let input: { mode?: unknown; tripId?: unknown };
  try {
    input = await request.json() as typeof input;
  } catch {
    input = {};
  }

  const runId = crypto.randomUUID();
  const db = database();
  if (input.mode === 'manual') {
    if (!token || typeof input.tripId !== 'string' || input.tripId.length > 200) {
      return json({ error: 'Authentication and a valid trip are required' }, 401);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Authentication required' }, 401);
    const { data, error } = await userClient.rpc('claim_trip_alerts_manual', {
      p_trip_id: input.tripId,
      p_worker_id: runId,
      p_cooldown_seconds: 600,
      p_stale_after_seconds: 900,
    });
    if (error) {
      if (error.code === '42501') return json({ error: 'Trip editor access required' }, 403);
      return json({ error: 'Alert refresh could not be started' }, 409);
    }
    const claims = (data ?? []) as AlertClaim[];
    if (claims.length === 0) {
      return json({ error: 'Alert refresh is unsupported, running, or cooling down' }, 409);
    }
    const startedAt = Date.now();
    const partial = await processAlertClaims(runId, claims, db, providers, { concurrency: 2 });
    const summary = { ...partial, durationMs: Date.now() - startedAt };
    console.log(JSON.stringify({
      event: 'trip_alerts_manual_run',
      runId,
      claimed: summary.claimed,
      completed: summary.completed,
      retried: summary.retried,
      failed: summary.failed,
      durationMs: summary.durationMs,
    }));
    return json(summary, summary.completed > 0 ? 200 : 503);
  }

  if (!cronSecret || !token || token !== cronSecret || input.tripId !== undefined) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const summary = await runAlertCoordinator(runId, db, providers, {
      batchSize: 10,
      concurrency: 2,
      staleAfterSeconds: 900,
    });
    console.log(JSON.stringify({ event: 'trip_alerts_scheduled_run', ...summary }));
    return json(summary);
  } catch {
    console.error(JSON.stringify({
      event: 'trip_alerts_scheduled_run_failed',
      runId,
      errorCode: 'coordinator_failure',
    }));
    return json({ error: 'Alert coordinator failed', runId }, 500);
  }
});
