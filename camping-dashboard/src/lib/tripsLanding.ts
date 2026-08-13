import type { UserTrip } from '@/lib/fetchDashboard';

export const NEW_TRIP_HREF = '/trips/new';

export function getTripHref(tripId: string): string {
  return `/trips/${tripId}`;
}

export function selectFeaturedTrip(trips: UserTrip[]): UserTrip | null {
  return trips[0] ?? null;
}

export function canDeleteTrip(trip: UserTrip): boolean {
  return trip.role === 'owner';
}

export function getUserFirstName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
} | null): string {
  if (!user) return 'Explorer';
  const metadata = user.user_metadata ?? {};
  const identity = [metadata.given_name, metadata.full_name, metadata.name]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  if (identity) return identity.trim().split(/\s+/)[0];
  const emailName = user.email?.split('@')[0]?.split(/[._-]+/)[0];
  return emailName ? emailName.charAt(0).toUpperCase() + emailName.slice(1) : 'Explorer';
}

export function getTripLocation(trip: UserTrip): string {
  const campsite = [trip.lake_name, trip.site_name].filter(Boolean).join(' · ');
  return campsite || trip.park_name || 'Location to be confirmed';
}

export function getTripStatus(startDate: string, endDate: string, today = new Date()): {
  label: string;
  tone: 'current' | 'upcoming' | 'complete';
} {
  const todayKey = today.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
  if (endDate < todayKey) return { label: 'Completed', tone: 'complete' };
  if (startDate > todayKey) return { label: 'Upcoming', tone: 'upcoming' };
  return { label: 'Current', tone: 'current' };
}

export function formatTripDates(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate} – ${endDate}`;
  }
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(start);
  const endLabel = new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(end);
  return `${startLabel} – ${endLabel}`;
}
