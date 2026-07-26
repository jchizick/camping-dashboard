import type { PrepFeedItemRow } from '@/types/database';

export const PREP_FEED_BUCKET = 'prep-feed';

export type PrepFeedStorageReference =
  Partial<Pick<PrepFeedItemRow, 'storage_path' | 'image_url'>>;

export class InvalidPrepFeedStoragePathError extends Error {
  constructor(path: string, tripId: string) {
    super(`Storage path "${path}" is not inside trip "${tripId}".`);
    this.name = 'InvalidPrepFeedStoragePathError';
  }
}

export function isCanonicalTripStoragePath(path: string, tripId: string): boolean {
  if (!path.startsWith(`${tripId}/`) || path.length > 1024 || path.includes('\\')) {
    return false;
  }

  const parts = path.split('/');
  return parts.length >= 2 && parts.every((part) => part !== '' && part !== '.' && part !== '..');
}

export function collectOwnedStoragePaths(
  tripId: string,
  references: PrepFeedStorageReference[]
): string[] {
  const paths = new Set<string>();

  for (const reference of references) {
    if (!reference.storage_path) continue;
    if (!isCanonicalTripStoragePath(reference.storage_path, tripId)) {
      throw new InvalidPrepFeedStoragePathError(reference.storage_path, tripId);
    }
    paths.add(reference.storage_path);
  }

  return [...paths];
}

export function getPublicPrepFeedUrl(supabaseUrl: string, storagePath: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${PREP_FEED_BUCKET}/${storagePath}`;
}

interface StorageOperationError {
  message: string;
}

export interface IdempotentStorageRemovalDependencies {
  exists(path: string): Promise<{ exists: boolean; error: StorageOperationError | null }>;
  remove(paths: string[]): Promise<{ error: StorageOperationError | null }>;
}

export async function removeStoragePathsIdempotently(
  paths: string[],
  dependencies: IdempotentStorageRemovalDependencies
): Promise<{ error: StorageOperationError | null }> {
  const existence = await Promise.all(paths.map((path) => dependencies.exists(path)));
  const existenceError = existence.find((result) => result.error)?.error ?? null;
  if (existenceError) return { error: existenceError };

  const existingPaths = paths.filter((_, index) => existence[index].exists);
  if (existingPaths.length === 0) return { error: null };

  const removed = await dependencies.remove(existingPaths);
  if (!removed.error) return { error: null };

  // Storage may report an error after another retry removed one or more
  // objects. Only keep the error if a trusted follow-up listing proves that
  // at least one target still exists.
  const remaining = await Promise.all(existingPaths.map((path) => dependencies.exists(path)));
  const verificationError = remaining.find((result) => result.error)?.error ?? null;
  if (verificationError) return { error: verificationError };

  return remaining.some((result) => result.exists) ? removed : { error: null };
}
