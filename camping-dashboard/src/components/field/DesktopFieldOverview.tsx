import AlertsCard from '@/components/cards/AlertsCard';
import AstroCard from '@/components/cards/AstroCard';
import OfflineVaultCard from '@/components/cards/OfflineVaultCard';
import ParkIntelCard from '@/components/cards/ParkIntelCard';
import type { TripWorkspaceEditableActions } from '@/components/trip/TripWorkspaceProvider';
import type { FieldViewModel } from './fieldViewModel';
import { useOptionalTripWorkspaceStatus } from '@/components/trip/TripWorkspaceStatus';
import { cachedNoticePresentation } from '@/lib/offlineFreshness';

export default function DesktopFieldOverview({
  model,
  actions,
}: {
  model: FieldViewModel;
  actions: TripWorkspaceEditableActions | null;
}) {
  const workspace = useOptionalTripWorkspaceStatus();
  const cachedNotices = workspace?.source === 'cache'
    ? cachedNoticePresentation(model.alertRefreshStates)
    : null;
  return (
    <div
      className="grid grid-cols-1 gap-6 lg:grid-cols-12"
      data-field-composition="desktop"
    >
      {cachedNotices ? (
        <p
          className="trip-section-inline-alert rounded-xl border px-4 py-3 text-sm lg:col-span-12"
          title={cachedNotices.exactTimestamp ?? undefined}
        >
          Notices · {cachedNotices.label}
        </p>
      ) : null}
      <div className="trip-section-surface lg:col-span-4">
        <ParkIntelCard intel={model.parkIntel} onUpdate={actions?.updateParkIntel} />
      </div>
      <div className="trip-section-surface lg:col-span-8 lg:row-span-2">
        <AlertsCard
          alerts={model.alerts}
          refreshStates={model.alertRefreshStates}
          onAddManual={actions?.addAlert}
          onDeleteManual={actions?.deleteAlert}
          onDismissSystem={actions?.dismissAlert}
          onRefresh={actions?.refreshAlerts}
        />
      </div>
      {model.showOffline ? (
        <div className="trip-section-surface lg:col-span-4">
          <OfflineVaultCard
            status={model.offlineStatus}
            onToggle={actions?.toggleOfflineStatus}
            onInitialize={actions?.initializeFieldPrep}
          />
        </div>
      ) : null}
      {model.showAstro ? (
        <div className="trip-section-surface lg:col-span-12">
          <AstroCard astro={model.astro} weather={model.currentWeather} />
        </div>
      ) : null}
    </div>
  );
}
