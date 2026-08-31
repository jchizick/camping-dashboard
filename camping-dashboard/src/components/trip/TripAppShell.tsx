'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { useTrip } from '@/lib/tripContext';
import MissionBriefModal from '@/components/ui/MissionBriefModal';
import ProjectIntelModal from '@/components/ui/ProjectIntelModal';
import TripAppearanceDialog from './TripAppearanceDialog';
import TripMobileNav from './TripMobileNav';
import TripMoreMenu from './TripMoreMenu';
import TripPrimaryNav from './TripPrimaryNav';
import TripSidebar from './TripSidebar';
import TripWorkspaceBackground from './TripWorkspaceBackground';
import AuthenticatedTripsLoader from '@/components/trips/AuthenticatedTripsLoader';
import { useTripWorkspace } from './TripWorkspaceProvider';
import GuardedTripLink from './GuardedTripLink';
import { useOptionalTripDraftGuard } from './TripDraftGuardProvider';
import { PhoneLayoutProvider, usePhoneLayout } from './PhoneLayoutProvider';

type AppInfoDialogName = 'mission-brief' | 'about' | 'appearance';
interface ActiveAppInfoDialog {
  name: AppInfoDialogName;
  pathname: string;
}

function TripAppShellContent({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const draftGuard = useOptionalTripDraftGuard();
  const {
    tripId,
    isLoading: roleLoading,
    error: roleError,
  } = useTrip();
  const {
    data,
    trip,
    editableActions,
    error,
    isLoading,
    isReloading,
    reload,
    source,
    connectivity,
    navigationPath,
    lastOnlineVerifiedAt,
  } = useTripWorkspace();
  const [openedInfoDialog, setOpenedInfoDialog] = useState<ActiveAppInfoDialog | null>(null);
  const isPhoneLayout = usePhoneLayout();
  const routePathname = usePathname();
  const pathname = navigationPath ?? routePathname;
  const activeInfoDialog =
    openedInfoDialog?.pathname === pathname ? openedInfoDialog.name : null;
  const mainRef = useRef<HTMLElement>(null);
  const initialPathRef = useRef(pathname);
  const [routeAnnouncement, setRouteAnnouncement] = useState('');
  const routeLabel =
    pathname.endsWith('/plan')
      ? 'Plan'
      : pathname.endsWith('/gear')
        ? 'Gear'
        : pathname.endsWith('/crew')
          ? 'Crew'
          : pathname.endsWith('/guide')
            ? 'Field'
            : pathname.endsWith('/field-log')
              ? 'Field Log'
              : 'Trip Home';

  async function handleSignOut() {
    setOpenedInfoDialog(null);
    if (draftGuard) {
      await draftGuard.requestAction(signOut);
      return;
    }
    await signOut();
  }

  useEffect(() => {
    if (initialPathRef.current === pathname) {
      initialPathRef.current = '';
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (document.querySelector('[aria-modal="true"]')) return;
      const main = mainRef.current;
      const destination = main?.querySelector<HTMLElement>('h1') ?? main;
      destination?.focus({ preventScroll: true });
      destination?.scrollIntoView({ block: 'start', behavior: 'auto' });
      setRouteAnnouncement(`${routeLabel} loaded`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, routeLabel]);

  if (roleError) {
    return (
      <div className="trip-workspace-state-frame">
        <TripWorkspaceBackground />
        <main className="relative z-10 flex min-h-[100dvh] items-center justify-center p-6 text-center">
          <div className="trip-workspace-state-panel max-w-lg px-8 py-10">
            <h1 tabIndex={-1} className="trip-workspace-state-panel__title mb-4 text-2xl">Access Denied</h1>
            <p className="trip-workspace-state-panel__copy">{roleError}</p>
            <GuardedTripLink
              href="/trips"
              className="trip-workspace-state-panel__action mt-5 inline-flex min-h-11 items-center rounded-lg border px-4 font-semibold focus-visible:outline-none"
            >
              ← Back to Trips
            </GuardedTripLink>
          </div>
        </main>
      </div>
    );
  }

  if (error && (!data || !trip)) {
    return (
      <div className="trip-workspace-state-frame">
        <TripWorkspaceBackground />
        <main className="relative z-10 flex min-h-[100dvh] items-center justify-center p-6 text-center">
          <div className="trip-workspace-state-panel max-w-lg px-8 py-10" role="alert">
          <h1 tabIndex={-1} className="trip-workspace-state-panel__title text-2xl">System Initialization Error</h1>
          <p className="trip-workspace-state-panel__copy mt-3">{error}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="trip-workspace-state-panel__action mt-5 min-h-11 rounded-lg border px-4 text-sm font-semibold focus-visible:outline-none"
          >
            Try again
          </button>
          </div>
        </main>
      </div>
    );
  }

  if (!data || !trip || roleLoading || isLoading) return <AuthenticatedTripsLoader />;

  return (
    <div className="trip-workspace-shell min-h-[100dvh] text-text-main" data-trip-app-shell>
      <TripWorkspaceBackground trip={trip} />
      <a
        href="#trip-main"
        className="fixed left-3 top-3 z-[var(--layer-critical)] -translate-y-20 rounded-md bg-card-bg px-4 py-2 text-sm font-semibold text-text-main shadow-lg focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-focus-ring"
      >
        Skip to trip content
      </a>

      <TripSidebar
        tripId={tripId}
        tripName={trip.name}
        tripLocation={
          [trip.lake_name, trip.site_name].filter(Boolean).join(' · ') ||
          trip.park_name ||
          'Campsite unavailable'
        }
        onMissionBrief={() =>
          setOpenedInfoDialog({ name: 'mission-brief', pathname })
        }
        onProjectIntel={() => setOpenedInfoDialog({ name: 'about', pathname })}
        onAppearance={
          editableActions
            ? () => setOpenedInfoDialog({ name: 'appearance', pathname })
            : undefined
        }
        onSignOut={handleSignOut}
      />

      <header className="trip-app-header relative z-[var(--layer-navigation)] border-b backdrop-blur md:sticky md:top-0">
        <div className="trip-shell-inner mx-auto flex max-w-[1600px] items-center gap-3 px-3 md:px-6 lg:px-8">
          <GuardedTripLink
            href="/trips"
            aria-label="Back to trips"
            className="trip-shell-control inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span className="hidden text-sm font-medium xl:inline">Back to Trips</span>
          </GuardedTripLink>

          <div
            className="trip-shell-identity min-w-0 flex-1"
            title={`${trip.name} · ${[trip.lake_name, trip.site_name].filter(Boolean).join(' · ') || trip.park_name}`}
          >
            <p className="truncate text-base font-semibold leading-tight">{trip.name}</p>
            <p className="trip-shell-location mt-0.5 truncate text-xs leading-tight">
              {[trip.lake_name, trip.site_name].filter(Boolean).join(' · ') ||
                trip.park_name ||
                'Campsite unavailable'}
            </p>
          </div>

          <div
            className="trip-navigation-desktop min-w-0 flex-1 justify-center"
            data-testid="desktop-trip-navigation-shell"
          >
            <TripPrimaryNav tripId={tripId} />
          </div>

          <div
            className="trip-navigation-desktop items-center gap-2"
            data-testid="desktop-trip-more-shell"
          >
            {!isPhoneLayout ? (
              <TripMoreMenu
                id="desktop-trip-more"
                tripId={tripId}
                onMissionBrief={() =>
                  setOpenedInfoDialog({ name: 'mission-brief', pathname })
                }
                onProjectIntel={() => setOpenedInfoDialog({ name: 'about', pathname })}
                onAppearance={
                  editableActions
                    ? () => setOpenedInfoDialog({ name: 'appearance', pathname })
                    : undefined
                }
                onSignOut={handleSignOut}
              />
            ) : null}
          </div>

          <div
            className="trip-navigation-mobile-more"
            data-testid="mobile-trip-more-shell"
          >
            {isPhoneLayout ? (
              <TripMoreMenu
                id="mobile-trip-more"
                tripId={tripId}
                onMissionBrief={() =>
                  setOpenedInfoDialog({ name: 'mission-brief', pathname })
                }
                onProjectIntel={() => setOpenedInfoDialog({ name: 'about', pathname })}
                onAppearance={
                  editableActions
                    ? () => setOpenedInfoDialog({ name: 'appearance', pathname })
                    : undefined
                }
                onSignOut={handleSignOut}
                mobile
              />
            ) : null}
          </div>
        </div>
      </header>

      {source === 'cache' || connectivity === 'checking' ? (
        <section
          className="trip-source-status relative z-[var(--layer-navigation)] border-b px-3 py-2 md:px-6"
          aria-label="Workspace connection status"
          role="status"
          aria-live="polite"
          data-workspace-source={source}
        >
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold">
                {connectivity === 'checking'
                  ? 'Checking connection…'
                  : connectivity === 'offline'
                    ? 'Offline · Read-only'
                    : 'Saved trip · Read-only'}
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {connectivity === 'checking'
                  ? 'Editing stays unavailable until access is verified.'
                  : 'Reconnect to make changes.'}
                {lastOnlineVerifiedAt ? (
                  <span className="sr-only">
                    {' '}Last verified online {new Date(lastOnlineVerifiedAt).toLocaleString()}.
                  </span>
                ) : null}
              </p>
            </div>
            {connectivity !== 'checking' ? (
              <button
                type="button"
                onClick={() => void reload()}
                disabled={isReloading}
                className="min-h-11 rounded-lg border border-border-subtle px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-60"
              >
                {isReloading ? 'Checking…' : 'Try again'}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <main
        ref={mainRef}
        id="trip-main"
        tabIndex={-1}
        aria-label={`${routeLabel} trip workspace`}
        className="trip-app-main relative scroll-mt-20"
      >
        {error ? (
          <div
            className="trip-section-inline-alert mx-auto mt-4 flex max-w-[calc(1600px-2rem)] flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
            role="alert"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void reload()}
              disabled={isReloading}
              className="min-h-11 rounded-lg border border-border-subtle px-3 font-semibold hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-60"
            >
              {isReloading ? 'Retrying…' : 'Try again'}
            </button>
          </div>
        ) : null}
        {children}
      </main>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {routeAnnouncement}
      </div>

      <TripMobileNav tripId={tripId} />

      <MissionBriefModal
        isOpen={activeInfoDialog === 'mission-brief'}
        onClose={() => setOpenedInfoDialog(null)}
      />
      <ProjectIntelModal
        isOpen={activeInfoDialog === 'about'}
        onClose={() => setOpenedInfoDialog(null)}
      />
      {activeInfoDialog === 'appearance' && editableActions ? (
        <TripAppearanceDialog
          isOpen
          currentTheme={data.settings.theme_variant}
          onSelect={editableActions.updateThemeVariant}
          onClose={() => setOpenedInfoDialog(null)}
        />
      ) : null}
    </div>
  );
}

export default function TripAppShell({ children }: { children: React.ReactNode }) {
  return (
    <PhoneLayoutProvider>
      <TripAppShellContent>{children}</TripAppShellContent>
    </PhoneLayoutProvider>
  );
}
