export type OfflineDestination = 'home' | 'plan' | 'gear' | 'crew' | 'field';

export interface OfflineTarget {
  tripId: string;
  destination: OfflineDestination;
  pathname: string;
}

const OFFLINE_TARGET_BASE = new URL('https://field-protocol.local');

const DESTINATION_BY_SEGMENT: Record<string, OfflineDestination> = {
  plan: 'plan',
  gear: 'gear',
  crew: 'crew',
  guide: 'field',
};

export function parseOfflineTarget(value: string): OfflineTarget | null {
  let url: URL;
  try {
    url = new URL(value, OFFLINE_TARGET_BASE);
  } catch {
    return null;
  }
  if (url.origin !== OFFLINE_TARGET_BASE.origin) return null;
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'trips' || segments.length < 2 || segments.length > 3) {
    return null;
  }
  const tripId = decodeURIComponent(segments[1]);
  if (!tripId) return null;
  const destination = segments[2]
    ? DESTINATION_BY_SEGMENT[segments[2]]
    : 'home';
  if (!destination) return null;
  const canonicalSegment = destination === 'home' ? '' : `/${segments[2]}`;
  return {
    tripId,
    destination,
    pathname: `/trips/${encodeURIComponent(tripId)}${canonicalSegment}`,
  };
}

export function offlineTargetFromLocation(location: Location): OfflineTarget | null {
  const explicitTarget = new URLSearchParams(location.search).get('target');
  return parseOfflineTarget(explicitTarget ?? location.pathname);
}
