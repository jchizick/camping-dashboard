'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import GearChecklistCard from '@/components/cards/GearChecklistCard';
import ReadinessScoreCard from '@/components/cards/ReadinessScoreCard';
import TripPageHeader, { TripSectionPage } from '@/components/trip/TripPageHeader';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';

export default function TripGearPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    data,
    gear,
    crew,
    readiness,
    editableActions,
  } = useTripWorkspace();
  const addIntent = searchParams.get('intent') === 'add-required'
    ? 'required'
    : null;

  const consumeAddIntent = React.useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  if (!data || !readiness) return null;

  return (
    <TripSectionPage route="gear">
      <TripPageHeader title="Gear" description="Checklist and readiness" />
      <div className="trip-operational-grid grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="trip-gear-overall-readiness trip-section-surface trip-section-surface--secondary lg:order-2 lg:col-span-4">
          <ReadinessScoreCard readiness={readiness} />
        </div>
        <div className="trip-section-surface trip-section-surface--primary min-h-0 lg:order-1 lg:col-span-8">
          <GearChecklistCard
            gear={gear}
            crew={crew}
            categoryReadiness={readiness.categories.gear}
            onToggle={editableActions?.toggleGearAcquired}
            onTogglePacked={editableActions?.toggleGearPacked}
            onAdd={editableActions?.addGearItem}
            onUpdate={editableActions?.updateGearItem}
            onDelete={editableActions?.deleteGearItem}
            addIntent={addIntent}
            onAddIntentConsumed={consumeAddIntent}
          />
        </div>
      </div>
    </TripSectionPage>
  );
}
