import { getTripDuration } from './tripDuration';
import { getTripStatus } from './tripsLanding';

export interface DefaultTripCandidate {
  id: string;
  start_date: string;
  end_date: string;
}

export type DefaultTripCategory = 'active' | 'upcoming' | 'completed';

export type DefaultTripResult<T extends DefaultTripCandidate> =
  | { status: 'no-trips' }
  | { status: 'chooser-required'; invalidTrips: readonly T[] }
  | { status: 'resolved'; trip: T; category: DefaultTripCategory; invalidTrips: readonly T[] };

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareTrips(a: DefaultTripCandidate, b: DefaultTripCandidate, category: DefaultTripCategory): number {
  if (category === 'completed') {
    return compareText(b.end_date, a.end_date)
      || compareText(b.start_date, a.start_date)
      || compareText(a.id, b.id);
  }
  return (category === 'active'
    ? compareText(b.start_date, a.start_date)
    : compareText(a.start_date, b.start_date))
    || compareText(a.end_date, b.end_date)
    || compareText(a.id, b.id);
}

/**
 * Rank a successfully loaded, authorized collection with unique trip IDs.
 * The caller owns auth/load failures and explicit route destinations. Passing
 * the clock explicitly keeps selection deterministic; no input is mutated.
 */
export function resolveDefaultTrip<T extends DefaultTripCandidate>(
  trips: readonly T[],
  now: Date,
): DefaultTripResult<T> {
  const { groups, invalidTrips } = rankDefaultTrips(trips, now);
  if (trips.length === 0) return { status: 'no-trips' };

  for (const category of ['active', 'upcoming', 'completed'] as const) {
    const ranked = groups[category];
    if (ranked.length > 0) return { status: 'resolved', trip: ranked[0], category, invalidTrips };
  }
  return { status: 'chooser-required', invalidTrips };
}

/** The same ordering exposed for an explicit chooser; invalid dates stay selectable. */
export function rankDefaultTrips<T extends DefaultTripCandidate>(trips: readonly T[], now: Date) {
  if (!Number.isFinite(now.getTime())) throw new RangeError('A valid resolver clock is required.');
  const invalidTrips: T[] = [];
  const groups: Record<DefaultTripCategory, T[]> = { active: [], upcoming: [], completed: [] };
  for (const trip of trips) {
    if (!getTripDuration(trip.start_date, trip.end_date)) {
      invalidTrips.push(trip);
      continue;
    }
    const { tone } = getTripStatus(trip.start_date, trip.end_date, now);
    groups[tone === 'current' ? 'active' : tone === 'complete' ? 'completed' : 'upcoming'].push(trip);
  }
  invalidTrips.sort((a, b) => compareText(a.id, b.id));
  for (const category of ['active', 'upcoming', 'completed'] as const) {
    groups[category].sort((a, b) => compareTrips(a, b, category));
  }
  return { groups, invalidTrips };
}
