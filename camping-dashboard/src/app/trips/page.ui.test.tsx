// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserTrip } from '@/lib/fetchDashboard';

const appMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  fetchUserTrips: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  auth: {
    user: { id: 'user-1', email: 'avery@example.com', user_metadata: { first_name: 'Avery' } } as Record<string, unknown> | null,
    isLoading: false,
  },
}));

vi.mock('next/navigation', () => ({useRouter:()=>({replace:appMocks.replace}),useSearchParams:()=>new URLSearchParams(window.location.search)}));

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
  SignedOutLanding: ({error,onSignIn}: {error?:string;onSignIn:()=>void}) => <main data-testid="signed-out-landing"><button onClick={onSignIn}>Sign in to Field Protocol</button>{error}</main>,
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
  window.history.replaceState({}, "", "/trips"); appMocks.replace.mockReset();
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


describe('Trips entry resolution', () => {
 it('preserves signed-out entry and sign-in action', () => {
  appMocks.auth.user=null; render(<TripsContent />);
  fireEvent.click(screen.getByRole('button',{name:'Sign in to Field Protocol'}));
  expect(appMocks.signIn).toHaveBeenCalledOnce(); expect(appMocks.fetchUserTrips).not.toHaveBeenCalled();
 });
 it('preserves callback errors', () => {
  appMocks.auth.user=null; window.history.replaceState({},'', '/trips?auth_error=cancelled');render(<TripsContent />);
  expect(screen.getByText(/Google sign-in was cancelled/)).toBeTruthy();
 });
 it('does not mount the old dashboard while loading', () => {
  appMocks.fetchUserTrips.mockReturnValue(new Promise(()=>{}));const {container}=render(<TripsContent />);
  expect(screen.getByRole('status')).toBeTruthy();expect(container.querySelector('.trips-feature')).toBeNull();expect(screen.queryByText('Gear Closet')).toBeNull();
 });
 it('replaces successful empty results with first-trip creation', async () => {
  render(<TripsContent />);await waitFor(()=>expect(appMocks.replace).toHaveBeenCalledWith('/trips/new'));
  expect(appMocks.fetchUserTrips).toHaveBeenCalledWith('user-1');
 });
 it.each([
  [{...populatedTrip,id:'past',start_date:'2000-01-01',end_date:'2000-01-02'},{...populatedTrip,id:'active',start_date:'2001-01-01',end_date:'2099-01-01'}],
  [{...populatedTrip,id:'far',start_date:'2099-02-01',end_date:'2099-02-02'},{...populatedTrip,id:'near',start_date:'2099-01-01',end_date:'2099-01-02'}],
  [{...populatedTrip,id:'old',start_date:'1999-01-01',end_date:'1999-01-02'},{...populatedTrip,id:'recent',start_date:'2000-01-01',end_date:'2000-01-02'}]
 ])('uses canonical ranking rather than first list order', async (first,second) => {
  appMocks.fetchUserTrips.mockResolvedValue([first,second]);render(<TripsContent />);
  await waitFor(()=>expect(appMocks.replace).toHaveBeenCalledWith('/trips/'+second.id));
 });
 it('keeps all unrankable trips selectable without auto-navigation', async () => {
  const name='A long expedition name '.repeat(12);
  appMocks.fetchUserTrips.mockResolvedValue([{...populatedTrip,name,start_date:'invalid'},{...populatedTrip,id:'second',name:'Second',end_date:'invalid'}]);
  render(<TripsContent />);await screen.findByRole('heading',{name:'Choose a trip'});
  expect(screen.getByRole('link',{name:new RegExp(name.trim())}).getAttribute('href')).toBe('/trips/trip-1');
  expect(screen.getByRole('link',{name:/Second/}).getAttribute('href')).toBe('/trips/second');
  expect(screen.getByRole('link',{name:'New Trip'})).toBeTruthy();expect(appMocks.replace).not.toHaveBeenCalled();
  expect(screen.queryByText('Coming soon')).toBeNull();
 });
 it('keeps source errors distinct and retries only the list', async () => {
  appMocks.fetchUserTrips.mockRejectedValueOnce(new Error('source failed')).mockResolvedValueOnce([populatedTrip]);render(<TripsContent />);
  await screen.findByRole('heading',{name:'Trips unavailable'});expect(appMocks.replace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Retry loading trips'}));
  await waitFor(()=>expect(appMocks.replace).toHaveBeenCalledWith('/trips/trip-1'));
  expect(appMocks.fetchUserTrips).toHaveBeenCalledTimes(2);expect(appMocks.signOut).not.toHaveBeenCalled();
 });
 it.each(['','/plan','/gear','/crew','/guide'])('honors authorized explicit section %s', async section=>{
  window.history.replaceState({},'', '/trips?'+new URLSearchParams({next:'/trips/trip-1'+section+'?intent=pack'}));
  appMocks.fetchUserTrips.mockResolvedValue([populatedTrip]);render(<TripsContent />);
  await waitFor(()=>expect(appMocks.replace).toHaveBeenCalledWith('/trips/trip-1'+section+'?intent=pack'));
 });
 it.each(['https://evil.example','//evil.example','/%ZZ'])('ignores unsafe next %s', async next=>{
  window.history.replaceState({},'', '/trips?'+new URLSearchParams({next}));render(<TripsContent />);
  await waitFor(()=>expect(appMocks.replace).toHaveBeenCalledWith('/trips/new'));
 });
 it('terminates a denied explicit destination in recovery', async ()=>{
  window.history.replaceState({},'', '/trips?next=%2Ftrips%2Fdenied%2Fgear');
  appMocks.fetchUserTrips.mockResolvedValue([populatedTrip]);render(<TripsContent />);
  await screen.findByRole('heading',{name:'Trip unavailable'});expect(appMocks.replace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Open my trips'}));expect(appMocks.replace).toHaveBeenCalledWith('/trips');
 });
 it('preserves actual unauthenticated recovery', async()=>{
  appMocks.fetchUserTrips.mockRejectedValue(new UserTripsFetchError('unauthenticated','session expired'));render(<TripsContent />);
  await waitFor(()=>expect(appMocks.signOut).toHaveBeenCalledOnce());expect(appMocks.replace).not.toHaveBeenCalled();
 });
});
