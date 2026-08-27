'use client';

import React from 'react';
import DesktopFieldOverview from '@/components/field/DesktopFieldOverview';
import MobileFieldOverview from '@/components/field/MobileFieldOverview';
import { createFieldViewModel } from '@/components/field/fieldViewModel';
import TripPageHeader, { TripSectionPage } from '@/components/trip/TripPageHeader';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';

const mobileFieldCompositionQuery = '(max-width: 767px)';

function subscribeToMobileFieldComposition(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};

  const query = window.matchMedia(mobileFieldCompositionQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function getMobileFieldCompositionSnapshot() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia) &&
    window.matchMedia(mobileFieldCompositionQuery).matches
  );
}

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
  const usesMobileFieldComposition = React.useSyncExternalStore(
    subscribeToMobileFieldComposition,
    getMobileFieldCompositionSnapshot,
    () => false
  );

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
