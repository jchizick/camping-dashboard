import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PREP_FEED_BUCKET,
  getPublicPrepFeedUrl,
  removeStoragePathsIdempotently,
} from './prepFeedStorage';

const PREP_FEED_CATEGORIES = new Set([
  'Gear',
  'Food',
  'Shelter',
  'Cook Kit',
  'Route',
  'Campsite',
  'Misc',
]);

export async function canUserEditTrip(
  admin: SupabaseClient,
  tripId: string,
  userId: string
): Promise<boolean> {
  const [{ data: membership }, { data: trip }] = await Promise.all([
    admin
      .from('trip_members')
      .select('role')
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .maybeSingle(),
    admin
      .from('trips')
      .select('deletion_token')
      .eq('id', tripId)
      .maybeSingle(),
  ]);

  return (
    (membership?.role === 'owner' || membership?.role === 'editor')
    && trip !== null
    && trip.deletion_token === null
  );
}

export function validatePrepFeedCategory(value: unknown): string {
  return typeof value === 'string' && PREP_FEED_CATEGORIES.has(value) ? value : 'Misc';
}

export function validateExternalImageUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error('Image URL must be a string.');

  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP(S) external image URLs are supported.');
  }
  if (url.pathname.includes(`/storage/v1/object/public/${PREP_FEED_BUCKET}/`)) {
    throw new Error('First-party Storage URLs require a canonical storage path.');
  }
  return url.toString();
}

export function makePrepFeedStoragePath(tripId: string, userId: string, file: File): string {
  const mimeExtension = file.type.split('/')[1]?.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const nameExtension = file.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const extension = mimeExtension || nameExtension || 'jpg';
  return `${tripId}/${userId}/${crypto.randomUUID()}.${extension}`;
}

export async function uploadPrepFeedFile(
  admin: SupabaseClient,
  tripId: string,
  userId: string,
  file: File
): Promise<{ imageUrl: string; storagePath: string }> {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']);
  if (!allowedTypes.has(file.type)) {
    throw new Error('Prep-feed uploads must be JPEG, PNG, WebP, GIF, or HEIC images.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Prep-feed images must be 10 MB or smaller.');
  }

  const storagePath = makePrepFeedStoragePath(tripId, userId, file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage
    .from(PREP_FEED_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (error) throw error;

  return {
    storagePath,
    imageUrl: getPublicPrepFeedUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!, storagePath),
  };
}

export async function removePrepFeedStoragePaths(
  admin: SupabaseClient,
  paths: string[]
) {
  for (let index = 0; index < paths.length; index += 1000) {
    const batch = paths.slice(index, index + 1000);
    const result = await removeStoragePathsIdempotently(batch, {
      async exists(path) {
        const separator = path.lastIndexOf('/');
        const folder = path.slice(0, separator);
        const fileName = path.slice(separator + 1);
        const { data, error } = await admin.storage
          .from(PREP_FEED_BUCKET)
          .list(folder, { limit: 100, search: fileName });
        return {
          exists: data?.some((object) => object.name === fileName) ?? false,
          error,
        };
      },
      async remove(existingPaths) {
        const { error } = await admin.storage.from(PREP_FEED_BUCKET).remove(existingPaths);
        return { error };
      },
    });
    if (result.error) return result;
  }
  return { error: null };
}
