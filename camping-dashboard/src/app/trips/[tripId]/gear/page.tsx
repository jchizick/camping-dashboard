'use client';

import GearChecklistCard from '@/components/cards/GearChecklistCard';
import ReadinessScoreCard from '@/components/cards/ReadinessScoreCard';
import TripPageHeader, { TripSectionPage } from '@/components/trip/TripPageHeader';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';

export default function TripGearPage() {
  const {
    data,
    gear,
    offlineStatus,
    readiness,
    editableActions,
  } = useTripWorkspace();
  if (!data || !readiness) return null;

  return (
    <TripSectionPage route="gear">
      <TripPageHeader title="Gear" description="Checklist and readiness" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="trip-section-surface lg:order-2 lg:col-span-4">
          <ReadinessScoreCard
            readiness={readiness}
            unavailable={{
              offline: offlineStatus === null,
              weather: data.currentWeather === null,
            }}
          />
        </div>
        <div className="trip-section-surface lg:order-1 lg:col-span-8">
          <GearChecklistCard
            gear={gear}
            onToggle={editableActions?.toggleGearAcquired}
            onTogglePacked={editableActions?.toggleGearPacked}
            onAdd={editableActions?.addGearItem}
            onUpdate={editableActions?.updateGearItem}
            onDelete={editableActions?.deleteGearItem}
          />
        </div>
      </div>
    </TripSectionPage>
  );
}
