'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { getAuthErrorMessage } from '@/lib/authRedirect';
import { fetchUserTrips, type UserTrip } from '@/lib/fetchDashboard';
import { ThemeProvider } from '@/lib/themeContext';
import { resolveTripWorkspaceBackground } from '@/components/trip/tripWorkspaceVisuals';
import {
  canDeleteTrip,
  formatTripDates,
  getTripDuration,
  getTripHref,
  getTripLocation,
  getTripStatus,
  getUserFirstName,
  NEW_TRIP_HREF,
  selectFeaturedTrip,
} from '@/lib/tripsLanding';
import {
  ArrowRight,
  Backpack,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Compass,
  Ellipsis,
  LogIn,
  LogOut,
  Map,
  MapPin,
  Menu,
  Mountain,
  Plus,
  Route,
  Trash2,
  UserRound,
  X,
  Loader2,
} from 'lucide-react';

const TRIPS_LANDING_SETTINGS = {
  trip_id: '',
  manual_theme_override: 'day' as const,
  preferred_units: 'metric' as const,
  show_astro: false,
  show_meals: false,
  show_offline: false,
  show_crew: false,
  theme_variant: 'expedition' as const,
};

export default function TripsPage() {
  return (
    <AuthProvider>
      <ThemeProvider settings={TRIPS_LANDING_SETTINGS}>
        <TripsContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

function BrandMark() {
  return (
    <Link href="/trips" className="trips-brand" aria-label="Field Protocol — Trips">
      <span className="trips-brand__crest" aria-hidden="true"><Mountain size={20} /></span>
      <span className="trips-brand__name">Field Protocol</span>
    </Link>
  );
}

function GlobalNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="trips-global-nav" aria-label="Global navigation">
      <Link href="/trips" className="trips-global-nav__item trips-global-nav__item--active" aria-current="page" onClick={onNavigate}>
        <Mountain size={19} aria-hidden="true" /><span>Trips</span>
      </Link>
      <Link href={NEW_TRIP_HREF} className="trips-global-nav__item" onClick={onNavigate}>
        <Plus size={19} aria-hidden="true" /><span>New Trip</span>
      </Link>
      <button type="button" className="trips-global-nav__item" disabled title="Gear Closet is coming soon">
        <Backpack size={19} aria-hidden="true" /><span>Gear Closet</span><span className="trips-nav-note">Soon</span>
      </button>
      <button type="button" className="trips-global-nav__item" disabled title="Camper Guide is coming soon">
        <BookOpen size={19} aria-hidden="true" /><span>Camper Guide</span><span className="trips-nav-note">Soon</span>
      </button>
    </nav>
  );
}

function GlobalSidebar({ firstName, email, onSignOut }: { firstName: string; email?: string; onSignOut: () => Promise<void> }) {
  return (
    <aside className="trips-sidebar">
      <div className="trips-sidebar__inner">
        <BrandMark />
        <GlobalNav />
        <div className="trips-sidebar__footer">
          <div className="trips-profile">
            <span className="trips-profile__avatar" aria-hidden="true"><UserRound size={20} /></span>
            <span className="trips-profile__copy"><strong>{firstName}</strong><small>{email ?? 'Explorer'}</small></span>
          </div>
          <button type="button" className="trips-support" disabled title="Help and Support is coming soon">
            <CircleHelp size={18} aria-hidden="true" /> Help &amp; Support
          </button>
          <button type="button" className="trips-signout" onClick={onSignOut}>
            <LogOut size={18} aria-hidden="true" /> Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

function MobileHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="trips-mobile-header">
      <BrandMark />
      <button type="button" className="trips-icon-button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="global-mobile-navigation" aria-label={open ? 'Close navigation' : 'Open navigation'}>
        {open ? <X size={21} /> : <Menu size={21} />}
      </button>
      {open ? <div id="global-mobile-navigation" className="trips-mobile-menu"><GlobalNav onNavigate={() => setOpen(false)} /></div> : null}
    </header>
  );
}

function TripOverflow({ trip, deleting, onDelete }: { trip: UserTrip; deleting: boolean; onDelete: (trip: UserTrip) => void }) {
  if (!canDeleteTrip(trip)) return null;
  return (
    <details className="trips-overflow">
      <summary aria-label={`More actions for ${trip.name}`} title="More actions"><Ellipsis size={20} aria-hidden="true" /></summary>
      <div className="trips-overflow__menu">
        <button type="button" onClick={() => onDelete(trip)} disabled={deleting}>
          {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          Delete trip
        </button>
      </div>
    </details>
  );
}

function FeaturedTrip({ trip, deleting, onDelete }: { trip: UserTrip; deleting: boolean; onDelete: (trip: UserTrip) => void }) {
  const background = resolveTripWorkspaceBackground(trip);
  const duration = getTripDuration(trip.start_date, trip.end_date);
  const status = getTripStatus(trip.start_date, trip.end_date);
  return (
    <section className="trips-feature" aria-labelledby="featured-trip-title" style={background ? { backgroundImage: `url(${background})` } : undefined}>
      <div className="trips-feature__shade" aria-hidden="true" />
      <div className="trips-feature__topline">
        <span className="trips-feature__status"><Compass size={14} aria-hidden="true" /> {status.label} expedition</span>
        <div className="trips-feature__actions">
          <span className="trips-role"><UserRound size={15} aria-hidden="true" /> {trip.role}</span>
          <TripOverflow trip={trip} deleting={deleting} onDelete={onDelete} />
        </div>
      </div>
      <div className="trips-feature__content">
        <h2 id="featured-trip-title">{trip.name}</h2>
        <p className="trips-feature__location"><MapPin size={18} aria-hidden="true" /> {getTripLocation(trip)}</p>
        <div className="trips-feature__meta">
          <span><CalendarDays size={17} aria-hidden="true" /> {formatTripDates(trip.start_date, trip.end_date)}</span>
          {duration ? <span><Route size={17} aria-hidden="true" /> {duration}</span> : null}
        </div>
        <Link href={getTripHref(trip.id)} className="trips-primary-action">
          Continue Expedition <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

const utilityCards = [
  { title: 'Gear Closet', copy: 'Your equipment, essentials and saved gear.', icon: Backpack },
  { title: 'Camper Guide', copy: 'Getting started, camping basics and practical guides.', icon: BookOpen },
  { title: 'Field Resources', copy: 'Park information, safety references and useful tools.', icon: Map },
] as const;

function UtilityCards() {
  return (
    <section className="trips-utilities" aria-label="Camping resources">
      {utilityCards.map(({ title, copy, icon: Icon }) => (
        <div className="trips-utility" key={title}>
          <span className="trips-utility__icon" aria-hidden="true"><Icon size={27} /></span>
          <span className="trips-utility__copy"><strong>{title}</strong><small>{copy}</small></span>
          <span className="trips-utility__soon">Coming soon</span>
        </div>
      ))}
    </section>
  );
}

function ExpeditionRow({ trip, deleting, onDelete }: { trip: UserTrip; deleting: boolean; onDelete: (trip: UserTrip) => void }) {
  const background = resolveTripWorkspaceBackground(trip);
  const status = getTripStatus(trip.start_date, trip.end_date);
  const duration = getTripDuration(trip.start_date, trip.end_date);
  return (
    <article className="trips-expedition-row">
      <div className="trips-expedition-row__image" style={background ? { backgroundImage: `url(${background})` } : undefined} aria-hidden="true" />
      <div className="trips-expedition-row__identity">
        <div><h3>{trip.name}</h3><span className={`trips-status trips-status--${status.tone}`}>{status.label}</span></div>
        <p><MapPin size={14} aria-hidden="true" /> {getTripLocation(trip)}</p>
      </div>
      <div className="trips-expedition-row__dates">
        <small>Dates</small><strong>{formatTripDates(trip.start_date, trip.end_date)}</strong>{duration ? <span>{duration}</span> : null}
      </div>
      <div className="trips-expedition-row__role">
        <small>Access</small><strong>{trip.role}</strong>
      </div>
      <div className="trips-expedition-row__controls">
        <Link href={getTripHref(trip.id)}>{status.tone === 'complete' ? 'View Trip' : 'Continue'} <ArrowRight size={17} aria-hidden="true" /></Link>
        <TripOverflow trip={trip} deleting={deleting} onDelete={onDelete} />
      </div>
    </article>
  );
}

function TripsContent() {
  const { user, isLoading: authLoading, signIn, signOut } = useAuth();
  const [tripsState, setTripsState] = useState<{ userId: string | null; trips: UserTrip[] }>({ userId: null, trips: [] });
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [callbackError, setCallbackError] = useState<string | null>(null);

  useEffect(() => {
    setCallbackError(getAuthErrorMessage(new URLSearchParams(window.location.search).get('auth_error')));
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    fetchUserTrips()
      .then((data) => { if (!cancelled) setTripsState({ userId: user.id, trips: data }); })
      .catch(() => { if (!cancelled) setTripsState({ userId: user.id, trips: [] }); });
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const trips = tripsState.userId === user?.id ? tripsState.trips : [];
  const featuredTrip = selectFeaturedTrip(trips);
  const isLoading = authLoading || Boolean(user && tripsState.userId !== user.id);
  const firstName = getUserFirstName(user);

  async function handleDeleteTrip(trip: UserTrip) {
    if (deletingTripId) return;
    if (!window.confirm(`Delete "${trip.name}"? This also permanently deletes its prep-feed photos and cannot be undone.`)) return;
    setDeletingTripId(trip.id);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(trip.id)}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'The trip could not be deleted.');
      setTripsState((current) => ({ ...current, trips: current.trips.filter((candidate) => candidate.id !== trip.id) }));
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'The trip could not be deleted.');
    } finally {
      setDeletingTripId(null);
    }
  }

  async function handleSignIn() {
    setSignInError(null);
    try { await signIn(); } catch { setSignInError('Google sign-in could not be started. Please try again.'); }
  }

  if (!authLoading && !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-app-bg font-sans">
        <div className="text-center max-w-[420px] px-8 py-12">
          <div className="text-5xl mb-4">🏕️</div>
          <h1 className="text-text-main text-3xl font-bold mb-2 tracking-tight">
            Camping Dashboard
          </h1>
          <p className="text-text-muted text-base mb-8 leading-relaxed">
            Plan, pack, and prepare for your next outdoor adventure.
          </p>
          {(callbackError || signInError) && (
            <p
              role="alert"
              className="mb-5 rounded-lg border border-accent-red/30 bg-accent-red/10 p-3 text-sm text-accent-red"
            >
              {signInError ?? callbackError}
            </p>
          )}
          <button
            onClick={handleSignIn}
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 hover:shadow-lg active:scale-[0.98]"
            style={{
              background: 'var(--accent-yellow)',
              color: 'white',
            }}
          >
            <LogIn size={18} /> Sign in with Google
          </button>
        </div>
      </main>
    );
  }

  if (isLoading || authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="flex items-center gap-3 text-text-muted text-sm">
          <Loader2 size={18} className="animate-spin" />
          Loading trips...
        </div>
      </main>
    );
  }

  return (
    <main className="trips-landing">
      <GlobalSidebar firstName={firstName} email={user?.email} onSignOut={signOut} />
      <MobileHeader />
      <div className="trips-landing__main">
        <div className="trips-landing__canvas">
          <header className="trips-welcome">
            <div><h1>Welcome back, {firstName}</h1><p>Your next adventure is ready when you are. Continue your current trip, check your essentials, or start planning somewhere new.</p></div>
            <Link href={NEW_TRIP_HREF} className="trips-primary-action"><Plus size={19} aria-hidden="true" /> Plan a New Trip</Link>
          </header>

          {deleteError ? <p role="alert" className="trips-error">{deleteError}</p> : null}

          {featuredTrip ? (
            <>
              <FeaturedTrip trip={featuredTrip} deleting={deletingTripId === featuredTrip.id} onDelete={handleDeleteTrip} />
              <UtilityCards />
              <section className="trips-expeditions" aria-labelledby="expeditions-heading">
                <div className="trips-section-heading"><div><h2 id="expeditions-heading">Your Expeditions</h2><p>{trips.length} trip{trips.length === 1 ? '' : 's'} in your library</p></div></div>
                <div className="trips-expeditions__list">{trips.map((trip) => <ExpeditionRow key={trip.id} trip={trip} deleting={deletingTripId === trip.id} onDelete={handleDeleteTrip} />)}</div>
              </section>
            </>
          ) : (
            <section className="trips-empty" aria-labelledby="expeditions-heading">
              <span className="trips-empty__icon" aria-hidden="true"><Compass size={34} /></span>
              <h2 id="expeditions-heading">Your Expeditions</h2>
              <p>Every great trip starts with a place and a date.</p>
              <Link href={NEW_TRIP_HREF} className="trips-primary-action"><Plus size={19} aria-hidden="true" /> Plan Your First Trip</Link>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
