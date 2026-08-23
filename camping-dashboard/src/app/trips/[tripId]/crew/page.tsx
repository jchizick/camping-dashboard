'use client';

import CrewRosterCard from '@/components/cards/CrewRosterCard';
import TripPageHeader, {
  TripSectionPage,
  TripSectionEmptyState,
} from '@/components/trip/TripPageHeader';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';

export default function TripCrewPage() {
  const { data, crew, editableActions } = useTripWorkspace();
  if (!data) return null;

  return (
    <TripSectionPage route="crew">
      <TripPageHeader title="Crew" description="Roster and load balance" />
      {data.settings.show_crew ? (
        <div className="trip-section-surface">
          <CrewRosterCard
            crew={crew}
            onAdd={editableActions?.addCrewMember}
            onUpdate={editableActions?.updateCrewMember}
            onDelete={editableActions?.deleteCrewMember}
          />
        </div>
      ) : (
        <TripSectionEmptyState>
          The crew module is hidden for this trip.
        </TripSectionEmptyState>
      )}
    </TripSectionPage>
  );
}
