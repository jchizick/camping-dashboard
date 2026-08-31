import { describe, expect, it } from 'vitest';
import type { UserTrip } from '@/lib/fetchDashboard';
import {
  canDeleteTrip,
  formatFeaturedTripDate,
  getTripHref,
  getTripLocation,
  getTripStatus,
  getUserFirstName,
  NEW_TRIP_HREF,
  selectFeaturedTrip,
} from '@/lib/tripsLanding';

describe('Trips landing page helpers', () => {
  it('uses authenticated profile identity with safe fallbacks', () => {
    expect(getUserFirstName({ user_metadata: { full_name: 'Jordan Camper' } })).toBe('Jordan');
    expect(getUserFirstName({ email: 'alex.smith@example.com' })).toBe('Alex');
    expect(getUserFirstName(null)).toBe('Explorer');
  });

  it('uses campsite detail before falling back to park name', () => {
    const trip = {
      lake_name: 'Maple Leaf Lake',
      site_name: 'Site 4',
      park_name: 'Algonquin Provincial Park',
    } as UserTrip;
    expect(getTripLocation(trip)).toBe('Maple Leaf Lake · Site 4');
    expect(getTripLocation({ ...trip, lake_name: null, site_name: null })).toBe('Algonquin Provincial Park');
  });

  it('derives current, upcoming, and completed labels from dates', () => {
    const today = new Date('2026-07-07T12:00:00-04:00');
    expect(getTripStatus('2026-07-05', '2026-07-09', today)).toEqual({ label: 'Current', tone: 'current' });
    expect(getTripStatus('2026-08-01', '2026-08-04', today)).toEqual({ label: 'Upcoming', tone: 'upcoming' });
    expect(getTripStatus('2026-06-01', '2026-06-04', today)).toEqual({ label: 'Completed', tone: 'complete' });
  });

  it('features the first trip in existing order and handles zero or multiple trips', () => {
    const first = { id: 'first-trip', role: 'owner' } as UserTrip;
    const second = { id: 'second-trip', role: 'viewer' } as UserTrip;
    expect(selectFeaturedTrip([])).toBeNull();
    expect(selectFeaturedTrip([first])).toBe(first);
    expect(selectFeaturedTrip([first, second])).toBe(first);
  });

  it('builds deterministic trip and creation routes for every row', () => {
    expect(NEW_TRIP_HREF).toBe('/trips/new');
    expect(getTripHref('first-trip')).toBe('/trips/first-trip');
    expect(getTripHref('second-trip')).toBe('/trips/second-trip');
  });

  it.each([
    ['same-day trip', '2026-07-05', '2026-07-05', { primary: 'Jul 5', secondary: '2026' }],
    ['same-month range', '2026-07-05', '2026-07-09', { primary: 'Jul 5–9', secondary: '2026' }],
    ['month boundary', '2026-07-31', '2026-08-02', { primary: 'Jul 31–Aug 2', secondary: '2026' }],
    ['year boundary', '2026-12-31', '2027-01-01', { primary: 'Dec 31–Jan 1', secondary: '2026–2027' }],
  ])('formats the featured date tile for a %s', (_label, startDate, endDate, expected) => {
    expect(formatFeaturedTripDate(startDate, endDate)).toEqual(expected);
  });

  it('keeps deletion controls owner-only', () => {
    expect(canDeleteTrip({ role: 'owner' } as UserTrip)).toBe(true);
    expect(canDeleteTrip({ role: 'editor' } as UserTrip)).toBe(false);
    expect(canDeleteTrip({ role: 'viewer' } as UserTrip)).toBe(false);
  });
});
