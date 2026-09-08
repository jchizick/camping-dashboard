'use client';

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
  // Primary desktop routes are composed by TripAppShell, online and offline.
  if (!data || !usesMobileCrewComposition) return null;

  return (
    <TripSectionPage route="crew">
      <TripPageHeader
        title="Crew"
        distressed
        description="People and responsibilities"
      />
      {data.settings.show_crew ? (
        <div className="trip-section-surface">
          <MobileCrewOverview
            crew={crew}
            gear={gear}
            meals={meals}
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
