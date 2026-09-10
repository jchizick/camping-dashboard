'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { getAuthErrorMessage, getSafeNextPath } from '@/lib/authRedirect';
import { fetchUserTrips, UserTripsFetchError, type UserTrip } from '@/lib/fetchDashboard';
import { resolveDefaultTrip } from '@/lib/defaultTripResolver';
import { ThemeProvider } from '@/lib/themeContext';
import { APP_SHELL_SETTINGS } from '@/lib/appShellSettings';
import { SignedOutLanding } from '@/components/trips/SignedOutLanding';
import AuthenticatedTripsLoader from '@/components/trips/AuthenticatedTripsLoader';
import { formatTripDates, getTripHref, getTripLocation } from '@/lib/tripsLanding';

type Resolution =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'denied' }
  | { status: 'chooser'; trips: UserTrip[] }
  | { status: 'redirect'; path: string };

export default function TripsPage() {
  return <AuthProvider><ThemeProvider settings={APP_SHELL_SETTINGS}>
    <Suspense fallback={<AuthenticatedTripsLoader />}><TripsContent /></Suspense>
  </ThemeProvider></AuthProvider>;
}

export function TripsContent() {
  const { user, isLoading: authLoading, signIn, signOut } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = getSafeNextPath(params.get('next'));
  const callbackError = getAuthErrorMessage(params.get('auth_error'));
  const userId = user?.id;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ userId: string; next: string | null; result: Resolution } | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !userId) return;
    let cancelled = false;
    void fetchUserTrips(userId).then(trips => {
      if (cancelled) return;
      const nextUrl = next ? new URL(next, 'https://app.invalid') : null;
      let result: Resolution;
      // /trips is this resolver, never a recursive explicit destination.
      if (nextUrl && nextUrl.pathname !== '/trips' && nextUrl.pathname !== '/auth/callback') {
        const match = /^\/trips\/([^/]+)/.exec(nextUrl.pathname);
        let requestedId: string | null = null;
        try { requestedId = match ? decodeURIComponent(match[1]) : null; } catch { /* rejected below */ }
        result = match && requestedId !== 'new' && !trips.some(trip => trip.id === requestedId)
          ? { status: 'denied' }
          : { status: 'redirect', path: next! };
      } else {
        const resolved = resolveDefaultTrip(trips, new Date());
        result = resolved.status === 'resolved'
          ? { status: 'redirect', path: getTripHref(resolved.trip.id) }
          : resolved.status === 'no-trips'
            ? { status: 'redirect', path: '/trips/new' }
            : { status: 'chooser', trips };
      }
      setState({ userId, next, result });
    }).catch((error: unknown) => {
      if (cancelled) return;
      if (error instanceof UserTripsFetchError && error.kind === 'unauthenticated') {
        void signOut();
        return;
      }
      setState({ userId, next, result: { status: 'error' } });
    });
    return () => { cancelled = true; };
  }, [authLoading, userId, next, attempt, signOut]);

  const result: Resolution = state?.userId === userId && state?.next === next
    ? state.result : { status: 'loading' };
  const redirectPath = result.status === 'redirect' ? result.path : null;
  useEffect(() => {
    if (!authLoading && userId && redirectPath) router.replace(redirectPath);
  }, [authLoading, userId, redirectPath, router]);

  async function handleSignIn() {
    setSignInError(null);
    try { await signIn(); } catch { setSignInError('Google sign-in could not be started. Please try again.'); }
  }
  function retry() {
    if (result.status !== 'error') return;
    setState(null);
    setAttempt(value => value + 1);
  }
  if (!authLoading && !user) return <SignedOutLanding error={signInError ?? callbackError} onSignIn={handleSignIn} />;
  if (authLoading || result.status === 'loading' || result.status === 'redirect') return <AuthenticatedTripsLoader />;

  return <main className="relative z-10 flex min-h-[100dvh] items-center justify-center px-5 py-12" data-entry-flow="trips-resolution">
    <section className="trip-workspace-state-panel w-full max-w-xl p-6" aria-labelledby="trips-resolution-heading">
      <p className="trip-workspace-state-panel__copy text-sm font-semibold">Field Protocol</p>
      <h1 id="trips-resolution-heading" className="trip-workspace-state-panel__title mt-3 text-2xl">
        {result.status === 'error' ? 'Trips unavailable' : result.status === 'denied' ? 'Trip unavailable' : 'Choose a trip'}
      </h1>
      {result.status === 'error' ? <>
        <p className="trip-workspace-state-panel__copy mt-3">We couldn’t load your trips. Your account is still signed in. Check your connection and try again.</p>
        <button type="button" className="trip-workspace-state-panel__action mt-4 inline-flex rounded border px-4 py-3 text-sm font-semibold" onClick={retry}>Retry loading trips</button>
      </> : result.status === 'denied' ? <>
        <p className="trip-workspace-state-panel__copy mt-3">The requested trip is not in your authorized trips.</p>
        <button type="button" className="trip-workspace-state-panel__action mt-4 inline-flex rounded border px-4 py-3 text-sm font-semibold" onClick={() => router.replace('/trips')}>Open my trips</button>
      </> : <>
        <p className="trip-workspace-state-panel__copy mt-3">Your trip dates need attention. Choose which trip to open.</p>
        <ul className="mt-4 space-y-3">
          {result.trips.map(trip => <li key={trip.id} className="min-w-0">
            <Link href={getTripHref(trip.id)} className="block rounded border border-border-subtle p-3 focus-visible:outline-2 focus-visible:outline-offset-2">
              <strong className="block break-words">{trip.name}</strong>
              <span className="trip-workspace-state-panel__copy block text-sm">{getTripLocation(trip)} · {formatTripDates(trip.start_date, trip.end_date)}</span>
            </Link>
          </li>)}
        </ul>
        <Link href="/trips/new" className="trip-workspace-state-panel__action mt-4 inline-flex rounded border px-4 py-3 text-sm font-semibold">New Trip</Link>
      </>}
      <button type="button" className="mt-4 block text-sm underline" onClick={() => void signOut()}>Sign out</button>
    </section>
  </main>;
}
