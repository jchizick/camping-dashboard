'use client';

import React, { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { ThemeProvider } from '@/lib/themeContext';
import { fetchUserTrips } from '@/lib/fetchDashboard';
import { resolveDefaultTrip } from '@/lib/defaultTripResolver';
import { getNewTripOrigin } from '@/lib/newTripNavigation';
import { APP_SHELL_SETTINGS } from '@/lib/appShellSettings';
import CampsiteMapSelector, { type CampsiteSelection } from '@/components/maps/CampsiteMapSelector';
import ManualCampsiteEntry from '@/components/maps/ManualCampsiteEntry';
import AuthenticatedTripsLoader from '@/components/trips/AuthenticatedTripsLoader';
import { ArrowLeft, Loader2, MapPin, Plus, RotateCcw } from 'lucide-react';
import { PhoneLayoutProvider, usePhoneLayout } from '@/components/trip/PhoneLayoutProvider';
import { AccountIdentity } from '@/components/trip/WorkspaceAccount';
import './desktopCreateTrip.css';

export default function NewTripPage() {
  return (
    <AuthProvider>
      <ThemeProvider settings={APP_SHELL_SETTINGS}>
        <Suspense fallback={<AuthenticatedTripsLoader />}><NewTripContent /></Suspense>
      </ThemeProvider>
    </AuthProvider>
  );
}

export function NewTripContent() {
  return <PhoneLayoutProvider><NewTripForm /></PhoneLayoutProvider>;
}

function NewTripForm() {
  const isPhoneLayout = usePhoneLayout();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const origin = getNewTripOrigin(params.get('from'));
  const userId = user?.id;
  const [returnTrip, setReturnTrip] = useState<{ userId: string; path: string | null; failed: boolean } | null>(null);
  useEffect(() => {
    if (origin || !userId || authLoading) return;
    let active = true;
    void fetchUserTrips(userId).then((trips) => {
      const result = resolveDefaultTrip(trips, new Date());
      // Unrankable existing trips terminate at the /trips chooser.
      const path = result.status === 'resolved' ? getNewTripOrigin('/trips/' + result.trip.id)
        : result.status === 'chooser-required' ? '/trips' : null;
      if (active) setReturnTrip({ userId, path, failed: false });
    }).catch(() => { if (active) setReturnTrip({ userId, path: null, failed: true }); });
    return () => { active = false; };
  }, [authLoading, origin, userId]);
  const cancelPath = origin ?? (returnTrip?.userId === userId ? returnTrip?.path : null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [parkName, setParkName] = useState('');
  const [lakeName, setLakeName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [campsite, setCampsite] = useState<CampsiteSelection | null>(null);
  const [manualLocationOpen, setManualLocationOpen] = useState(false);

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

  function openManualLocation() {
    setManualLocationOpen(true);
    requestAnimationFrame(() => {
      document.getElementById('manual-campsite-latitude')?.focus();
    });
  }

  if (authLoading || !user) {
    return <AuthenticatedTripsLoader />;
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

      router.replace(`/trips/${encodeURIComponent(data.tripId)}`);
    } catch (submitError) {
      console.error('[CreateTripForm] Submission failed', submitError);
      setError(submitError instanceof Error ? submitError.message : 'The trip could not be created.');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="trip-create" data-entry-flow="create-trip" data-desktop-create-trip={!isPhoneLayout ? '' : undefined}>
      <div className="trip-create__canvas">
        <header className="trip-create__header">
          {isPhoneLayout && cancelPath && <button type="button" onClick={() => router.replace(cancelPath)} disabled={isSubmitting} className="trip-create__back">
            <ArrowLeft size={16} aria-hidden="true" /> Cancel
          </button>}
          {isPhoneLayout ? <button type="button" onClick={() => void signOut()} disabled={isSubmitting} className="trip-create__back">Sign out</button> : (
            <div className="trip-create__utility">
              <div className="trip-create__brand"><Image src="/logo.svg" alt="" width={28} height={35} /><span>FIELD PROTOCOL</span></div>
              <div className="trip-create__account"><AccountIdentity /><button type="button" onClick={() => void signOut()} disabled={isSubmitting} className="trip-create__back">Sign out</button></div>
            </div>
          )}
          {!origin && returnTrip?.userId === userId && returnTrip?.failed && <p role="status">Your return trip could not be loaded. You can still create a trip or sign out.</p>}

          <div className="trip-create__identity">
            {isPhoneLayout && <p>Field Protocol</p>}
            <h1 data-mobile-type-role="page-title">Create Trip</h1>
            <span>Set the basics now. You can refine the plan later.</span>
          </div>
        </header>

        {error && (
          <div
            className="trip-create__error"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="trip-create__form">
          <section className="trip-create__surface trip-create__details" aria-labelledby="trip-details-heading">
            <div className="trip-create__section-heading">
              <h2 id="trip-details-heading">Trip details</h2>
              <p>Destination names stay editable and are not replaced by map search results.</p>
            </div>

            <div className="trip-create__field">
              <label htmlFor="trip-name" className="trip-create__label">
                Trip Name *
              </label>
              <input
                id="trip-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Algonquin Backcountry"
                required
                className="trip-create__input"
              />
            </div>

            <div className="trip-create__field-grid">
              <div className="trip-create__field">
                <label htmlFor="trip-start" className="trip-create__label">
                  Start Date *
                </label>
                <input
                  id="trip-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                  className="trip-create__input"
                />
              </div>
              <div className="trip-create__field">
                <label htmlFor="trip-end" className="trip-create__label">
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
                  aria-describedby={dateError ? 'trip-end-error' : undefined}
                  className="trip-create__input"
                />
              </div>
            </div>
            {dateError && <p id="trip-end-error" className="trip-create__field-error" role="alert">{dateError}</p>}

            <div className="trip-create__field">
              <label htmlFor="trip-park" className="trip-create__label">
                Park Name
              </label>
              <input
                id="trip-park"
                value={parkName}
                onChange={(event) => setParkName(event.target.value)}
                placeholder="e.g. Algonquin Provincial Park"
                className="trip-create__input"
              />
            </div>

            <div className="trip-create__field-grid trip-create__destination-fields">
              <div className="trip-create__field">
                <label htmlFor="trip-lake" className="trip-create__label">
                  Lake / Destination
                </label>
                <input
                  id="trip-lake"
                  value={lakeName}
                  onChange={(event) => setLakeName(event.target.value)}
                  placeholder="e.g. Maple Lake"
                  className="trip-create__input"
                />
              </div>
              <div className="trip-create__field">
                <label htmlFor="trip-site" className="trip-create__label">
                  Site
                </label>
                <input
                  id="trip-site"
                  value={siteName}
                  onChange={(event) => setSiteName(event.target.value)}
                  placeholder="e.g. Site 4"
                  className="trip-create__input"
                />
              </div>
            </div>
          </section>

          <section className="trip-create__surface trip-create__location" aria-labelledby="campsite-location-heading">
            <div className="trip-create__section-heading trip-create__section-heading--map">
              <div>
                <h2 id="campsite-location-heading">
                  <MapPin size={18} className="text-accent-blue" /> Campsite location *
                </h2>
                <p>
                  Search and place the campsite on the map, or enter exact coordinates manually.
                </p>
              </div>
              {campsite && (
                <button
                  type="button"
                  onClick={() => setCampsite(null)}
                  className="trip-create__reset"
                >
                  <RotateCcw size={13} /> Reset selection
                </button>
              )}
            </div>

            <CampsiteMapSelector
              value={campsite}
              onChange={setCampsite}
              mapStyle={isPhoneLayout ? 'openstreetmap' : 'expedition'}
              liveMapStyle
              desktopChrome={!isPhoneLayout}
              className="trip-create__map"
              onManualEntry={openManualLocation}
            />

            <button
              type="button"
              onClick={openManualLocation}
              aria-expanded={manualLocationOpen}
              aria-controls="manual-campsite-entry"
              className="trip-create__manual-toggle"
            >
              Enter coordinates manually
            </button>

            {manualLocationOpen ? (
              <ManualCampsiteEntry
                value={campsite}
                suggestedLabel={siteName || lakeName || parkName || null}
                onApply={setCampsite}
              />
            ) : null}

            <div className="trip-create__location-summary" aria-live="polite">
              {campsite ? (
                <>
                  Latitude <span className="text-text-main">{campsite.latitude.toFixed(6)}</span>
                  {' · '}
                  Longitude <span className="text-text-main">{campsite.longitude.toFixed(6)}</span>
                </>
              ) : (
                <span className="trip-create__location-empty">No campsite selected yet.</span>
              )}
            </div>
          </section>

          <div className="trip-create__submit-region">
            {requirements.length > 0 && (
              <p className="trip-create__requirements" id="create-trip-requirements">
                To create this trip, add: <strong>{requirements.join(', ')}</strong>.
              </p>
            )}
            <div className="trip-create__footer-actions">
              {!isPhoneLayout && cancelPath && <button type="button" onClick={() => router.replace(cancelPath)} disabled={isSubmitting} className="trip-create__cancel">Cancel</button>}
              <button
                type="submit"
                disabled={!canSubmit}
                aria-describedby={requirements.length ? 'create-trip-requirements' : undefined}
                className="trip-create__submit"
              >
                {isSubmitting ? (
                  <><Loader2 size={18} className="animate-spin" /> Creating trip…</>
                ) : (
                  <><Plus size={18} /> Create Trip</>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
