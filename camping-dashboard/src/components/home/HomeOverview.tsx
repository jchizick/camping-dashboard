'use client';

import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';
import { usePhoneLayout } from '@/components/trip/PhoneLayoutProvider';
import DesktopHomeOverview from './DesktopHomeOverview';
import MobileHomeOverview from './MobileHomeOverview';
import { createHomeViewModel } from './homeViewModel';

export default function HomeOverview() {
  const {
    data,
    trip,
    gear,
    timeline,
    alerts,
    tripDays,
    countdown,
    readiness,
    editableActions,
  } = useTripWorkspace();
  const usesMobileHomeComposition = usePhoneLayout();

  if (!data || !trip || !countdown || !readiness) return null;

  const model = createHomeViewModel({
    data,
    trip,
    tripDays,
    timeline,
    alerts,
    gear,
    readiness,
  });

  return usesMobileHomeComposition ? (
    <MobileHomeOverview
      model={model}
      canSetupRequiredGear={Boolean(editableActions?.addGearItem)}
    />
  ) : (
    <DesktopHomeOverview
      model={model}
      onSaveLocation={editableActions?.saveCampsite}
    />
  );
}
