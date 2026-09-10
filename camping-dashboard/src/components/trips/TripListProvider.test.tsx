// @vitest-environment jsdom
import React, { useLayoutEffect } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserTrip } from '@/lib/fetchDashboard';
const mocks = vi.hoisted(() => ({ user: { id: 'a' } as { id: string } | null, fetch: vi.fn() }));
vi.mock('@/lib/authContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/lib/fetchDashboard', () => ({ fetchUserTrips: mocks.fetch }));
import { TripListProvider, useTripList } from './TripListProvider';
let api: ReturnType<typeof useTripList>;
function Consumer() {
  const value = useTripList();
  useLayoutEffect(() => { api = value; }, [value]);
  return <div>{value.status}:{value.trips.map((trip) => trip.id).join(',')}</div>;
}
const row = { id: 'trip-a', role: 'viewer' } as UserTrip;
beforeEach(() => { mocks.user = { id: 'a' }; mocks.fetch.mockReset(); });
afterEach(cleanup);
describe('user-scoped trip list', () => {
  it('loads independently on demand and preserves membership roles', async () => {
    mocks.fetch.mockResolvedValue([row]);
    render(<TripListProvider><Consumer /></TripListProvider>);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(screen.getByText('idle:')).toBeTruthy();
    await act(() => api.reload());
    expect(mocks.fetch).toHaveBeenCalledWith('a');
    expect(api.trips[0].role).toBe('viewer');
    expect(api.status).toBe('ready');
  });
  it('distinguishes successful empty, errors, and retry', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([]);
    render(<TripListProvider><Consumer /></TripListProvider>);
    await act(async () => { await api.reload().catch(() => {}); });
    expect(api.status).toBe('error');
    expect(api.error).toContain('Trips unavailable');
    await act(() => api.reload());
    expect(api.status).toBe('ready');
    expect(api.trips).toEqual([]);
  });
  it('deduplicates concurrent requests and exposes loading', async () => {
    let finish!: (trips: UserTrip[]) => void;
    mocks.fetch.mockReturnValue(new Promise<UserTrip[]>((resolve) => { finish = resolve; }));
    render(<TripListProvider><Consumer /></TripListProvider>);
    let a!: Promise<readonly UserTrip[]>;
    act(() => { a = api.reload(); expect(api.reload()).toBe(a); });
    expect(api.status).toBe('loading');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    await act(async () => { finish([row]); await a; });
  });
  it('clears summaries synchronously on account change and rejects stale completion', async () => {
    let finish!: (trips: UserTrip[]) => void;
    mocks.fetch.mockResolvedValueOnce([row]).mockReturnValueOnce(new Promise<UserTrip[]>((resolve) => { finish = resolve; })).mockResolvedValueOnce([{ ...row, id: 'trip-b' }]);
    const view = render(<TripListProvider><Consumer /></TripListProvider>);
    await act(() => api.reload());
    let old!: Promise<unknown>;
    act(() => { old = api.reload().catch(() => {}); });
    mocks.user = { id: 'b' };
    view.rerender(<TripListProvider><Consumer /></TripListProvider>);
    expect(api.trips).toEqual([]);
    await act(async () => { finish([row]); await old; await api.reload(); });
    expect(api.trips.map((trip) => trip.id)).toEqual(['trip-b']);
    mocks.user = null;
    view.rerender(<TripListProvider><Consumer /></TripListProvider>);
    expect(api.trips).toEqual([]);
  });
  it('invalidates an in-flight request before reloading', async () => {
    let finish!: (trips: UserTrip[]) => void;
    mocks.fetch.mockReturnValueOnce(new Promise<UserTrip[]>((resolve) => { finish = resolve; })).mockResolvedValueOnce([]);
    render(<TripListProvider><Consumer /></TripListProvider>);
    let old!: Promise<unknown>;
    act(() => { old = api.reload().catch(() => {}); api.invalidate(); });
    await act(async () => { await api.reload(); finish([row]); await old; });
    expect(api.status).toBe('ready');
    expect(api.trips).toEqual([]);
  });
});
