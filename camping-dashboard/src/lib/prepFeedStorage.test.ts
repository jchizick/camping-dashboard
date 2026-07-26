import { describe, expect, it, vi } from 'vitest';
import { removeStoragePathsIdempotently } from './prepFeedStorage';

describe('removeStoragePathsIdempotently', () => {
  it('succeeds when all expected objects are already absent', async () => {
    const remove = vi.fn(async () => ({ error: null }));
    await expect(removeStoragePathsIdempotently(
      ['trip-1/a.jpg', 'trip-1/b.jpg'],
      {
        exists: vi.fn(async () => ({ exists: false, error: null })),
        remove,
      }
    )).resolves.toEqual({ error: null });
    expect(remove).not.toHaveBeenCalled();
  });

  it('removes only the remaining object when one was already removed', async () => {
    const remove = vi.fn(async () => ({ error: null }));
    await expect(removeStoragePathsIdempotently(
      ['trip-1/absent.jpg', 'trip-1/present.jpg'],
      {
        exists: vi.fn(async (path) => ({
          exists: path.endsWith('present.jpg'),
          error: null,
        })),
        remove,
      }
    )).resolves.toEqual({ error: null });
    expect(remove).toHaveBeenCalledWith(['trip-1/present.jpg']);
  });

  it('does not let an already-absent cleanup-queue object block deletion', async () => {
    const remove = vi.fn(async () => ({ error: null }));
    await expect(removeStoragePathsIdempotently(
      ['trip-1/replaced-old.jpg'],
      {
        exists: vi.fn(async () => ({ exists: false, error: null })),
        remove,
      }
    )).resolves.toEqual({ error: null });
    expect(remove).not.toHaveBeenCalled();
  });

  it('accepts a remove error only when a follow-up proves the object is absent', async () => {
    let check = 0;
    await expect(removeStoragePathsIdempotently(
      ['trip-1/raced.jpg'],
      {
        exists: vi.fn(async () => ({ exists: check++ === 0, error: null })),
        remove: vi.fn(async () => ({ error: { message: 'not found' } })),
      }
    )).resolves.toEqual({ error: null });
  });
});
