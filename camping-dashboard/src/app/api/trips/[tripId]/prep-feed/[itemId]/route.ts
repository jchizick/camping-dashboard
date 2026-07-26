import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createRequestSupabaseClient } from '@/lib/serverSupabase';
import {
  deletePrepFeedItemWithStorage,
  replacePrepFeedImageWithStorage,
} from '@/lib/prepFeedLifecycle';
import {
  canUserEditTrip,
  removePrepFeedStoragePaths,
  uploadPrepFeedFile,
  validateExternalImageUrl,
} from '@/lib/serverPrepFeed';
import { PREP_FEED_BUCKET } from '@/lib/prepFeedStorage';
import type {
  Json,
  ReplacePrepFeedImageArgs,
} from '@/types/database';

export const runtime = 'nodejs';

interface RouteParams {
  tripId: string;
  itemId: string;
}

type NullableReplacePrepFeedImageArgs =
  Omit<ReplacePrepFeedImageArgs, 'p_image_url' | 'p_storage_path'> & {
    p_image_url: string | null;
    p_storage_path: string | null;
  };

function rpcStringProperty(value: Json | null, key: string): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const property = value[key];
  return typeof property === 'string' ? property : null;
}

async function authenticatedUser() {
  const supabase = await createRequestSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<RouteParams> }
) {
  const { tripId, itemId } = await params;
  const user = await authenticatedUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'not_authenticated', error: 'Please sign in before deleting an item.' },
      { status: 401 }
    );
  }

  const result = await deletePrepFeedItemWithStorage(tripId, {
    authorize: () => canUserEditTrip(supabaseAdmin, tripId, user.id),
    async readItem() {
      const { data, error } = await supabaseAdmin
        .from('prep_feed_items')
        .select('trip_id, storage_path, image_url')
        .eq('id', itemId)
        .maybeSingle();
      return { item: data, error };
    },
    async countOtherReferences(path) {
      const { count, error } = await supabaseAdmin
        .from('prep_feed_items')
        .select('id', { count: 'exact', head: true })
        .eq('storage_path', path)
        .neq('id', itemId);
      return { count, error };
    },
    async removeStorage(paths) {
      return removePrepFeedStoragePaths(supabaseAdmin, paths);
    },
    async deleteRow() {
      const { data, error } = await supabaseAdmin
        .from('prep_feed_items')
        .delete()
        .eq('id', itemId)
        .eq('trip_id', tripId)
        .select('id')
        .maybeSingle();
      return { deleted: data !== null, error };
    },
    logError(message, detail) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[DELETE prep-feed item] ${message}`, { tripId, itemId, userId: user.id, detail });
      }
    },
  });

  const status = result.ok
    ? 200
    : result.code === 'not_authorized'
      ? 403
      : result.code === 'not_found'
        ? 404
        : result.code === 'invalid_storage_path'
          ? 409
          : 500;
  return NextResponse.json(result, { status });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<RouteParams> }
) {
  const { tripId, itemId } = await params;
  const user = await authenticatedUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, code: 'not_authenticated', error: 'Please sign in before replacing an image.' },
      { status: 401 }
    );
  }
  if (!(await canUserEditTrip(supabaseAdmin, tripId, user.id))) {
    return NextResponse.json(
      { ok: false, code: 'not_authorized', error: 'You cannot edit this trip.' },
      { status: 403 }
    );
  }

  let newImageUrl: string | null = null;
  let newStoragePath: string | null = null;
  try {
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (file instanceof File && file.size > 0) {
        const uploaded = await uploadPrepFeedFile(supabaseAdmin, tripId, user.id, file);
        newImageUrl = uploaded.imageUrl;
        newStoragePath = uploaded.storagePath;
      }
    } else {
      const body = await request.json();
      newImageUrl = validateExternalImageUrl(body.image_url);
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, code: 'invalid_prep_feed_item', error: error instanceof Error ? error.message : 'Invalid image.' },
      { status: 400 }
    );
  }

  const result = await replacePrepFeedImageWithStorage(tripId, {
    async replaceRowAndQueueCleanup() {
      const rpcArgs = {
        p_item_id: itemId,
        p_actor_user_id: user.id,
        p_image_url: newImageUrl,
        p_storage_path: newStoragePath,
      } satisfies NullableReplacePrepFeedImageArgs;
      // PostgreSQL function arguments are nullable unless declared otherwise,
      // but the Supabase generator currently emits text arguments as `string`.
      const { data, error } = await supabaseAdmin.rpc(
        'replace_prep_feed_image',
        rpcArgs as ReplacePrepFeedImageArgs
      );
      if (error && newStoragePath) {
        const { error: cleanupError } = await supabaseAdmin.storage
          .from(PREP_FEED_BUCKET)
          .remove([newStoragePath]);
        if (cleanupError) {
          console.error('[PUT prep-feed item] New upload rollback failed', {
            tripId,
            itemId,
            newStoragePath,
            cleanupError,
          });
        }
      }
      return {
        oldStoragePath: rpcStringProperty(data, 'old_storage_path'),
        cleanupId: rpcStringProperty(data, 'cleanup_id'),
        error,
      };
    },
    async removeStorage(paths) {
      return removePrepFeedStoragePaths(supabaseAdmin, paths);
    },
    async completeCleanup(cleanupId) {
      const { error } = await supabaseAdmin
        .from('prep_feed_storage_cleanup_jobs')
        .delete()
        .eq('id', cleanupId);
      return { error };
    },
    logError(message, detail) {
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[PUT prep-feed item] ${message}`, { tripId, itemId, userId: user.id, detail });
      }
    },
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
