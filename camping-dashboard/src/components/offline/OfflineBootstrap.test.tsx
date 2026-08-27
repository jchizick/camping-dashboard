// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readOfflineTrip: vi.fn(),
}));

vi.mock('@/lib/tripRepository', () => ({
  tripRepository: { readOfflineTrip: mocks.readOfflineTrip },
}));
vi.mock('@/lib/authContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/lib/tripContext', () => ({
  TripProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/trip/TripDraftGuardProvider', () => ({
  TripDraftGuardProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/trip/TripWorkspaceProvider', () => ({
  TripWorkspaceProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/trip/TripAppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="shared-trip-shell">{children}</div>
  ),
}));
vi.mock('@/components/DashboardShell', () => ({ default: () => <h1>Home destination</h1> }));
vi.mock('@/app/trips/[tripId]/plan/page', () => ({ default: () => <h1>Plan destination</h1> }));
vi.mock('@/app/trips/[tripId]/gear/page', () => ({ default: () => <h1>Gear destination</h1> }));
vi.mock('@/app/trips/[tripId]/crew/page', () => ({ default: () => <h1>Crew destination</h1> }));
vi.mock('@/app/trips/[tripId]/guide/page', () => ({ default: () => <h1>Field destination</h1> }));

import OfflineBootstrap from './OfflineBootstrap';

const available = {
  status: 'available',
  identity: {
    projectNamespace: 'https://project.supabase.co',
    activeUserId: 'user-a',
    lastVerifiedAt: '2026-08-24T12:00:00.000Z',
    shellPreparedAt: '2026-08-24T12:01:00.000Z',
  },
  workspace: {
    source: 'cache',
    data: { trip: { id: 'trip-1' } },
    verifiedRole: 'owner',
  },
};

beforeEach(() => {
  mocks.readOfflineTrip.mockReset();
  window.history.replaceState({}, '', '/offline?target=%2Ftrips%2Ftrip-1%2Fgear');
});

afterEach(cleanup);

describe('OfflineBootstrap', () => {
  it('hydrates a valid target through the shared shell and destination component', async () => {
    mocks.readOfflineTrip.mockResolvedValue(available);
    render(<OfflineBootstrap />);
    expect(await screen.findByTestId('shared-trip-shell')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Gear destination' })).toBeTruthy();
    expect(mocks.readOfflineTrip).toHaveBeenCalledWith({
      tripId: 'trip-1',
      requirePreparedShell: true,
    });
  });

  it.each([
    ['no-identity', 'Trip not available offline'],
    ['wrong-trip', 'Trip not available offline'],
    ['expired', 'Reconnect to verify access'],
    ['no-snapshot', 'Saved trip needs to be refreshed'],
  ] as const)('keeps private trip content hidden for %s', async (status, heading) => {
    mocks.readOfflineTrip.mockResolvedValue({
      status,
      identity: null,
      workspace: null,
    });
    render(<OfflineBootstrap />);
    expect(await screen.findByRole('heading', { name: heading })).toBeTruthy();
    expect(screen.queryByTestId('shared-trip-shell')).toBeNull();
  });

  it('rejects unsupported destination paths before reading private storage', async () => {
    window.history.replaceState({}, '', '/offline?target=%2Ftrips%2Ftrip-1%2Ffield-log');
    render(<OfflineBootstrap />);
    expect(
      await screen.findByRole('heading', { name: 'Trip not available offline' })
    ).toBeTruthy();
    await waitFor(() => expect(mocks.readOfflineTrip).not.toHaveBeenCalled());
  });
});
