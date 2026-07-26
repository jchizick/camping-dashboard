import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createRequestSupabaseClient } from '@/lib/serverSupabase';
import { removePrepFeedStoragePaths } from '@/lib/serverPrepFeed';
import { deleteTripWithPrepFeed } from '@/lib/tripDeletion';

export const runtime = 'nodejs';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = await createRequestSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[DELETE /api/trips/:tripId] Authentication failed', authError);
    return NextResponse.json(
      { ok: false, code: 'not_authenticated', error: 'Please sign in before deleting a trip.' },
      { status: 401 }
    );
  }

  const result = await deleteTripWithPrepFeed(tripId, {
    async begin() {
      const { data, error } = await supabase.rpc('begin_trip_deletion', {
        p_trip_id: tripId,
      });
      return { token: typeof data === 'string' ? data : null, error };
    },
    async listPrepFeedReferences() {
      const [items, cleanupJobs] = await Promise.all([
        supabaseAdmin
          .from('prep_feed_items')
          .select('storage_path, image_url')
          .eq('trip_id', tripId),
        supabaseAdmin
          .from('prep_feed_storage_cleanup_jobs')
          .select('storage_path')
          .eq('trip_id', tripId)
          .is('completed_at', null),
      ]);
      return {
        references: items.data && cleanupJobs.data
          ? [...items.data, ...cleanupJobs.data]
          : null,
        error: items.error ?? cleanupJobs.error,
      };
    },
    async removeStorage(paths) {
      return removePrepFeedStoragePaths(supabaseAdmin, paths);
    },
    async complete(token) {
      const { data, error } = await supabase.rpc('complete_trip_deletion', {
        p_trip_id: tripId,
        p_deletion_token: token,
      });
      return { deleted: data === true, error };
    },
    logError(message, detail) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[DELETE /api/trips/:tripId] ${message}`, {
          tripId,
          userId: user.id,
          detail,
        });
      }
    },
  });

  const status = result.ok
    ? 200
    : result.code === 'not_owner'
      ? 403
      : result.code === 'trip_not_found'
        ? 404
        : result.code === 'storage_cleanup_failed'
          ? 409
          : 500;

  return NextResponse.json(result, { status });
}
