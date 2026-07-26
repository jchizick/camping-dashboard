'use client';

// ============================================================
// /trips/page.tsx — Trip List / Selector
// Shows all trips the authenticated user belongs to.
// App-shell page: defaults to Clean Light theme.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { ThemeProvider } from '@/lib/themeContext';
import { fetchUserTrips, type UserTrip } from '@/lib/fetchDashboard';
import { MapPin, Calendar, Plus, LogIn, Loader2 } from 'lucide-react';

// Default settings for app-shell pages (no trip context yet)
const APP_SHELL_SETTINGS = {
  trip_id: '',
  manual_theme_override: 'day' as const,
  preferred_units: 'metric' as const,
  show_astro: false,
  show_meals: false,
  show_offline: false,
  show_crew: false,
  theme_variant: 'clean' as const,
};

export default function TripsPage() {
  return (
    <AuthProvider>
      <ThemeProvider settings={APP_SHELL_SETTINGS}>
        <TripsContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

function TripsContent() {
  const { user, isLoading: authLoading, signIn } = useAuth();
  const [tripsState, setTripsState] = useState<{
    userId: string | null;
    trips: UserTrip[];
  }>({ userId: null, trips: [] });
  const router = useRouter();

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    fetchUserTrips()
      .then((data) => {
        if (!cancelled) setTripsState({ userId: user.id, trips: data });
      })
      .catch(() => {
        if (!cancelled) setTripsState({ userId: user.id, trips: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const trips = tripsState.userId === user?.id ? tripsState.trips : [];
  const isLoading = authLoading || Boolean(user && tripsState.userId !== user.id);

  // ── Not signed in ────────────────────────────────────────────────
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
          <button
            onClick={signIn}
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

  // ── Loading ──────────────────────────────────────────────────────
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
    <main className="min-h-screen bg-app-bg p-6 md:p-8 font-sans">
      <div className="max-w-[900px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 pb-6 border-b border-border-subtle">
          <div>
            <h1 className="text-text-main text-2xl font-bold">
              Your Trips
            </h1>
            <p className="text-text-muted text-sm mt-1">
              {trips.length} trip{trips.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => router.push('/trips/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]"
            style={{
              background: 'var(--accent-yellow)',
              color: 'white',
            }}
          >
            <Plus size={16} /> New Trip
          </button>
        </div>

        {/* Trip cards */}
        {trips.length === 0 ? (
          <div className="text-center py-16 px-8">
            <div className="text-5xl mb-4">🗺️</div>
            <p className="text-text-main text-lg mb-2 font-medium">No trips yet</p>
            <p className="text-text-muted text-sm">Create your first trip to get started.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {trips.map((trip) => (
              <button
                key={trip.id}
                onClick={() => router.push(`/trips/${trip.id}`)}
                className="flex justify-between items-center p-5 bg-card-bg border border-border-subtle rounded-xl cursor-pointer transition-all duration-200 text-left w-full hover:border-accent-yellow/30 hover:bg-card-hover hover:shadow-card group"
              >
                <div>
                  <h3 className="text-text-main text-lg font-semibold mb-1 group-hover:text-accent-yellow transition-colors">
                    {trip.name}
                  </h3>
                  <div className="flex flex-wrap gap-4 text-text-muted text-xs">
                    {trip.park_name && (
                      <span className="flex items-center gap-1.5">
                        <MapPin size={13} /> {trip.park_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} /> {trip.start_date} → {trip.end_date}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-medium uppercase tracking-wide px-2.5 py-1 rounded-full"
                    style={{
                      background: trip.role === 'owner'
                        ? 'color-mix(in srgb, var(--accent-yellow) 12%, transparent)'
                        : 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
                      color: trip.role === 'owner'
                        ? 'var(--accent-yellow)'
                        : 'var(--accent-blue)',
                      border: `1px solid ${trip.role === 'owner'
                        ? 'color-mix(in srgb, var(--accent-yellow) 25%, transparent)'
                        : 'color-mix(in srgb, var(--accent-blue) 25%, transparent)'}`,
                    }}
                  >
                    {trip.role}
                  </span>
                  <span className="text-text-muted text-lg group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
