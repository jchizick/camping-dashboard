'use client';

import { useEffect, useState } from 'react';
import DashboardShell from '@/components/DashboardShell';
import TripCrewPage from '@/app/trips/[tripId]/crew/page';
import TripGearPage from '@/app/trips/[tripId]/gear/page';
import TripGuidePage from '@/app/trips/[tripId]/guide/page';
import TripPlanPage from '@/app/trips/[tripId]/plan/page';
import TripAppShell from '@/components/trip/TripAppShell';
import { TripDraftGuardProvider } from '@/components/trip/TripDraftGuardProvider';
import { TripWorkspaceProvider } from '@/components/trip/TripWorkspaceProvider';
import { AuthProvider } from '@/lib/authContext';
import {
  offlineTargetFromLocation,
  type OfflineDestination,
  type OfflineTarget,
} from '@/lib/offlineTarget';
import {
  tripRepository,
  type OfflineTripAccessResult,
} from '@/lib/tripRepository';
import { TripProvider } from '@/lib/tripContext';

function destinationContent(destination: OfflineDestination) {
  if (destination === 'plan') return <TripPlanPage />;
  if (destination === 'gear') return <TripGearPage />;
  if (destination === 'crew') return <TripCrewPage />;
  if (destination === 'field') return <TripGuidePage />;
  return <DashboardShell />;
}

function OfflineUnavailable({ status }: { status: OfflineTripAccessResult['status'] | 'invalid-target' }) {
  const expired = status === 'expired';
  const incompatible = status === 'no-snapshot';
  return (
    <main className="relative z-10 flex min-h-[100dvh] items-center justify-center px-5 py-12 text-center">
      <section className="trip-workspace-state-panel max-w-md px-7 py-9" role="status">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          Field Protocol · Offline
        </p>
        <h1 className="trip-workspace-state-panel__title mt-3 text-2xl">
          {expired
            ? 'Reconnect to verify access'
            : incompatible
              ? 'Saved trip needs to be refreshed'
              : 'Trip not available offline'}
        </h1>
        <p className="trip-workspace-state-panel__copy mt-3">
          {expired
            ? 'This saved trip is outside its offline access window.'
            : incompatible
              ? 'Reconnect and open the trip again to prepare a compatible copy.'
              : 'Reconnect and open your trip once while online.'}
        </p>
      </section>
    </main>
  );
}

export default function OfflineBootstrap() {
  const [target] = useState<OfflineTarget | null | undefined>(() =>
    typeof window === 'undefined'
      ? undefined
      : offlineTargetFromLocation(window.location)
  );
  const [access, setAccess] = useState<OfflineTripAccessResult | null>(null);

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    void tripRepository
      .readOfflineTrip({ tripId: target.tripId, requirePreparedShell: true })
      .then((result) => {
        if (!cancelled) setAccess(result);
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  if (target === null) return <OfflineUnavailable status="invalid-target" />;
  if (target === undefined || !access) {
    return (
      <main className="relative z-10 flex min-h-[100dvh] items-center justify-center p-6" role="status">
        <p className="text-sm font-semibold text-text-muted">Opening saved trip…</p>
      </main>
    );
  }
  if (access.status !== 'available') {
    return <OfflineUnavailable status={access.status} />;
  }

  return (
    <div data-offline-bootstrap="private-data-from-indexeddb">
      <AuthProvider initialOfflineUserId={access.identity.activeUserId}>
        <TripProvider
          tripId={target.tripId}
          initialCachedWorkspace={access.workspace}
        >
          <TripDraftGuardProvider>
            <TripWorkspaceProvider
              initialCachedWorkspace={access.workspace}
              navigationPath={target.pathname}
            >
              <TripAppShell>{destinationContent(target.destination)}</TripAppShell>
            </TripWorkspaceProvider>
          </TripDraftGuardProvider>
        </TripProvider>
      </AuthProvider>
    </div>
  );
}
