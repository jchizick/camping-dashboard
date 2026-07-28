'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { TripDashboard } from '@/types';
import { CalendarDays, MapPin, MoonStar, Route } from 'lucide-react';

const ALGONQUIN_HERO_IMAGE = '/sunset-over-the-lake.webp';

function normalizedIdentity(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase('en-CA') ?? '';
}

export function resolveTripHeroImage(
  trip: Pick<TripDashboard, 'park_name' | 'lake_name'>
): string | null {
  const park = normalizedIdentity(trip.park_name);
  const lake = normalizedIdentity(trip.lake_name);
  const isAlgonquin =
    park === 'algonquin park' || park === 'algonquin provincial park';
  const isApprovedLake = lake === 'maple lake' || lake === 'maple leaf lake';
  return isAlgonquin && isApprovedLake ? ALGONQUIN_HERO_IMAGE : null;
}

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
  if (today < dateOrdinal(trip.start_date)) return 'Trip is approaching';
  if (today > dateOrdinal(trip.end_date)) return 'Trip complete';
  return 'Trip is underway';
}

export default function TripHero({
  trip,
  tripDays,
  imageSrc = null,
  now = new Date(),
}: {
  trip: TripDashboard;
  tripDays: number;
  imageSrc?: string | null;
  now?: Date;
}) {
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  const campsite = [trip.lake_name, trip.site_name].filter(Boolean).join(' · ');
  const nights = Math.max(tripDays - 1, 0);
  const showImage = Boolean(imageSrc) && failedImageSrc !== imageSrc;

  return (
    <section className="trip-hero" aria-labelledby="trip-hero-title">
      <div className="trip-hero__media" aria-hidden="true">
        {showImage ? (
          <Image
            src={imageSrc!}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) calc(100vw - 24px), (max-width: 1600px) calc(100vw - 48px), 1536px"
            className="trip-hero__image"
            data-testid="trip-hero-image"
            onError={() => setFailedImageSrc(imageSrc)}
          />
        ) : (
          <div className="trip-hero__fallback" data-testid="trip-hero-fallback" />
        )}
      </div>
      <div className="trip-hero__overlay" aria-hidden="true" />

      <div className="trip-hero__content">
        <p className="trip-hero__status">
          <Route size={15} aria-hidden="true" />
          {tripStatus(trip, now)}
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
