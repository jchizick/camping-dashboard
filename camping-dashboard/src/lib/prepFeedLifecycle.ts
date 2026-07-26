import {
  collectOwnedStoragePaths,
  InvalidPrepFeedStoragePathError,
  type PrepFeedStorageReference,
} from './prepFeedStorage';

export interface PrepFeedLifecycleResult {
  ok: boolean;
  code:
    | 'deleted'
    | 'replaced'
    | 'not_authorized'
    | 'not_found'
    | 'invalid_storage_path'
    | 'storage_cleanup_failed'
    | 'database_operation_failed'
    | 'partial_or_retryable_failure';
  error?: string;
  retryable?: boolean;
}

interface OperationError {
  code?: string;
  message: string;
}

export interface DeletePrepFeedItemDependencies {
  authorize(): Promise<boolean>;
  readItem(): Promise<{
    item: (PrepFeedStorageReference & { trip_id: string }) | null;
    error: OperationError | null;
  }>;
  countOtherReferences(path: string): Promise<{ count: number | null; error: OperationError | null }>;
  removeStorage(paths: string[]): Promise<{ error: OperationError | null }>;
  deleteRow(): Promise<{ deleted: boolean; error: OperationError | null }>;
  logError(message: string, detail: unknown): void;
}

export async function deletePrepFeedItemWithStorage(
  tripId: string,
  dependencies: DeletePrepFeedItemDependencies
): Promise<PrepFeedLifecycleResult> {
  if (!(await dependencies.authorize())) {
    return { ok: false, code: 'not_authorized', error: 'You cannot edit this trip.' };
  }

  const loaded = await dependencies.readItem();
  if (loaded.error) {
    dependencies.logError('prep-feed item lookup failed', loaded.error);
    return { ok: false, code: 'database_operation_failed', error: 'The prep-feed item could not be read.' };
  }
  if (!loaded.item || loaded.item.trip_id !== tripId) {
    return { ok: false, code: 'not_found', error: 'Prep-feed item not found.' };
  }

  let paths: string[];
  try {
    paths = collectOwnedStoragePaths(tripId, [loaded.item]);
  } catch (error) {
    dependencies.logError('prep-feed item path validation failed', error);
    if (error instanceof InvalidPrepFeedStoragePathError) {
      return { ok: false, code: 'invalid_storage_path', error: 'The item has an invalid storage path.' };
    }
    throw error;
  }

  if (paths[0]) {
    const references = await dependencies.countOtherReferences(paths[0]);
    if (references.error || references.count === null) {
      dependencies.logError('shared storage reference check failed', references.error);
      return {
        ok: false,
        code: 'database_operation_failed',
        error: 'The photo reference could not be verified.',
      };
    }

    if (references.count === 0) {
      const removed = await dependencies.removeStorage(paths);
      if (removed.error) {
        dependencies.logError('individual prep-feed storage cleanup failed', removed.error);
        return {
          ok: false,
          code: 'storage_cleanup_failed',
          error: 'The photo could not be removed, so the item was left intact.',
          retryable: true,
        };
      }
    }
  }

  const deleted = await dependencies.deleteRow();
  if (deleted.error || !deleted.deleted) {
    dependencies.logError('prep-feed row deletion failed after storage handling', deleted.error);
    return {
      ok: false,
      code: 'database_operation_failed',
      error: 'Photo storage was handled, but the feed item could not be deleted. Retry to finish.',
      retryable: true,
    };
  }

  return { ok: true, code: 'deleted' };
}

export interface ReplacePrepFeedImageDependencies {
  replaceRowAndQueueCleanup(): Promise<{
    oldStoragePath: string | null;
    cleanupId: string | null;
    error: OperationError | null;
  }>;
  removeStorage(paths: string[]): Promise<{ error: OperationError | null }>;
  completeCleanup(cleanupId: string): Promise<{ error: OperationError | null }>;
  logError(message: string, detail: unknown): void;
}

export async function replacePrepFeedImageWithStorage(
  tripId: string,
  dependencies: ReplacePrepFeedImageDependencies
): Promise<PrepFeedLifecycleResult> {
  const replaced = await dependencies.replaceRowAndQueueCleanup();
  if (replaced.error) {
    dependencies.logError('prep-feed image replacement failed', replaced.error);
    return {
      ok: false,
      code: replaced.error.code === '42501' ? 'not_authorized' : 'database_operation_failed',
      error: 'The prep-feed image could not be replaced.',
    };
  }

  if (!replaced.oldStoragePath || !replaced.cleanupId) {
    return { ok: true, code: 'replaced' };
  }

  let paths: string[];
  try {
    paths = collectOwnedStoragePaths(tripId, [{ storage_path: replaced.oldStoragePath }]);
  } catch (error) {
    dependencies.logError('queued replacement path validation failed', error);
    return {
      ok: false,
      code: 'invalid_storage_path',
      error: 'The replacement succeeded, but the prior photo path needs administrator review.',
    };
  }

  const removed = await dependencies.removeStorage(paths);
  if (removed.error) {
    dependencies.logError('queued prior-image cleanup failed', removed.error);
    return {
      ok: false,
      code: 'partial_or_retryable_failure',
      error: 'The new image was saved. Cleanup of the prior image is queued and can be retried.',
      retryable: true,
    };
  }

  const completed = await dependencies.completeCleanup(replaced.cleanupId);
  if (completed.error) {
    dependencies.logError('cleanup job completion failed', completed.error);
    return {
      ok: false,
      code: 'partial_or_retryable_failure',
      error: 'The prior image was removed, but its cleanup receipt could not be completed.',
      retryable: true,
    };
  }

  return { ok: true, code: 'replaced' };
}
