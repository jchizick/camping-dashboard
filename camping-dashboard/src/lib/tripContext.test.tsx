// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TripRepositoryResult } from './tripRepository';

const mocks = vi.hoisted(() => ({
  identity: { userId: 'user-1', source: 'local' as const },
  getUser: vi.fn(),
  membership: vi.fn(),
  readOfflineTrip: vi.fn(),
  clearUserCache: vi.fn(),
  clearCachedTrip: vi.fn(),
}));

vi.mock('./authContext', () => ({
  useAuth: () => ({
    user: null,
    identity: mocks.identity,
    isLoading: false,
  }),
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        single: mocks.membership,
      };
      return query;
    },
  },
}));

vi.mock('./tripRepository', () => ({
  tripRepository: {
    readOfflineTrip: mocks.readOfflineTrip,
    clearUserCache: mocks.clearUserCache,
    clearCachedTrip: mocks.clearCachedTrip,
  },
}));

vi.mock('./dashboardMapper', () => ({
  toTripMemberRole: (role: string) => role,
}));

import { TripProvider, useTrip } from './tripContext';

const savedWorkspace = {
  source: 'cache',
  data: { trip: { id: 'trip-1' } },
  cachedAt: '2026-08-24T12:00:00.000Z',
  lastOnlineVerifiedAt: '2026-08-24T12:00:00.000Z',
  verifiedRole: 'editor',
  snapshotRevision: 'revision-1',
  cacheWriteOutcome: 'stored',
} as unknown as TripRepositoryResult;

function Probe() {
  const trip = useTrip();
  return (
    <div>
      <span data-testid="source">{trip.verificationSource ?? 'none'}</span>
      <span data-testid="role">{trip.role ?? 'none'}</span>
      <span data-testid="edit">{trip.canEdit ? 'yes' : 'no'}</span>
      <span data-testid="error">{trip.error ?? ''}</span>
      <button type="button" onClick={() => void trip.revalidateAccess()}>
        Revalidate
      </button>
    </div>
  );
}

describe('TripProvider offline authorization policy', () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.membership.mockReset();
    mocks.readOfflineTrip.mockReset();
    mocks.clearUserCache.mockReset().mockResolvedValue(undefined);
    mocks.clearCachedTrip.mockReset().mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('falls back to an eligible cached role only for an auth transport failure', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Failed to fetch' },
    });
    mocks.readOfflineTrip.mockResolvedValue({
      status: 'available',
      identity: { activeUserId: 'user-1' },
      workspace: savedWorkspace,
    });

    render(<TripProvider tripId="trip-1"><Probe /></TripProvider>);

    await waitFor(() => expect(screen.getByTestId('source').textContent).toBe('cache'));
    expect(screen.getByTestId('role').textContent).toBe('editor');
    expect(screen.getByTestId('edit').textContent).toBe('no');
  });

  it('honors an explicit membership denial and clears only that saved trip', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.membership.mockResolvedValue({
      data: null,
      error: { status: 403, message: 'Forbidden' },
    });

    render(<TripProvider tripId="trip-1"><Probe /></TripProvider>);

    await waitFor(() =>
      expect(screen.getByTestId('error').textContent).toContain('not a member')
    );
    expect(mocks.clearCachedTrip).toHaveBeenCalledWith({
      userId: 'user-1',
      tripId: 'trip-1',
    });
    expect(mocks.readOfflineTrip).not.toHaveBeenCalled();
  });

  it('fails closed on explicit membership denial even when cache cleanup fails', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.membership.mockResolvedValue({
      data: null,
      error: { status: 403, message: 'Forbidden' },
    });
    mocks.clearCachedTrip.mockRejectedValue(new Error('IndexedDB unavailable'));
    mocks.readOfflineTrip.mockResolvedValue({
      status: 'available',
      identity: { activeUserId: 'user-1' },
      workspace: savedWorkspace,
    });

    render(<TripProvider tripId="trip-1"><Probe /></TripProvider>);

    await waitFor(() =>
      expect(screen.getByTestId('error').textContent).toContain('not a member')
    );
    expect(screen.getByTestId('source').textContent).toBe('none');
    expect(screen.getByTestId('edit').textContent).toBe('no');
    expect(mocks.readOfflineTrip).not.toHaveBeenCalled();
  });

  it('promotes a cached role to editable only after fresh auth and membership checks', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mocks.membership.mockResolvedValue({ data: { role: 'editor' }, error: null });

    render(
      <TripProvider tripId="trip-1" initialCachedWorkspace={savedWorkspace}>
        <Probe />
      </TripProvider>
    );
    expect(screen.getByTestId('source').textContent).toBe('cache');
    expect(screen.getByTestId('edit').textContent).toBe('no');

    fireEvent.click(screen.getByRole('button', { name: 'Revalidate' }));
    await waitFor(() => expect(screen.getByTestId('source').textContent).toBe('online'));
    expect(screen.getByTestId('edit').textContent).toBe('yes');
  });
});
