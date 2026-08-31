'use client';

import CrewRosterCard from '@/components/cards/CrewRosterCard';
import MobileCrewOverview from '@/components/crew/MobileCrewOverview';
import TripPageHeader, {
  TripSectionPage,
  TripSectionEmptyState,
} from '@/components/trip/TripPageHeader';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';
import { usePhoneLayout } from '@/components/trip/PhoneLayoutProvider';

export default function TripCrewPage() {
  const { data, crew, gear, meals, editableActions } = useTripWorkspace();
  const usesMobileCrewComposition = usePhoneLayout();
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
