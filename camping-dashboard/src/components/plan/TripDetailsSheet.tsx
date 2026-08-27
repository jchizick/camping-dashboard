'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { TripDashboard, TripDetailsUpdate } from '@/types';
import { getTripDuration } from '@/lib/tripDuration';
import CrudSheet from '@/components/ui/CrudSheet';
import {
  draftValuesEqual,
  useTripDraftForm,
} from '@/components/trip/useTripDraftForm';

interface TripDetailsSheetProps {
  isOpen: boolean;
  trip: TripDashboard;
  latestPlannedDay: number;
  onClose: () => void;
  onSubmit: (details: TripDetailsUpdate) => Promise<void>;
}

function formFromTrip(trip: TripDashboard): TripDetailsUpdate {
  return {
    park_name: trip.park_name ?? '',
    lake_name: trip.lake_name ?? '',
    site_name: trip.site_name ?? '',
    start_date: trip.start_date,
    end_date: trip.end_date,
  };
}

function trimNullable(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}

export default function TripDetailsSheet({
  isOpen,
  trip,
  latestPlannedDay,
  onClose,
  onSubmit,
}: TripDetailsSheetProps) {
  const draftId = React.useId();
  const initialForm = useMemo(() => formFromTrip(trip), [trip]);
  const [form, setForm] = useState<TripDetailsUpdate>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm(initialForm);
    setError(null);
  }, [initialForm, isOpen]);

  const { close, saved } = useTripDraftForm({
    id: `trip-details-${draftId}`,
    isOpen,
    isDirty: !draftValuesEqual(form, initialForm),
    onClose,
    onDiscard: () => setForm(initialForm),
  });

  function set<K extends keyof TripDetailsUpdate>(
    key: K,
    value: TripDetailsUpdate[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const duration = getTripDuration(form.start_date, form.end_date);
    if (!duration) {
      setError('End date must be on or after the start date.');
      return;
    }
    if (duration.days < latestPlannedDay) {
      setError(
        `Plans already exist on Day ${latestPlannedDay}. Extend the date range before shortening the trip.`
      );
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        park_name: trimNullable(form.park_name),
        lake_name: trimNullable(form.lake_name),
        site_name: trimNullable(form.site_name),
        start_date: form.start_date,
        end_date: form.end_date,
      });
      saved();
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'The trip details could not be saved.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <CrudSheet
      isOpen={isOpen}
      onClose={close}
      title="Edit trip details"
      surface="workspace"
    >
      <form className="crud-form" onSubmit={handleSubmit} noValidate>
        <div className="crud-form__field">
          <label className="crud-form__label" htmlFor="plan-park-name">
            Park / region
          </label>
          <input
            id="plan-park-name"
            className="crud-form__input"
            value={form.park_name ?? ''}
            onChange={(event) => set('park_name', event.target.value)}
            placeholder="e.g. Algonquin Provincial Park"
          />
        </div>

        <div className="crud-form__row">
          <div className="crud-form__field">
            <label className="crud-form__label" htmlFor="plan-destination">
              Destination
            </label>
            <input
              id="plan-destination"
              className="crud-form__input"
              value={form.lake_name ?? ''}
              onChange={(event) => set('lake_name', event.target.value)}
              placeholder="e.g. Maple Lake"
            />
          </div>
          <div className="crud-form__field">
            <label className="crud-form__label" htmlFor="plan-campsite">
              Campsite / site
            </label>
            <input
              id="plan-campsite"
              className="crud-form__input"
              value={form.site_name ?? ''}
              onChange={(event) => set('site_name', event.target.value)}
              placeholder="e.g. Site 4"
            />
          </div>
        </div>

        <div className="crud-form__row">
          <div className="crud-form__field">
            <label className="crud-form__label" htmlFor="plan-start-date">
              Start date
            </label>
            <input
              id="plan-start-date"
              className="crud-form__input"
              type="date"
              value={form.start_date}
              onChange={(event) => set('start_date', event.target.value)}
              required
            />
          </div>
          <div className="crud-form__field">
            <label className="crud-form__label" htmlFor="plan-end-date">
              End date
            </label>
            <input
              id="plan-end-date"
              className="crud-form__input"
              type="date"
              min={form.start_date || undefined}
              value={form.end_date}
              onChange={(event) => set('end_date', event.target.value)}
              required
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'plan-details-error' : undefined}
            />
          </div>
        </div>

        {latestPlannedDay > 1 ? (
          <p className="crud-form__hint">
            Current itinerary and meals extend through Day {latestPlannedDay}.
          </p>
        ) : null}

        {error ? (
          <p id="plan-details-error" className="crud-form__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="crud-form__actions">
          <button
            type="button"
            className="crud-form__btn crud-form__btn--cancel"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="crud-form__btn crud-form__btn--save"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </form>
    </CrudSheet>
  );
}
