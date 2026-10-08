import DesktopWorkspaceOverview from './historical/components/home/DesktopWorkspaceOverview';
import TripSidebar from './historical/components/trip/TripSidebar';
import DesktopTripWorkspaceBoundary from './historical/components/trip/DesktopTripWorkspaceBoundary';
import { trip, model } from './fixture';
import { TripEssentials } from './adapters/TripEssentials';

// Rendered to static HTML by the local capture server; never mounted in the app.
export default function WorkspacePreview({ unified = false }: { unified?: boolean }) {
  return (
    <DesktopTripWorkspaceBoundary>
      <TripSidebar tripId="demo" tripName={trip.name} tripLocation="Northwoods Park"
        onProjectIntel={() => {}} onSignOut={async () => {}} />
      <main className="trip-app-main relative scroll-mt-20" data-desktop-workspace-main>
        <div data-desktop-workspace-document>
          <DesktopWorkspaceOverview showInvite={unified} model={model}
            onSaveLocation={async () => {}} onRefreshWeather={async () => {}} />
        </div>
      </main>
      {unified && <TripEssentials />}
    </DesktopTripWorkspaceBoundary>
  );
}
