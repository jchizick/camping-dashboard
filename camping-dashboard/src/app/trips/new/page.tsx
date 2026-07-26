'use client';

import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { ThemeProvider } from '@/lib/themeContext';
import CampsiteMapSelector, { type CampsiteSelection } from '@/components/maps/CampsiteMapSelector';
import { ArrowLeft, Loader2, MapPin, Plus, RotateCcw } from 'lucide-react';

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

export default function NewTripPage() {
  return (
    <AuthProvider>
      <ThemeProvider settings={APP_SHELL_SETTINGS}>
        <NewTripContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

function NewTripContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [parkName, setParkName] = useState('');
  const [lakeName, setLakeName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [campsite, setCampsite] = useState<CampsiteSelection | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/trips');
  }, [authLoading, router, user]);

  const dateError = startDate && endDate && endDate < startDate
    ? 'End date cannot be before start date.'
    : null;

  const requirements = useMemo(() => {
    const missing: string[] = [];
    if (!name.trim()) missing.push('trip name');
    if (!startDate) missing.push('start date');
    if (!endDate) missing.push('end date');
    if (dateError) missing.push('valid date range');
    if (!campsite) missing.push('campsite location');
    return missing;
  }, [campsite, dateError, endDate, name, startDate]);

  const canSubmit = requirements.length === 0 && !isSubmitting;

  if (authLoading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="flex items-center gap-3 text-text-muted text-sm">
          <Loader2 size={18} className="animate-spin" />
          Loading…
        </div>
      </main>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || !campsite) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/trips/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          park_name: parkName.trim(),
          lake_name: lakeName.trim(),
          site_name: siteName.trim(),
          start_date: startDate,
          end_date: endDate,
          campsite_latitude: campsite.latitude,
          campsite_longitude: campsite.longitude,
          campsite_label: campsite.label,
          campsite_source: campsite.source,
          campsite_osm_id: campsite.osmId,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The trip could not be created.');
      if (typeof data.tripId !== 'string') throw new Error('Trip creation returned no trip ID.');

      router.push(`/trips/${data.tripId}`);
    } catch (submitError) {
      console.error('[CreateTripForm] Submission failed', submitError);
      setError(submitError instanceof Error ? submitError.message : 'The trip could not be created.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-app-bg p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-[1100px] mx-auto">
        <button
          type="button"
          onClick={() => router.push('/trips')}
          className="inline-flex items-center gap-1.5 text-text-muted text-sm bg-transparent border-none cursor-pointer mb-8 p-0 hover:text-text-main transition-colors"
        >
          <ArrowLeft size={14} /> Back to Trips
        </button>

        <h1 className="text-text-main text-2xl font-bold mb-2">Create New Trip</h1>
        <p className="text-text-muted text-sm mb-8 leading-relaxed">
          Add the trip details, then search and place the campsite marker precisely on the map.
        </p>

        {error && (
          <div
            className="p-3 mb-6 rounded-lg text-sm border"
            role="alert"
            style={{
              background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)',
              borderColor: 'color-mix(in srgb, var(--accent-red) 25%, transparent)',
              color: 'var(--accent-red)',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] gap-6 lg:gap-8 items-start">
          <section className="rounded-xl border border-border-subtle bg-card-bg p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="text-text-main text-lg font-semibold">Trip details</h2>
              <p className="mt-1 text-xs text-text-muted">Destination names remain editable trip details and are not replaced by map search results.</p>
            </div>

            <div>
              <label htmlFor="trip-name" className="block text-text-muted text-xs font-semibold uppercase tracking-wide mb-1.5">
                Trip Name *
              </label>
              <input
                id="trip-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Algonquin Backcountry"
                required
                className="w-full px-3.5 py-2.5 bg-app-bg border border-border-subtle rounded-lg text-text-main text-sm outline-none focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow/20 placeholder:text-text-muted/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="trip-start" className="block text-text-muted text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Start Date *
                </label>
                <input
                  id="trip-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-app-bg border border-border-subtle rounded-lg text-text-main text-sm outline-none focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow/20"
                />
              </div>
              <div>
                <label htmlFor="trip-end" className="block text-text-muted text-xs font-semibold uppercase tracking-wide mb-1.5">
                  End Date *
                </label>
                <input
                  id="trip-end"
                  type="date"
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                  aria-invalid={Boolean(dateError)}
                  className="w-full px-3.5 py-2.5 bg-app-bg border border-border-subtle rounded-lg text-text-main text-sm outline-none focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow/20"
                />
              </div>
            </div>
            {dateError && <p className="text-xs text-accent-red" role="alert">{dateError}</p>}

            <div>
              <label htmlFor="trip-park" className="block text-text-muted text-xs font-semibold uppercase tracking-wide mb-1.5">
                Park Name
              </label>
              <input
                id="trip-park"
                value={parkName}
                onChange={(event) => setParkName(event.target.value)}
                placeholder="e.g. Algonquin Provincial Park"
                className="w-full px-3.5 py-2.5 bg-app-bg border border-border-subtle rounded-lg text-text-main text-sm outline-none focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow/20 placeholder:text-text-muted/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="trip-lake" className="block text-text-muted text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Lake / Destination
                </label>
                <input
                  id="trip-lake"
                  value={lakeName}
                  onChange={(event) => setLakeName(event.target.value)}
                  placeholder="e.g. Maple Lake"
                  className="w-full px-3.5 py-2.5 bg-app-bg border border-border-subtle rounded-lg text-text-main text-sm outline-none focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow/20 placeholder:text-text-muted/50"
                />
              </div>
              <div>
                <label htmlFor="trip-site" className="block text-text-muted text-xs font-semibold uppercase tracking-wide mb-1.5">
                  Site
                </label>
                <input
                  id="trip-site"
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  placeholder="e.g. Site 4"
                  className="w-full px-3.5 py-2.5 bg-app-bg border border-border-subtle rounded-lg text-text-main text-sm outline-none focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow/20 placeholder:text-text-muted/50"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border-subtle bg-card-bg p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="flex items-center gap-2 text-text-main text-lg font-semibold">
                  <MapPin size={18} className="text-accent-blue" /> Campsite location *
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  Search for the area, then click the exact campsite. Click again or drag the marker to refine it.
                </p>
              </div>
              {campsite && (
                <button
                  type="button"
                  onClick={() => setCampsite(null)}
                  className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-main"
                >
                  <RotateCcw size={13} /> Reset selection
                </button>
              )}
            </div>

            <CampsiteMapSelector
              value={campsite}
              onChange={setCampsite}
              mapStyle="openstreetmap"
              className="h-[430px] min-h-[330px]"
            />

            <div className="mt-4 rounded-lg border border-border-subtle bg-app-bg/60 p-3 font-mono text-xs text-text-muted" aria-live="polite">
              {campsite ? (
                <>
                  Latitude <span className="text-text-main">{campsite.latitude.toFixed(6)}</span>
                  {' · '}
                  Longitude <span className="text-text-main">{campsite.longitude.toFixed(6)}</span>
                </>
              ) : (
                'No campsite selected yet.'
              )}
            </div>
          </section>

          <div className="lg:col-span-2">
            {requirements.length > 0 && (
              <p className="mb-3 text-sm text-text-muted" id="create-trip-requirements">
                To create this trip, add: <span className="text-text-main">{requirements.join(', ')}</span>.
              </p>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              aria-describedby={requirements.length ? 'create-trip-requirements' : undefined}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm transition-all hover:shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none bg-accent-yellow text-white"
            >
              {isSubmitting ? (
                <><Loader2 size={18} className="animate-spin" /> Creating trip…</>
              ) : (
                <><Plus size={18} /> Create Trip</>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
