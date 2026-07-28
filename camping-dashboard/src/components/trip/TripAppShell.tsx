'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  BookOpenText,
  ChevronDown,
  FileText,
  LogOut,
  MoreHorizontal,
  Radio,
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { useTrip } from '@/lib/tripContext';
import MissionBriefModal from '@/components/ui/MissionBriefModal';
import ProjectIntelModal from '@/components/ui/ProjectIntelModal';
import TripMobileNav from './TripMobileNav';
import TripPrimaryNav from './TripPrimaryNav';
import { tripDestinationHref } from './tripNavigation';
import { useTripWorkspace } from './TripWorkspaceProvider';
import GuardedTripLink from './GuardedTripLink';
import { useOptionalTripDraftGuard } from './TripDraftGuardProvider';

interface MoreMenuProps {
  id: string;
  tripId: string;
  onMissionBrief: () => void;
  onProjectIntel: () => void;
  onSignOut: () => Promise<void>;
  mobile?: boolean;
}

function MoreMenu({
  id,
  tripId,
  onMissionBrief,
  onProjectIntel,
  onSignOut,
  mobile = false,
}: MoreMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const fieldLogHref = tripDestinationHref(tripId, 'field-log');
  const fieldLogActive = pathname === fieldLogHref;

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function runAction(action: () => void | Promise<void>) {
    setOpen(false);
    triggerRef.current?.focus();
    void action();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={mobile ? 'More trip actions' : undefined}
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={() => setOpen((current) => !current)}
        className={`trip-shell-control inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card-bg ${
          fieldLogActive
            ? 'border-accent-yellow/40 bg-accent-yellow/15 text-accent-yellow'
            : ''
        }`}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
        {!mobile && 'More'}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          id={`${id}-menu`}
          role="menu"
          className="trip-more-menu absolute right-0 top-[calc(100%+0.5rem)] z-[var(--layer-menu)] w-64 overflow-hidden rounded-2xl border p-2"
        >
          <GuardedTripLink
            href={fieldLogHref}
            role="menuitem"
            aria-current={fieldLogActive ? 'page' : undefined}
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-text-main hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <BookOpenText size={17} aria-hidden="true" />
            Field Log
          </GuardedTripLink>
          <button
            type="button"
            role="menuitem"
            onClick={() => runAction(onMissionBrief)}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-text-main hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Radio size={17} aria-hidden="true" />
            Mission Brief
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => runAction(onProjectIntel)}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-text-main hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <FileText size={17} aria-hidden="true" />
            About this app
          </button>
          <div className="my-1 border-t border-border-subtle" />
          <button
            type="button"
            role="menuitem"
            onClick={() => runAction(onSignOut)}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-accent-red hover:bg-accent-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <LogOut size={17} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function WorkspaceLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-app-bg font-sans">
      <style>{`
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes spin-reverse { to { transform: rotate(-360deg); } }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0.2; }
          100% { transform: scale(0.8); opacity: 0.6; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        className="flex flex-col items-center gap-8 [animation:fade-up_0.6s_ease_forwards]"
        role="status"
        aria-live="polite"
      >
        <div className="relative flex h-[120px] w-[120px] items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-accent-yellow/25 [animation:pulse-ring_2.4s_ease-in-out_infinite]" />
          <div className="absolute inset-3 rounded-full border border-accent-yellow/35 [animation:pulse-ring_2.4s_ease-in-out_infinite_0.4s]" />
          <div className="absolute inset-1 rounded-full border-2 border-transparent border-r-accent-yellow/20 border-t-accent-yellow/70 [animation:spin-slow_1.8s_linear_infinite]" />
          <div className="absolute inset-5 rounded-full border border-transparent border-b-accent-yellow/50 border-l-accent-yellow/15 [animation:spin-reverse_1.2s_linear_infinite]" />
          <div className="h-2 w-2 rounded-full bg-accent-yellow shadow-[0_0_12px_3px_color-mix(in_srgb,var(--accent-yellow)_50%,transparent)]" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-widest text-text-main/90">
          Loading Trip Dashboard
          <span className="[animation:blink_1.2s_step-end_infinite]">_</span>
        </p>
      </div>
    </main>
  );
}

export default function TripAppShell({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const draftGuard = useOptionalTripDraftGuard();
  const {
    tripId,
    isLoading: roleLoading,
    error: roleError,
  } = useTrip();
  const { data, trip, error, isLoading, isReloading, reload } = useTripWorkspace();
  const [missionBriefOpen, setMissionBriefOpen] = useState(false);
  const [projectIntelOpen, setProjectIntelOpen] = useState(false);
  const pathname = usePathname();
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
            ? 'Field Guide'
            : pathname.endsWith('/field-log')
              ? 'Field Log'
              : 'Trip Home';

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
      <main className="dashboard theme-night flex min-h-screen items-center justify-center p-8 text-center">
        <div>
          <h1 className="mb-4 text-2xl text-[#ffb74d]">Access Denied</h1>
          <p className="text-white/70">{roleError}</p>
          <GuardedTripLink
            href="/trips"
            className="mt-4 inline-block text-[#eab308] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#eab308]"
          >
            ← Back to Trips
          </GuardedTripLink>
        </div>
      </main>
    );
  }

  if (error && (!data || !trip)) {
    return (
      <main className="dashboard theme-night min-h-screen p-8 text-center">
        <h1 className="text-2xl text-[#ffb74d]">System Initialization Error</h1>
        <p className="text-white/70">{error}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-5 min-h-11 rounded-lg border border-[#eab308]/40 px-4 text-sm font-semibold text-[#eab308] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#eab308]"
        >
          Try again
        </button>
      </main>
    );
  }

  if (!data || !trip || roleLoading || isLoading) return <WorkspaceLoading />;

  return (
    <div className="min-h-screen bg-app-bg text-text-main" data-trip-app-shell>
      <a
        href="#trip-main"
        className="fixed left-3 top-3 z-[var(--layer-critical)] -translate-y-20 rounded-md bg-card-bg px-4 py-2 text-sm font-semibold text-text-main shadow-lg focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-focus-ring"
      >
        Skip to trip content
      </a>
      <div className="bg-topography" aria-hidden="true" />

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
            <MoreMenu
              id="desktop-trip-more"
              tripId={tripId}
              onMissionBrief={() => setMissionBriefOpen(true)}
              onProjectIntel={() => setProjectIntelOpen(true)}
              onSignOut={() =>
                draftGuard
                  ? draftGuard.requestAction(signOut).then(() => undefined)
                  : signOut()
              }
            />
          </div>

          <div
            className="trip-navigation-mobile-more"
            data-testid="mobile-trip-more-shell"
          >
            <MoreMenu
              id="mobile-trip-more"
              tripId={tripId}
              onMissionBrief={() => setMissionBriefOpen(true)}
              onProjectIntel={() => setProjectIntelOpen(true)}
              onSignOut={() =>
                draftGuard
                  ? draftGuard.requestAction(signOut).then(() => undefined)
                  : signOut()
              }
              mobile
            />
          </div>
        </div>
      </header>

      <main
        ref={mainRef}
        id="trip-main"
        tabIndex={-1}
        aria-label={`${routeLabel} trip workspace`}
        className="trip-app-main relative scroll-mt-20"
      >
        {error ? (
          <div
            className="mx-auto mt-4 flex max-w-[calc(1600px-2rem)] flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-text-main"
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
        isOpen={missionBriefOpen}
        onClose={() => setMissionBriefOpen(false)}
      />
      <ProjectIntelModal
        isOpen={projectIntelOpen}
        onClose={() => setProjectIntelOpen(false)}
      />
    </div>
  );
}
