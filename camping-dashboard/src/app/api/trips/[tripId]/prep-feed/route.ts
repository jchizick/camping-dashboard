import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createRequestSupabaseClient } from '@/lib/serverSupabase';
import {
  canUserEditTrip,
  uploadPrepFeedFile,
  validateExternalImageUrl,
  validatePrepFeedCategory,
} from '@/lib/serverPrepFeed';
import { PREP_FEED_BUCKET } from '@/lib/prepFeedStorage';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = await createRequestSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { code: 'not_authenticated', error: 'Please sign in before adding a prep-feed item.' },
      { status: 401 }
    );
  }
  if (!(await canUserEditTrip(supabaseAdmin, tripId, user.id))) {
    return NextResponse.json(
      { code: 'not_authorized', error: 'You cannot edit this trip.' },
      { status: 403 }
    );
  }

  let imageUrl: string | null = null;
  let storagePath: string | null = null;
  let caption = '';
  let category = 'Misc';
  let uploadedBy = user.email?.split('@')[0] ?? 'Unknown';

  try {
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      caption = String(form.get('caption') ?? '').trim();
      category = validatePrepFeedCategory(form.get('category'));
      uploadedBy = String(form.get('uploaded_by') ?? uploadedBy).trim() || uploadedBy;
      if (file instanceof File && file.size > 0) {
        const uploaded = await uploadPrepFeedFile(supabaseAdmin, tripId, user.id, file);
        imageUrl = uploaded.imageUrl;
        storagePath = uploaded.storagePath;
      }
    } else {
      const body = await request.json();
      caption = typeof body.caption === 'string' ? body.caption.trim() : '';
      category = validatePrepFeedCategory(body.category);
      uploadedBy = typeof body.uploaded_by === 'string' && body.uploaded_by.trim()
        ? body.uploaded_by.trim()
        : uploadedBy;
      imageUrl = validateExternalImageUrl(body.image_url);
    }
  } catch (error) {
    console.error('[POST prep-feed] Invalid input or upload failed', { tripId, userId: user.id, error });
    return NextResponse.json(
      { code: 'invalid_prep_feed_item', error: error instanceof Error ? error.message : 'Invalid prep-feed item.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('prep_feed_items')
    .insert({
      trip_id: tripId,
      image_url: imageUrl,
      storage_path: storagePath,
      caption,
      category,
      uploaded_by: uploadedBy,
    })
    .select()
    .single();

  if (error || !data) {
    let cleanupError = null;
    if (storagePath) {
      ({ error: cleanupError } = await supabaseAdmin.storage
        .from(PREP_FEED_BUCKET)
        .remove([storagePath]));
    }
    console.error('[POST prep-feed] Database insert failed', {
      tripId,
      userId: user.id,
      error,
      cleanupError,
    });
    return NextResponse.json(
      {
        code: cleanupError ? 'partial_or_retryable_failure' : 'database_operation_failed',
        error: cleanupError
          ? 'The item was not saved and its uploaded photo needs cleanup.'
          : 'The prep-feed item could not be saved.',
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ item: data }, { status: 201 });
}
