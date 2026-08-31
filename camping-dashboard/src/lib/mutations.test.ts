import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const single = vi.fn();
  const select = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ upsert }));

  return { from, upsert, select, single };
});

vi.mock('./supabase', () => ({
  supabase: { from: supabaseMock.from },
}));

import { updateOfflineStatus } from './mutations';

describe('updateOfflineStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.single.mockResolvedValue({ data: null, error: null });
  });

  it('upserts only the requested confirmation so existing confirmations are preserved', async () => {
    await updateOfflineStatus('trip-1', { maps_cached: true });

    expect(supabaseMock.from).toHaveBeenCalledWith('offline_status');
    expect(supabaseMock.upsert).toHaveBeenCalledWith(
      { trip_id: 'trip-1', maps_cached: true },
      { onConflict: 'trip_id' }
    );
  });

  it('relies on database defaults when initializing an absent Field Prep record', async () => {
    await updateOfflineStatus('trip-1', {});

    expect(supabaseMock.upsert).toHaveBeenCalledWith(
      { trip_id: 'trip-1' },
      { onConflict: 'trip_id' }
    );
  });
});
