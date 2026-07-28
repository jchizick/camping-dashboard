'use client';

import { usePathname } from 'next/navigation';
import GuardedTripLink from './GuardedTripLink';
import {
  isTripDestinationActive,
  TRIP_PRIMARY_DESTINATIONS,
  tripDestinationHref,
} from './tripNavigation';

export default function TripPrimaryNav({ tripId }: { tripId: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Trip sections"
      className="hidden min-w-0 items-stretch gap-1 md:flex"
      data-testid="desktop-trip-navigation"
    >
      {TRIP_PRIMARY_DESTINATIONS.map(({ label, segment, icon: Icon }) => {
        const active = isTripDestinationActive(pathname, tripId, segment);

        return (
          <GuardedTripLink
            key={label}
            href={tripDestinationHref(tripId, segment)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border px-2 text-sm font-medium transition-colors lg:px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card-bg ${
              active
                ? 'border-accent-yellow/40 bg-accent-yellow/15 text-accent-yellow'
                : 'border-transparent text-text-muted hover:border-border-subtle hover:bg-card-hover hover:text-text-main'
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
