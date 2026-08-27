'use client';

import React from 'react';
import CrewRosterCard from '@/components/cards/CrewRosterCard';
import MobileCrewOverview from '@/components/crew/MobileCrewOverview';
import TripPageHeader, {
  TripSectionPage,
  TripSectionEmptyState,
} from '@/components/trip/TripPageHeader';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';

const mobileCrewCompositionQuery = '(max-width: 767px)';

function subscribeToMobileCrewComposition(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia(mobileCrewCompositionQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getMobileCrewCompositionSnapshot() {
  return typeof window !== 'undefined'
    && Boolean(window.matchMedia)
    && window.matchMedia(mobileCrewCompositionQuery).matches;
}

export default function TripCrewPage() {
  const { data, crew, gear, meals, editableActions } = useTripWorkspace();
  const usesMobileCrewComposition = React.useSyncExternalStore(
    subscribeToMobileCrewComposition,
    getMobileCrewCompositionSnapshot,
    () => false
  );
  if (!data) return null;

  return (
    <TripSectionPage route="crew">
      <TripPageHeader
        title="Crew"
        description={usesMobileCrewComposition ? 'People and responsibilities' : 'Roster and load balance'}
      />
      {data.settings.show_crew ? (
        <div className="trip-section-surface">
          {usesMobileCrewComposition ? (
            <MobileCrewOverview
              crew={crew}
              gear={gear}
              meals={meals}
              onAdd={editableActions?.addCrewMember}
              onUpdate={editableActions?.updateCrewMember}
              onDelete={editableActions?.deleteCrewMember}
            />
          ) : (
            <CrewRosterCard
              crew={crew}
              gear={gear}
              meals={meals}
              onAdd={editableActions?.addCrewMember}
              onUpdate={editableActions?.updateCrewMember}
              onDelete={editableActions?.deleteCrewMember}
            />
          )}
        </div>
      ) : (
        <TripSectionEmptyState>
          The crew module is hidden for this trip.
        </TripSectionEmptyState>
      )}
    </TripSectionPage>
  );
}
