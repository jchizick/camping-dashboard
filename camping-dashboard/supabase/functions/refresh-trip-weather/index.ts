import { createClient } from 'npm:@supabase/supabase-js@2.98.0';
import { createOpenMeteoProvider } from '../_shared/weatherProvider.ts';
import {
  processWeatherClaims,
  runWeatherCoordinator,
  type WeatherClaim,
  type WeatherWorkerDatabase,
} from '../_shared/weatherWorker.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const cronSecret = Deno.env.get('WEATHER_REFRESH_CRON_SECRET');

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('Weather worker environment is incomplete.');
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const provider = createOpenMeteoProvider();

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  });
}

function bearerToken(request: Request): string | null {
  const value = request.headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) : null;
}

function database(): WeatherWorkerDatabase {
  return {
    async claimScheduled(workerId, batchSize, staleAfterSeconds) {
      const { data, error } = await admin.rpc('claim_due_trip_weather', {
        p_worker_id: workerId,
        p_batch_size: batchSize,
        p_stale_after_seconds: staleAfterSeconds,
      });
      if (error) throw error;
      return (data ?? []) as WeatherClaim[];
    },
    async persist(tripId, workerId, payload) {
      const { data, error } = await admin.rpc('persist_trip_weather', {
        p_trip_id: tripId,
        p_worker_id: workerId,
        p_payload: payload,
      });
      if (error) throw error;
      return data === 'unchanged' ? 'unchanged' : 'updated';
    },
    async retry(tripId, workerId, code, summary) {
      const { data, error } = await admin.rpc('retry_trip_weather', {
        p_trip_id: tripId,
        p_worker_id: workerId,
        p_error_code: code,
        p_error_summary: summary,
      });
      if (error) throw error;
      return data === true;
    },
    async fail(tripId, workerId, code, summary) {
      const { data, error } = await admin.rpc('fail_trip_weather', {
        p_trip_id: tripId,
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
  if (request.method !== 'POST') {
    return response({ error: 'Method not allowed' }, 405);
  }

  const token = bearerToken(request);
  let input: { mode?: unknown; tripId?: unknown };
  try {
    input = await request.json() as { mode?: unknown; tripId?: unknown };
  } catch {
    input = {};
  }

  const runId = crypto.randomUUID();
  const db = database();

  if (input.mode === 'manual') {
    if (!token || typeof input.tripId !== 'string' || input.tripId.length > 200) {
      return response({ error: 'Authentication and a valid trip are required' }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) {
      return response({ error: 'Authentication required' }, 401);
    }

    const { data: claimData, error: claimError } = await userClient.rpc(
      'claim_trip_weather_manual',
      {
        p_trip_id: input.tripId,
        p_worker_id: runId,
        p_cooldown_seconds: 600,
        p_stale_after_seconds: 900,
      }
    );
    if (claimError) {
      const denied = claimError.code === '42501';
      return response(
        { error: denied ? 'Trip editor access required' : 'Weather refresh could not be started' },
        denied ? 403 : 409
      );
    }
    const claims = (claimData ?? []) as WeatherClaim[];
    if (claims.length !== 1) {
      return response(
        { error: 'Weather refresh is already running or cooling down' },
        409
      );
    }

    const startedAt = Date.now();
    const summary = await processWeatherClaims(runId, claims, db, provider, {
      concurrency: 1,
    });
    const result = { ...summary, durationMs: Date.now() - startedAt };
    console.log(JSON.stringify({
      event: 'trip_weather_manual_run',
      runId: result.runId,
      completed: result.completed,
      retried: result.retried,
      failed: result.failed,
      durationMs: result.durationMs,
    }));
    return response(result, result.completed === 1 ? 200 : 503);
  }

  if (!cronSecret || !token || token !== cronSecret || input.tripId !== undefined) {
    return response({ error: 'Unauthorized' }, 401);
  }

  try {
    const summary = await runWeatherCoordinator(runId, db, provider, {
      batchSize: 10,
      concurrency: 2,
      staleAfterSeconds: 900,
    });
    console.log(JSON.stringify({
      event: 'trip_weather_scheduled_run',
      ...summary,
    }));
    return response(summary);
  } catch {
    console.error(JSON.stringify({
      event: 'trip_weather_scheduled_run_failed',
      runId,
      errorCode: 'coordinator_failure',
    }));
    return response({ error: 'Weather coordinator failed', runId }, 500);
  }
});
