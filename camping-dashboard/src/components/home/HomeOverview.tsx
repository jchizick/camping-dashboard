'use client';

import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';
import { usePhoneLayout } from '@/components/trip/PhoneLayoutProvider';
import { useTripCountdown } from '@/components/trip/useTripCountdown';
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
    readiness,
    editableActions,
  } = useTripWorkspace();
  const usesMobileHomeComposition = usePhoneLayout();
  // Preserve Home's day/status and cached-freshness refreshes locally.
  const countdown = useTripCountdown(trip?.start_date);

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
