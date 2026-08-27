'use client';

import React, { useState } from 'react';
import type { CampsiteSelection } from './CampsiteMapSelector';
import { Check, MapPinned } from 'lucide-react';

interface CoordinateValidation {
  value: number | null;
  error: string | null;
}

export function validateCoordinate(
  rawValue: string,
  coordinate: 'latitude' | 'longitude'
): CoordinateValidation {
  const label = coordinate === 'latitude' ? 'Latitude' : 'Longitude';
  const minimum = coordinate === 'latitude' ? -90 : -180;
  const maximum = coordinate === 'latitude' ? 90 : 180;
  const normalized = rawValue.trim();

  if (!normalized) return { value: null, error: `${label} is required.` };

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return { value: null, error: `${label} must be a valid decimal number.` };
  }
  if (value < minimum || value > maximum) {
    return {
      value: null,
      error: `${label} must be between ${minimum} and ${maximum}.`,
    };
  }

  return { value, error: null };
}

export default function ManualCampsiteEntry({
  value,
  suggestedLabel,
  onApply,
}: {
  value: CampsiteSelection | null;
  suggestedLabel?: string | null;
  onApply: (selection: CampsiteSelection) => void;
}) {
  const [latitude, setLatitude] = useState(
    value ? String(value.latitude) : ''
  );
  const [longitude, setLongitude] = useState(
    value ? String(value.longitude) : ''
  );
  const [latitudeError, setLatitudeError] = useState<string | null>(null);
  const [longitudeError, setLongitudeError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function applyCoordinates() {
    const nextLatitude = validateCoordinate(latitude, 'latitude');
    const nextLongitude = validateCoordinate(longitude, 'longitude');
    setLatitudeError(nextLatitude.error);
    setLongitudeError(nextLongitude.error);
    setSaved(false);

    if (nextLatitude.value === null || nextLongitude.value === null) return;

    onApply({
      latitude: nextLatitude.value,
      longitude: nextLongitude.value,
      label: suggestedLabel?.trim() || value?.label || null,
      source: 'manual_map_selection',
      osmId: null,
    });
    setSaved(true);
  }

  return (
    <section
      id="manual-campsite-entry"
      className="manual-campsite-entry mt-4 rounded-xl border border-border-subtle bg-app-bg/60 p-4"
      aria-labelledby="manual-campsite-title"
    >
      <div className="flex items-start gap-3">
        <MapPinned size={19} className="mt-0.5 shrink-0 text-accent-blue" aria-hidden="true" />
        <div>
          <h3 id="manual-campsite-title" className="text-sm font-semibold text-text-main">
            Enter coordinates manually
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Use decimal coordinates for the campsite. The map can be unavailable and the trip will still use this exact location.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="manual-campsite-latitude" className="block text-xs font-semibold text-text-muted">
            Latitude
          </label>
          <input
            id="manual-campsite-latitude"
            type="number"
            inputMode="decimal"
            min={-90}
            max={90}
            step="any"
            autoFocus
            value={latitude}
            onChange={(event) => {
              setLatitude(event.target.value);
              setLatitudeError(null);
              setSaved(false);
            }}
            aria-invalid={Boolean(latitudeError)}
            aria-describedby={latitudeError ? 'manual-campsite-latitude-error' : undefined}
            className="manual-campsite-entry__input mt-1.5 w-full rounded-lg border border-border-subtle bg-card-bg px-3.5 py-2.5 text-sm text-text-main outline-none focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow/20"
          />
          {latitudeError ? (
            <p id="manual-campsite-latitude-error" className="mt-1.5 text-xs text-accent-red" role="alert">
              {latitudeError}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="manual-campsite-longitude" className="block text-xs font-semibold text-text-muted">
            Longitude
          </label>
          <input
            id="manual-campsite-longitude"
            type="number"
            inputMode="decimal"
            min={-180}
            max={180}
            step="any"
            value={longitude}
            onChange={(event) => {
              setLongitude(event.target.value);
              setLongitudeError(null);
              setSaved(false);
            }}
            aria-invalid={Boolean(longitudeError)}
            aria-describedby={longitudeError ? 'manual-campsite-longitude-error' : undefined}
            className="manual-campsite-entry__input mt-1.5 w-full rounded-lg border border-border-subtle bg-card-bg px-3.5 py-2.5 text-sm text-text-main outline-none focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow/20"
          />
          {longitudeError ? (
            <p id="manual-campsite-longitude-error" className="mt-1.5 text-xs text-accent-red" role="alert">
              {longitudeError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={applyCoordinates}
          className="manual-campsite-entry__action inline-flex min-h-11 items-center justify-center rounded-lg bg-accent-blue px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-blue/90"
        >
          Use these coordinates
        </button>
        {saved ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-accent-green" role="status">
            <Check size={14} aria-hidden="true" /> Location ready
          </p>
        ) : null}
      </div>
    </section>
  );
}
