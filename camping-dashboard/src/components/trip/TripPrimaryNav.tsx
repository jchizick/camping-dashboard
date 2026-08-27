'use client';

import { usePathname } from 'next/navigation';
import GuardedTripLink from './GuardedTripLink';
import {
  isTripDestinationActive,
  TRIP_PRIMARY_DESTINATIONS,
  tripDestinationHref,
} from './tripNavigation';
import { useOptionalTripWorkspaceStatus } from './TripWorkspaceStatus';

export default function TripPrimaryNav({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const workspace = useOptionalTripWorkspaceStatus();
  const navigationPath = workspace?.navigationPath ?? pathname;

  return (
    <nav
      aria-label="Trip sections"
      className="flex min-w-0 items-stretch gap-1"
      data-testid="desktop-trip-navigation"
    >
      {TRIP_PRIMARY_DESTINATIONS.map(({ label, segment, icon: Icon }) => {
        const active = isTripDestinationActive(navigationPath, tripId, segment);

        return (
          <GuardedTripLink
            key={label}
            href={tripDestinationHref(tripId, segment)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={`trip-primary-nav-link inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-2 text-sm font-medium transition-colors lg:px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card-bg ${
              active
                ? 'trip-primary-nav-link--active'
                : ''
            }`}
          >
            <Icon size={16} aria-hidden="true" />
            <span className="hidden lg:inline">{label}</span>
            {active && <span className="sr-only">(current)</span>}
          </GuardedTripLink>
        );
      })}
    </nav>
  );
}
