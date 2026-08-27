'use client';

import { usePathname } from 'next/navigation';
import GuardedTripLink from './GuardedTripLink';
import {
  isTripDestinationActive,
  TRIP_PRIMARY_DESTINATIONS,
  tripDestinationHref,
} from './tripNavigation';
import { useOptionalTripWorkspaceStatus } from './TripWorkspaceStatus';

export default function TripMobileNav({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  const workspace = useOptionalTripWorkspaceStatus();
  const navigationPath = workspace?.navigationPath ?? pathname;

  return (
    <nav
      aria-label="Mobile trip sections"
      className="trip-navigation-mobile-bar trip-mobile-nav fixed inset-x-0 bottom-0 z-[var(--layer-navigation)] grid-cols-5 border-t shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur"
      data-testid="mobile-trip-navigation"
    >
      {TRIP_PRIMARY_DESTINATIONS.map(({ label, segment, icon: Icon }) => {
        const active = isTripDestinationActive(navigationPath, tripId, segment);

        return (
          <GuardedTripLink
            key={label}
            href={tripDestinationHref(tripId, segment)}
            aria-current={active ? 'page' : undefined}
            className={`trip-mobile-nav__link relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring ${
              active
                ? 'trip-mobile-nav__link--active after:absolute after:inset-x-3 after:top-0 after:h-0.5 after:rounded-full after:bg-accent-yellow'
                : 'hover:bg-card-hover hover:text-text-main'
            }`}
          >
            <Icon size={19} aria-hidden="true" />
            <span className="truncate">{label}</span>
            {active && <span className="sr-only">(current)</span>}
          </GuardedTripLink>
        );
      })}
    </nav>
  );
}
