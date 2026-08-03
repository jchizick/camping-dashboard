import type { TripDashboard } from '@/types';
import { CalendarDays, MapPin, MoonStar, Route } from 'lucide-react';

function dateOrdinal(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatTripDates(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate} – ${endDate}`;
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
    })} – ${end.getDate()}, ${end.getFullYear()}`;
  }

  const startLabel = start.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
  const endLabel = end.toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}

function tripStatus(trip: TripDashboard, now: Date) {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (today < dateOrdinal(trip.start_date)) {
    return { label: 'Trip is approaching', tone: 'warning' } as const;
  }
  if (today > dateOrdinal(trip.end_date)) {
    return { label: 'Trip complete', tone: 'positive' } as const;
  }
  return { label: 'Trip is underway', tone: 'active' } as const;
}

export default function TripHero({
  trip,
  tripDays,
  now = new Date(),
}: {
  trip: TripDashboard;
  tripDays: number;
  now?: Date;
}) {
  const campsite = [trip.lake_name, trip.site_name].filter(Boolean).join(' · ');
  const nights = Math.max(tripDays - 1, 0);
  const status = tripStatus(trip, now);

  return (
    <section className="trip-hero" aria-labelledby="trip-hero-title">
      <div className="trip-hero__content">
        <p className="trip-hero__status" data-tone={status.tone}>
          <Route size={15} aria-hidden="true" />
          {status.label}
        </p>
        <h1 id="trip-hero-title" tabIndex={-1} className="trip-hero__title">
          {trip.name}
        </h1>
        <p className="trip-hero__location">
          <MapPin size={18} aria-hidden="true" />
          {campsite || trip.park_name || 'Campsite unavailable'}
        </p>
        <div className="trip-hero__meta">
          <span>
            <CalendarDays size={16} aria-hidden="true" />
            {formatTripDates(trip.start_date, trip.end_date)}
          </span>
          <span>
            <MoonStar size={16} aria-hidden="true" />
            {tripDays} day{tripDays === 1 ? '' : 's'} · {nights} night
            {nights === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </section>
  );
}
