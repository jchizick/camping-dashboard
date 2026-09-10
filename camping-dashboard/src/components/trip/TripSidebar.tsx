'use client';

import { usePathname } from 'next/navigation';
import GuardedTripLink from './GuardedTripLink';
import TripMoreMenu from './TripMoreMenu';
import WorkspaceBrand from './WorkspaceBrand';
import WorkspaceAccount from './WorkspaceAccount';
import TripSwitcher from '@/components/trips/TripSwitcher';
import { useOptionalTripWorkspaceStatus } from './TripWorkspaceStatus';
import {
  isTripDestinationActive,
  TRIP_PRIMARY_DESTINATIONS,
  tripDestinationHref,
} from './tripNavigation';

interface TripSidebarProps {
  tripId: string;
  tripName: string;
  tripLocation: string;
  onProjectIntel: () => void;
  onSignOut: () => Promise<void>;
}

export default function TripSidebar({
  tripId,
  tripName,
  tripLocation,
  onProjectIntel,
  onSignOut,
}: TripSidebarProps) {
  const pathname = usePathname();
  const workspace = useOptionalTripWorkspaceStatus();
  const navigationPath = workspace?.navigationPath ?? pathname;

  return (
    <aside className="trip-workspace-sidebar" data-testid="wide-trip-sidebar-shell">
      <div className="trip-workspace-sidebar__surface">
        <WorkspaceBrand tripId={tripId} />

        <TripSwitcher tripId={tripId} tripName={tripName} tripLocation={tripLocation} />

        <nav aria-label="Trip sections" className="trip-workspace-sidebar__nav">
          {TRIP_PRIMARY_DESTINATIONS.map(({ label, segment, icon: Icon }) => {
            const active = isTripDestinationActive(navigationPath, tripId, segment);
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
                <span>{segment === '' ? 'Overview' : label}</span>
                {active ? <span className="sr-only">(current)</span> : null}
              </GuardedTripLink>
            );
          })}
        </nav>

        <div className="trip-workspace-sidebar__more">
          <TripMoreMenu
            id="sidebar-trip-more"
            tripId={tripId}
            onProjectIntel={onProjectIntel}
            onSignOut={onSignOut}
            placement="sidebar"
          />
          <WorkspaceAccount onAbout={onProjectIntel} onSignOut={onSignOut} />
        </div>
      </div>
    </aside>
  );
}
