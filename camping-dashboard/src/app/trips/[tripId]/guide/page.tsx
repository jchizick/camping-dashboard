'use client';

import AlertsCard from '@/components/cards/AlertsCard';
import AstroCard from '@/components/cards/AstroCard';
import OfflineVaultCard from '@/components/cards/OfflineVaultCard';
import ParkIntelCard from '@/components/cards/ParkIntelCard';
import TripPageHeader from '@/components/trip/TripPageHeader';
import { useTripWorkspace } from '@/components/trip/TripWorkspaceProvider';

export default function TripGuidePage() {
  const {
    data,
    alerts,
    offlineStatus,
    parkIntel,
    editableActions,
  } = useTripWorkspace();
  if (!data) return null;

  return (
    <div className="relative z-10 mx-auto max-w-[1600px] space-y-6 p-4 md:p-6 lg:p-8">
      <TripPageHeader title="Field Guide" description="Park information and advisories" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <ParkIntelCard
            intel={parkIntel}
            onUpdate={editableActions?.updateParkIntel}
          />
        </div>
        <div className="lg:col-span-8 lg:row-span-2">
          <AlertsCard
            alerts={alerts}
            refreshStates={data.alertRefresh}
            onAddManual={editableActions?.addAlert}
            onDeleteManual={editableActions?.deleteAlert}
            onDismissSystem={editableActions?.dismissAlert}
            onRefresh={editableActions?.refreshAlerts}
          />
        </div>
        {data.settings.show_offline && (
          <div className="lg:col-span-4">
            <OfflineVaultCard
              status={offlineStatus}
              onToggle={editableActions?.toggleOfflineStatus}
            />
          </div>
        )}
        {data.settings.show_astro && (
          <div className="lg:col-span-12">
            <AstroCard astro={data.astro} weather={data.currentWeather} />
          </div>
        )}
      </div>
    </div>
  );
}
