import { describe, expect, it, vi } from 'vitest';
import { deleteTripWithPrepFeed, type TripDeletionDependencies } from './tripDeletion';

function dependencies(
  overrides: Partial<TripDeletionDependencies> = {}
): TripDeletionDependencies {
  return {
    begin: vi.fn(async () => ({ token: 'token-1', error: null })),
    listPrepFeedReferences: vi.fn(async () => ({ references: [], error: null })),
    removeStorage: vi.fn(async () => ({ error: null })),
    complete: vi.fn(async () => ({ deleted: true, error: null })),
    logError: vi.fn(),
    ...overrides,
  };
}

describe('deleteTripWithPrepFeed', () => {
  it('allows an owner operation and deletes a trip with no prep-feed items', async () => {
    const deps = dependencies();
    await expect(deleteTripWithPrepFeed('trip-1', deps)).resolves.toMatchObject({
      ok: true,
      code: 'deleted',
      removedObjects: 0,
    });
    expect(deps.removeStorage).not.toHaveBeenCalled();
  });

  it('rejects editor/viewer-style authorization failures', async () => {
    const deps = dependencies({
      begin: vi.fn(async () => ({
        token: null,
        error: { code: '42501', message: 'Only owner' },
      })),
    });
    await expect(deleteTripWithPrepFeed('trip-1', deps)).resolves.toMatchObject({
      ok: false,
      code: 'not_owner',
    });
    expect(deps.removeStorage).not.toHaveBeenCalled();
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it('returns not found when the trip does not exist', async () => {
    const deps = dependencies({
      begin: vi.fn(async () => ({
        token: null,
        error: { code: 'P0002', message: 'Trip not found' },
      })),
    });
    await expect(deleteTripWithPrepFeed('missing-trip', deps)).resolves.toMatchObject({
      ok: false,
      code: 'trip_not_found',
    });
  });

  it('removes one or multiple uploaded objects', async () => {
    const deps = dependencies({
      listPrepFeedReferences: vi.fn(async () => ({
        references: [
          { storage_path: 'trip-1/a.jpg', image_url: 'https://example.test/a.jpg' },
          { storage_path: 'trip-1/user/b.jpg', image_url: 'https://example.test/b.jpg' },
        ],
        error: null,
      })),
    });
    await deleteTripWithPrepFeed('trip-1', deps);
    expect(deps.removeStorage).toHaveBeenCalledWith(['trip-1/a.jpg', 'trip-1/user/b.jpg']);
  });

  it('does not send external URLs or no-image items to Storage remove', async () => {
    const deps = dependencies({
      listPrepFeedReferences: vi.fn(async () => ({
        references: [
          { storage_path: null, image_url: 'https://images.example/photo.jpg' },
          { storage_path: null, image_url: null },
        ],
        error: null,
      })),
    });
    await deleteTripWithPrepFeed('trip-1', deps);
    expect(deps.removeStorage).not.toHaveBeenCalled();
  });

  it('prevents database deletion when storage cleanup fails', async () => {
    const deps = dependencies({
      listPrepFeedReferences: vi.fn(async () => ({
        references: [{ storage_path: 'trip-1/a.jpg' }],
        error: null,
      })),
      removeStorage: vi.fn(async () => ({ error: { message: 'storage unavailable' } })),
    });
    await expect(deleteTripWithPrepFeed('trip-1', deps)).resolves.toMatchObject({
      ok: false,
      code: 'partial_or_retryable_failure',
      retryable: true,
    });
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it('returns a clear retryable result when database deletion fails after storage', async () => {
    const deps = dependencies({
      complete: vi.fn(async () => ({
        deleted: false,
        error: { message: 'database unavailable' },
      })),
    });
    await expect(deleteTripWithPrepFeed('trip-1', deps)).resolves.toMatchObject({
      ok: false,
      code: 'database_deletion_failed',
      retryable: true,
    });
  });

  it('completes on retry after final database deletion previously failed', async () => {
    let completionAttempts = 0;
    let objectExists = true;
    const removeStorage = vi.fn(async (paths: string[]) => {
      void paths;
      objectExists = false;
      return { error: null };
    });
    const deps = dependencies({
      listPrepFeedReferences: vi.fn(async () => ({
        references: [{ storage_path: 'trip-1/a.jpg' }],
        error: null,
      })),
      removeStorage: vi.fn(async (paths) => {
        if (!objectExists) return { error: null };
        return removeStorage(paths);
      }),
      complete: vi.fn(async () => {
        completionAttempts += 1;
        return completionAttempts === 1
          ? { deleted: false, error: { message: 'database unavailable' } }
          : { deleted: true, error: null };
      }),
    });

    await expect(deleteTripWithPrepFeed('trip-1', deps)).resolves.toMatchObject({
      ok: false,
      code: 'database_deletion_failed',
    });
    await expect(deleteTripWithPrepFeed('trip-1', deps)).resolves.toMatchObject({
      ok: true,
      code: 'deleted',
    });
    expect(removeStorage).toHaveBeenCalledOnce();
  });

  it('treats a concurrent duplicate that already completed as idempotent success', async () => {
    const deps = dependencies({
      complete: vi.fn(async () => ({
        deleted: false,
        error: { code: 'P0002', message: 'Trip not found' },
      })),
    });
    await expect(deleteTripWithPrepFeed('trip-1', deps)).resolves.toMatchObject({
      ok: true,
      code: 'deleted',
    });
  });

  it('rejects storage paths outside the trip namespace', async () => {
    const deps = dependencies({
      listPrepFeedReferences: vi.fn(async () => ({
        references: [{ storage_path: 'trip-2/a.jpg' }],
        error: null,
      })),
    });
    await expect(deleteTripWithPrepFeed('trip-1', deps)).resolves.toMatchObject({
      ok: false,
      code: 'storage_cleanup_failed',
    });
    expect(deps.removeStorage).not.toHaveBeenCalled();
    expect(deps.complete).not.toHaveBeenCalled();
  });
});
