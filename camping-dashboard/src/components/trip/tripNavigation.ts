import type { LucideIcon } from 'lucide-react';
import { Backpack, CalendarDays, Compass, Home, Users } from 'lucide-react';

export interface TripDestination {
  label: string;
  segment: '' | 'plan' | 'gear' | 'crew' | 'guide';
  icon: LucideIcon;
}

export const TRIP_PRIMARY_DESTINATIONS: readonly TripDestination[] = [
  { label: 'Home', segment: '', icon: Home },
  { label: 'Plan', segment: 'plan', icon: CalendarDays },
  { label: 'Gear', segment: 'gear', icon: Backpack },
  { label: 'Crew', segment: 'crew', icon: Users },
  { label: 'Guide', segment: 'guide', icon: Compass },
];

export function tripDestinationHref(tripId: string, segment: string) {
  const base = `/trips/${encodeURIComponent(tripId)}`;
  return segment ? `${base}/${segment}` : base;
}

export function isTripDestinationActive(
  pathname: string,
  tripId: string,
  segment: string
) {
  const href = tripDestinationHref(tripId, segment);
  return segment ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
}
