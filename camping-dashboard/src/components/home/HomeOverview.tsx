'use client';

import React from 'react';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';
import DesktopHomeOverview from './DesktopHomeOverview';
import MobileHomeOverview from './MobileHomeOverview';
import { createHomeViewModel } from './homeViewModel';

const mobileHomeCompositionQuery = '(max-width: 767px)';

function subscribeToMobileHomeComposition(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};

  const query = window.matchMedia(mobileHomeCompositionQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getMobileHomeCompositionSnapshot() {
  return typeof window !== 'undefined' &&
    Boolean(window.matchMedia) &&
    window.matchMedia(mobileHomeCompositionQuery).matches;
}

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
  const usesMobileHomeComposition = React.useSyncExternalStore(
    subscribeToMobileHomeComposition,
    getMobileHomeCompositionSnapshot,
    () => false
  );

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
