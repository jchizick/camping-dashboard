import type { TripDashboard } from '@/types';

const ALGONQUIN_WORKSPACE_BACKGROUND = '/sunset-over-the-lake.webp';

function normalizeTripIdentity(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase('en-CA') ?? '';
}

/**
 * Resolves the approved local background for a trip workspace.
 *
 * This intentionally remains identity-based until trip-specific imagery has
 * its own data contract. Returning null delegates rendering to the existing
 * atmospheric fallback.
 */
export function resolveTripWorkspaceBackground(
  trip: Pick<TripDashboard, 'park_name' | 'lake_name'>
): string | null {
  const park = normalizeTripIdentity(trip.park_name);
  const lake = normalizeTripIdentity(trip.lake_name);
  const isAlgonquin =
    park === 'algonquin park' || park === 'algonquin provincial park';
  const isApprovedLake = lake === 'maple lake' || lake === 'maple leaf lake';

  return isAlgonquin && isApprovedLake
    ? ALGONQUIN_WORKSPACE_BACKGROUND
    : null;
}
