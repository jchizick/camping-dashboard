// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { TripDashboard } from '@/types';
import TripHero from './TripHero';

const trip = {
  id: 'trip-1',
  name: 'Maple Lake Weekend',
  park_name: 'Algonquin Park',
  lake_name: 'Maple Lake',
  site_name: 'Site 4',
  start_date: '2026-07-27',
  end_date: '2026-07-29',
} as TripDashboard;

afterEach(cleanup);

describe('TripHero', () => {
  it('uses the display type only on the canonical Home h1', () => {
    render(<TripHero trip={trip} now={new Date(2026, 6, 28, 12)} />);

    const title = screen.getByRole('heading', { level: 1, name: 'Maple Lake Weekend' });
    expect(title.classList.contains('trip-hero__title')).toBe(true);
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByText('Maple Lake · Site 4')).toBeTruthy();
    expect(screen.getByText('Jul 27 – 29, 2026')).toBeTruthy();
    expect(screen.getByText('3 days · 2 nights')).toBeTruthy();
    expect(screen.getByText('Trip is underway')).toBeTruthy();
    expect(screen.getByText('Trip is underway').getAttribute('data-tone')).toBe('active');
  });

  it.each([
    ['Trip is approaching', 'warning', new Date(2026, 6, 26, 12)],
    ['Trip is underway', 'active', new Date(2026, 6, 28, 12)],
    ['Trip complete', 'positive', new Date(2026, 6, 30, 12)],
  ])('exposes the %s semantic tone', (label, tone, now) => {
    render(<TripHero trip={trip} now={now} />);

    expect(screen.getByText(label).getAttribute('data-tone')).toBe(tone);
  });

  it('is a semantic text-only header with no scene ownership', () => {
    const { container } = render(<TripHero trip={trip} />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.trip-hero__media')).toBeNull();
    expect(container.querySelector('.trip-hero__fallback')).toBeNull();
    expect(container.querySelector('.trip-hero__overlay')).toBeNull();
  });

  it('keeps long trip identity values available and wrappable', () => {
    const longTrip = {
      ...trip,
      name: 'A deliberately long Algonquin backcountry expedition name that must wrap naturally',
      lake_name: 'A very long lake identity for a remote northern access point',
      site_name: 'Site 4 with an extended campsite designation',
      end_date: '2026-08-07',
    } as TripDashboard;
    render(<TripHero trip={longTrip} />);

    const title = screen.getByRole('heading', { level: 1, name: longTrip.name });
    expect(title.classList.contains('trip-hero__title')).toBe(true);
    expect(screen.getByText(`${longTrip.lake_name} · ${longTrip.site_name}`)).toBeTruthy();
    expect(screen.getByText('12 days · 11 nights')).toBeTruthy();
  });

  it('preserves missing identity and invalid-date fallbacks', () => {
    const incompleteTrip = {
      ...trip,
      park_name: null,
      lake_name: null,
      site_name: null,
      start_date: 'TBD',
      end_date: 'Later',
    } as unknown as TripDashboard;
    render(<TripHero trip={incompleteTrip} />);

    expect(screen.getByText('Campsite unavailable')).toBeTruthy();
    expect(screen.getByText('TBD – Later')).toBeTruthy();
    expect(screen.queryByText(/days? ·/)).toBeNull();
  });
});
