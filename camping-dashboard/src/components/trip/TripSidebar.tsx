'use client';

import { ArrowLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';
import GuardedTripLink from './GuardedTripLink';
import TripMoreMenu from './TripMoreMenu';
import {
  isTripDestinationActive,
  TRIP_PRIMARY_DESTINATIONS,
  tripDestinationHref,
} from './tripNavigation';

interface TripSidebarProps {
  tripId: string;
  tripName: string;
  tripLocation: string;
  onMissionBrief: () => void;
  onProjectIntel: () => void;
  onAppearance?: () => void;
  onSignOut: () => Promise<void>;
}

export default function TripSidebar({
  tripId,
  tripName,
  tripLocation,
  onMissionBrief,
  onProjectIntel,
  onAppearance,
  onSignOut,
}: TripSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="trip-workspace-sidebar" data-testid="wide-trip-sidebar-shell">
      <div className="trip-workspace-sidebar__surface">
        <GuardedTripLink
          href="/trips"
          className="trip-workspace-sidebar__back trip-workspace-sidebar__control"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          <span>Back to Trips</span>
        </GuardedTripLink>

        <div className="trip-workspace-sidebar__identity" title={`${tripName} · ${tripLocation}`}>
          <p className="trip-workspace-sidebar__trip-name">{tripName}</p>
          <p className="trip-workspace-sidebar__location">{tripLocation}</p>
        </div>

        <nav aria-label="Trip sections" className="trip-workspace-sidebar__nav">
          {TRIP_PRIMARY_DESTINATIONS.map(({ label, segment, icon: Icon }) => {
            const active = isTripDestinationActive(pathname, tripId, segment);
            return (
              <GuardedTripLink
                key={label}
                href={tripDestinationHref(tripId, segment)}
                aria-current={active ? 'page' : undefined}
                className={`trip-workspace-sidebar__nav-link ${
                  active ? 'trip-workspace-sidebar__nav-link--active' : ''
                }`}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
                {active ? <span className="sr-only">(current)</span> : null}
              </GuardedTripLink>
            );
          })}
        </nav>

        <div className="trip-workspace-sidebar__more">
          <TripMoreMenu
            id="sidebar-trip-more"
            tripId={tripId}
            onMissionBrief={onMissionBrief}
            onProjectIntel={onProjectIntel}
            onAppearance={onAppearance}
            onSignOut={onSignOut}
            placement="sidebar"
          />
        </div>
      </div>
    </aside>
  );
}
