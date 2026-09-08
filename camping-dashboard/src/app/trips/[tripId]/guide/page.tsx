'use client';

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

  // Primary desktop routes are composed by TripAppShell, online and offline.
  if (!data || !trip || !readiness || !usesMobileFieldComposition) return null;

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
        distressed
        description="Conditions, notices and field essentials"
      />
      <MobileFieldOverview model={model} actions={editableActions} />
    </TripSectionPage>
  );
}
