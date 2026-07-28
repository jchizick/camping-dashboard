'use client';

import CrewRosterCard from '@/components/cards/CrewRosterCard';
import TripPageHeader, {
  TripSectionEmptyState,
} from '@/components/trip/TripPageHeader';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';

export default function TripCrewPage() {
  const { data, crew, editableActions } = useTripWorkspace();
  if (!data) return null;

  return (
    <div className="relative z-10 mx-auto max-w-[1600px] space-y-6 p-4 md:p-6 lg:p-8">
      <TripPageHeader title="Crew" description="Roster and load balance" />
      {data.settings.show_crew ? (
        <div className="max-w-5xl">
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
    </div>
  );
}
