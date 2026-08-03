// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    render(<TripHero trip={trip} tripDays={3} now={new Date(2026, 6, 28, 12)} />);

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
    render(<TripHero trip={trip} tripDays={3} now={now} />);

    expect(screen.getByText(label).getAttribute('data-tone')).toBe(tone);
  });

  it('renders the local atmospheric fallback safely without fake trip data', () => {
    render(<TripHero trip={trip} tripDays={3} imageSrc={null} />);

    expect(screen.getByTestId('trip-hero-fallback')).toBeTruthy();
    expect(screen.queryByText(/16°C|79%|July 3/i)).toBeNull();
  });

  it('renders the approved image decoratively and returns to fallback on load failure', () => {
    render(
      <TripHero
        trip={trip}
        tripDays={3}
        imageSrc="/sunset-over-the-lake.webp"
      />
    );

    const image = screen.getByTestId('trip-hero-image');
    expect(image.getAttribute('alt')).toBe('');
    expect(image.getAttribute('src')).toContain('sunset-over-the-lake.webp');
    fireEvent.error(image);
    expect(screen.queryByTestId('trip-hero-image')).toBeNull();
    expect(screen.getByTestId('trip-hero-fallback')).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Maple Lake Weekend' })
    ).toBeTruthy();
  });
});
