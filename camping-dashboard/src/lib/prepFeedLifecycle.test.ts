import { describe, expect, it, vi } from 'vitest';
import {
  deletePrepFeedItemWithStorage,
  replacePrepFeedImageWithStorage,
  type DeletePrepFeedItemDependencies,
} from './prepFeedLifecycle';

function deleteDependencies(
  overrides: Partial<DeletePrepFeedItemDependencies> = {}
): DeletePrepFeedItemDependencies {
  return {
    authorize: vi.fn(async () => true),
    readItem: vi.fn(async () => ({
      item: { trip_id: 'trip-1', storage_path: 'trip-1/a.jpg' },
      error: null,
    })),
    countOtherReferences: vi.fn(async () => ({ count: 0, error: null })),
    removeStorage: vi.fn(async () => ({ error: null })),
    deleteRow: vi.fn(async () => ({ deleted: true, error: null })),
    logError: vi.fn(),
    ...overrides,
  };
}

describe('prep-feed item lifecycle', () => {
  it('removes an individually owned object before deleting its row', async () => {
    const deps = deleteDependencies();
    await expect(deletePrepFeedItemWithStorage('trip-1', deps)).resolves.toMatchObject({
      ok: true,
      code: 'deleted',
    });
    expect(deps.removeStorage).toHaveBeenCalledWith(['trip-1/a.jpg']);
    expect(deps.deleteRow).toHaveBeenCalledOnce();
  });

  it('does not remove external URLs or no-image items', async () => {
    for (const imageUrl of ['https://images.example/a.jpg', null]) {
      const deps = deleteDependencies({
        readItem: vi.fn(async () => ({
          item: { trip_id: 'trip-1', storage_path: null, image_url: imageUrl },
          error: null,
        })),
      });
      await deletePrepFeedItemWithStorage('trip-1', deps);
      expect(deps.removeStorage).not.toHaveBeenCalled();
      expect(deps.deleteRow).toHaveBeenCalledOnce();
    }
  });

  it('keeps a shared object when another row references it', async () => {
    const deps = deleteDependencies({
      countOtherReferences: vi.fn(async () => ({ count: 1, error: null })),
    });
    await deletePrepFeedItemWithStorage('trip-1', deps);
    expect(deps.removeStorage).not.toHaveBeenCalled();
    expect(deps.deleteRow).toHaveBeenCalledOnce();
  });

  it('leaves the row intact when storage deletion fails', async () => {
    const deps = deleteDependencies({
      removeStorage: vi.fn(async () => ({ error: { message: 'remove failed' } })),
    });
    await expect(deletePrepFeedItemWithStorage('trip-1', deps)).resolves.toMatchObject({
      ok: false,
      code: 'storage_cleanup_failed',
    });
    expect(deps.deleteRow).not.toHaveBeenCalled();
  });

  it('removes the prior uploaded object after image replacement', async () => {
    const removeStorage = vi.fn(async () => ({ error: null }));
    const completeCleanup = vi.fn(async () => ({ error: null }));
    await expect(replacePrepFeedImageWithStorage('trip-1', {
      replaceRowAndQueueCleanup: vi.fn(async () => ({
        oldStoragePath: 'trip-1/old.jpg',
        cleanupId: 'cleanup-1',
        error: null,
      })),
      removeStorage,
      completeCleanup,
      logError: vi.fn(),
    })).resolves.toMatchObject({ ok: true, code: 'replaced' });
    expect(removeStorage).toHaveBeenCalledWith(['trip-1/old.jpg']);
    expect(completeCleanup).toHaveBeenCalledWith('cleanup-1');
  });

  it('supports external-to-uploaded and no-image replacements without deleting external resources', async () => {
    const removeStorage = vi.fn(async () => ({ error: null }));
    await replacePrepFeedImageWithStorage('trip-1', {
      replaceRowAndQueueCleanup: vi.fn(async () => ({
        oldStoragePath: null,
        cleanupId: null,
        error: null,
      })),
      removeStorage,
      completeCleanup: vi.fn(async () => ({ error: null })),
      logError: vi.fn(),
    });
    expect(removeStorage).not.toHaveBeenCalled();
  });
});
