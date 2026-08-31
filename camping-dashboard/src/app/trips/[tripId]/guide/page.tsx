'use client';

import DesktopFieldOverview from '@/components/field/DesktopFieldOverview';
import MobileFieldOverview from '@/components/field/MobileFieldOverview';
import { createFieldViewModel } from '@/components/field/fieldViewModel';
import TripPageHeader, { TripSectionPage } from '@/components/trip/TripPageHeader';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';
import { usePhoneLayout } from '@/components/trip/PhoneLayoutProvider';

export default function TripGuidePage() {
  const {
    data,
    trip,
    alerts,
    offlineStatus,
    parkIntel,
    readiness,
    editableActions,
  } = useTripWorkspace();
  const usesMobileFieldComposition = usePhoneLayout();

  if (!data || !trip || !readiness) return null;

  const model = createFieldViewModel({
    data,
    trip,
    alerts,
    parkIntel,
    offlineStatus,
    manualPrep: readiness.categories.offline,
  });

  return (
    <TripSectionPage route="guide">
      <TripPageHeader
        title="Field"
        description={
          usesMobileFieldComposition
            ? 'Conditions, notices and field essentials'
            : 'Park information and advisories'
        }
      />
      {usesMobileFieldComposition ? (
        <MobileFieldOverview model={model} actions={editableActions} />
      ) : (
        <DesktopFieldOverview model={model} actions={editableActions} />
      )}
    </TripSectionPage>
  );
}
