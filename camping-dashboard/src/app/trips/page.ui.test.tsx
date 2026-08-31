// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmptyTripsState, TripsWelcome } from '@/components/trips/TripsLandingOnboarding';
import type { UserTrip } from '@/lib/fetchDashboard';

const appMocks = vi.hoisted(() => ({
  fetchUserTrips: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  auth: {
    user: { id: 'user-1', email: 'avery@example.com', user_metadata: { first_name: 'Avery' } } as Record<string, unknown> | null,
    isLoading: false,
  },
}));

vi.mock('@/lib/authContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    ...appMocks.auth,
    signIn: appMocks.signIn,
    signOut: appMocks.signOut,
  }),
}));

vi.mock('@/lib/fetchDashboard', () => {
  class UserTripsFetchError extends Error {
    constructor(
      readonly kind: 'unauthenticated' | 'forbidden' | 'unavailable',
      message: string
    ) {
      super(message);
      this.name = 'UserTripsFetchError';
    }
  }

  return {
    fetchUserTrips: appMocks.fetchUserTrips,
    UserTripsFetchError,
  };
});

vi.mock('@/components/trip/tripWorkspaceVisuals', () => ({
  resolveTripWorkspaceBackground: () => null,
}));

vi.mock('@/components/trips/SignedOutLanding', () => ({
  SignedOutLanding: () => <main data-testid="signed-out-landing">Sign in to Field Protocol</main>,
}));

import { TripsContent } from './page';
import { UserTripsFetchError } from '@/lib/fetchDashboard';

const populatedTrip = {
  id: 'trip-1',
  name: 'Killarney Base Camp',
  start_date: '2026-09-12',
  end_date: '2026-09-15',
  park_name: 'Killarney Provincial Park',
  lake_name: null,
  site_name: null,
  campsite_label: null,
  role: 'owner',
} as UserTrip;

beforeEach(() => {
  appMocks.fetchUserTrips.mockReset();
  appMocks.fetchUserTrips.mockResolvedValue([]);
  appMocks.signIn.mockReset();
  appMocks.signOut.mockReset();
  appMocks.signOut.mockResolvedValue(undefined);
  appMocks.auth.user = {
    id: 'user-1',
    email: 'avery@example.com',
    user_metadata: { first_name: 'Avery' },
  };
  appMocks.auth.isLoading = false;
});

afterEach(cleanup);

describe('Trips landing onboarding states', () => {
  it('uses first-time copy and one primary creation CTA when there are no trips', () => {
    render(
      <>
        <TripsWelcome firstName="Avery" hasTrips={false} />
        <EmptyTripsState />
      </>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Plan your first trip' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).getAttribute('data-mobile-type-role'))
      .toBe('page-title');
    expect(screen.getByText(/don’t have a trip yet/i)).toBeTruthy();
    const actions = screen.getAllByRole('link', { name: 'Plan your first trip' });
    expect(actions).toHaveLength(1);
    expect(actions[0].getAttribute('href')).toBe('/trips/new');
    expect(screen.queryByText('Your Expeditions')).toBeNull();
  });

  it('preserves returning-user copy and the new-trip action for populated accounts', () => {
    render(<TripsWelcome firstName="Avery" hasTrips />);

    expect(screen.getByRole('heading', { level: 1, name: 'Your Trips' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).getAttribute('data-mobile-type-role'))
      .toBe('page-title');
    expect(screen.getByText(/welcome back, Avery/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Plan a New Trip' }).getAttribute('href'))
      .toBe('/trips/new');
    expect(screen.queryByText(/don’t have a trip yet/i)).toBeNull();
  });
});

describe('authenticated Trips source states', () => {
  it('uses the shared branded loader while authentication is resolving', () => {
    appMocks.auth.isLoading = true;

    const { container } = render(<TripsContent />);

    expect(screen.getByRole('status').textContent).toContain('PREPARING BASE CAMP…');
    expect(container.querySelector('[data-authenticated-trips-loader]')).toBeTruthy();
    expect(appMocks.fetchUserTrips).not.toHaveBeenCalled();
  });

  it('renders first-trip onboarding only after a successful empty result', async () => {
    render(<TripsContent />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Plan your first trip' })).toBeTruthy();
    expect(appMocks.fetchUserTrips).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders the returning Trips library after a successful populated result', async () => {
    appMocks.fetchUserTrips.mockResolvedValue([populatedTrip]);

    render(<TripsContent />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Your Trips' })).toBeTruthy();
    expect(screen.getAllByText('Killarney Base Camp')).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'Trip dates: Sep 12 – Sep 15, 2026' }).textContent)
      .toContain('Sep 12–15');
    expect(screen.getByRole('group', { name: 'Trip duration: 4 days · 3 nights' }).textContent)
      .toContain('4 days3 nights');
    expect(screen.queryByRole('heading', { name: 'Plan your first trip' })).toBeNull();
  });

  it('renders a truthful unavailable state without first-trip onboarding on source failure', async () => {
    appMocks.fetchUserTrips.mockRejectedValue(
      new UserTripsFetchError('unavailable', 'Trip source unavailable')
    );

    const { container } = render(<TripsContent />);

    const unavailable = await screen.findByRole('alert');
    expect(unavailable.textContent).toContain('Trips unavailable');
    expect(unavailable.textContent).toContain('Your account is still signed in');
    expect(container.querySelector('[data-trip-list-state="unavailable"]')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Plan your first trip' })).toBeNull();
    expect(screen.getByText('Avery')).toBeTruthy();
  });

  it('retries the source read without caching the failure as a valid empty result', async () => {
    appMocks.fetchUserTrips
      .mockRejectedValueOnce(new UserTripsFetchError('unavailable', 'Trip source unavailable'))
      .mockResolvedValueOnce([]);

    render(<TripsContent />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry loading trips' }));

    await waitFor(() => expect(appMocks.fetchUserTrips).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('heading', { level: 1, name: 'Plan your first trip' })).toBeTruthy();
  });

  it('preserves existing authentication behavior for anonymous and explicitly invalid sessions', async () => {
    appMocks.auth.user = null;
    const anonymous = render(<TripsContent />);

    expect(screen.getByTestId('signed-out-landing')).toBeTruthy();
    expect(appMocks.fetchUserTrips).not.toHaveBeenCalled();
    anonymous.unmount();

    appMocks.auth.user = {
      id: 'user-1',
      email: 'avery@example.com',
      user_metadata: { first_name: 'Avery' },
    };
    appMocks.fetchUserTrips.mockRejectedValue(
      new UserTripsFetchError('unauthenticated', 'Session expired')
    );

    render(<TripsContent />);

    await waitFor(() => expect(appMocks.signOut).toHaveBeenCalledOnce());
    expect(screen.queryByText('Trips unavailable')).toBeNull();
  });
});
