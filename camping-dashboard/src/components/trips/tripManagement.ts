import { canDeleteTrip } from '@/lib/tripsLanding';
import { resolveDefaultTrip } from '@/lib/defaultTripResolver';
import type { UserTrip } from '@/lib/fetchDashboard';

export async function deleteOwnedTrip(trip: UserTrip): Promise<void> {
  if (!canDeleteTrip(trip)) throw new Error('Only trip owners can delete a trip.');
  const response = await fetch(`/api/trips/${encodeURIComponent(trip.id)}`, { method: 'DELETE' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'The trip could not be deleted.');
}

/** /trips remains the explicit chooser until the entry-route migration. */
export function deletedTripDestination(trips: readonly UserTrip[], now: Date): string {
  const result = resolveDefaultTrip(trips, now);
  if (result.status === 'resolved') return `/trips/${encodeURIComponent(result.trip.id)}`;
  return result.status === 'no-trips' ? '/trips/new' : '/trips';
}
