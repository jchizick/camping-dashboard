import {
  collectOwnedStoragePaths,
  InvalidPrepFeedStoragePathError,
  type PrepFeedStorageReference,
} from './prepFeedStorage';

export type TripDeletionCode =
  | 'deleted'
  | 'not_authenticated'
  | 'not_owner'
  | 'trip_not_found'
  | 'storage_cleanup_failed'
  | 'database_deletion_failed'
  | 'partial_or_retryable_failure';

export interface TripDeletionResult {
  ok: boolean;
  code: TripDeletionCode;
  error?: string;
  retryable?: boolean;
  removedObjects?: number;
}

interface OperationError {
  code?: string;
  message: string;
}

export interface TripDeletionDependencies {
  begin(): Promise<{ token: string | null; error: OperationError | null }>;
  listPrepFeedReferences(): Promise<{
    references: PrepFeedStorageReference[] | null;
    error: OperationError | null;
  }>;
  removeStorage(paths: string[]): Promise<{ error: OperationError | null }>;
  complete(token: string): Promise<{ deleted: boolean; error: OperationError | null }>;
  logError(message: string, detail: unknown): void;
}

function beginFailure(error: OperationError): TripDeletionResult {
  if (error.code === '42501') {
    return { ok: false, code: 'not_owner', error: 'Only the trip owner can delete this trip.' };
  }
  if (error.code === 'P0002') {
    return { ok: false, code: 'trip_not_found', error: 'Trip not found.' };
  }
  return {
    ok: false,
    code: 'database_deletion_failed',
    error: 'The trip could not be prepared for deletion.',
    retryable: true,
  };
}

export async function deleteTripWithPrepFeed(
  tripId: string,
  dependencies: TripDeletionDependencies
): Promise<TripDeletionResult> {
  const begun = await dependencies.begin();
  if (begun.error || !begun.token) {
    if (begun.error) dependencies.logError('begin trip deletion failed', begun.error);
    return beginFailure(begun.error ?? { message: 'No deletion token returned' });
  }

  const listed = await dependencies.listPrepFeedReferences();
  if (listed.error || !listed.references) {
    dependencies.logError('prep-feed reference lookup failed', listed.error);
    return {
      ok: false,
      code: 'database_deletion_failed',
      error: 'The trip is pending deletion, but its prep-feed references could not be read. Retry deletion.',
      retryable: true,
    };
  }

  let paths: string[];
  try {
    paths = collectOwnedStoragePaths(tripId, listed.references);
  } catch (error) {
    dependencies.logError('prep-feed path validation failed', error);
    if (error instanceof InvalidPrepFeedStoragePathError) {
      return {
        ok: false,
        code: 'storage_cleanup_failed',
        error: 'A prep-feed photo has an invalid storage path. No database rows were deleted.',
      };
    }
    throw error;
  }

  if (paths.length > 0) {
    const removed = await dependencies.removeStorage(paths);
    if (removed.error) {
      dependencies.logError('storage cleanup failed or may be partial', removed.error);
      return {
        ok: false,
        code: 'partial_or_retryable_failure',
        error: 'Photo cleanup did not finish. The trip remains pending deletion; retry to continue safely.',
        retryable: true,
      };
    }
  }

  const completed = await dependencies.complete(begun.token);
  if (completed.error || !completed.deleted) {
    if (completed.error?.code === 'P0002') {
      return { ok: true, code: 'deleted', removedObjects: paths.length };
    }
    dependencies.logError('database deletion failed after storage cleanup', completed.error);
    return {
      ok: false,
      code: 'database_deletion_failed',
      error: 'Photos were handled, but the trip row could not be deleted. Retry to finish deletion.',
      retryable: true,
      removedObjects: paths.length,
    };
  }

  return { ok: true, code: 'deleted', removedObjects: paths.length };
}
