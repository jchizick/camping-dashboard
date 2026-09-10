'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { canDeleteTrip, formatTripDates, getTripLocation } from '@/lib/tripsLanding';
import { rankDefaultTrips } from '@/lib/defaultTripResolver';
import type { UserTrip } from '@/lib/fetchDashboard';
import GuardedTripLink from '@/components/trip/GuardedTripLink';
import { useOptionalTripDraftGuard } from '@/components/trip/TripDraftGuardProvider';
import { useOptionalTripWorkspaceStatus } from '@/components/trip/TripWorkspaceStatus';
import { usePhoneLayout } from '@/components/trip/PhoneLayoutProvider';
import CrudSheet from '@/components/ui/CrudSheet';
import { useOverlayDialog } from '@/components/ui/useOverlayDialog';
import { useTripList } from './TripListProvider';
import { deleteOwnedTrip, deletedTripDestination } from './tripManagement';
import './tripSwitcher.css';

function DesktopChooser({ anchor, onClose, children }: {
  anchor: RefObject<HTMLButtonElement | null>; onClose: () => void; children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [position, setPosition] = useState({ left: 16, top: 16 });
  useOverlayDialog(true, panel);
  useLayoutEffect(() => {
    const positionPanel = () => {
      const rect = anchor.current?.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - 32);
      const height = Math.min(600, window.innerHeight - 32);
      setPosition({ left: Math.max(16, Math.min(rect?.right ?? 16, window.innerWidth - width - 16)),
        top: Math.max(16, Math.min(rect?.top ?? 16, window.innerHeight - height - 16)) });
    };
    positionPanel();
    window.addEventListener('resize', positionPanel);
    return () => window.removeEventListener('resize', positionPanel);
  }, [anchor]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);
  return createPortal(<div className="trip-chooser-overlay" onClick={onClose}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
      className="trip-chooser-popover" style={position} onClick={(event) => event.stopPropagation()}>
      <div className="trip-chooser-header"><h2 id={titleId}>Your trips</h2><button type="button" onClick={onClose} aria-label="Close trip chooser">✕</button></div>
      {children}
    </div>
  </div>, document.body);
}

export default function TripSwitcher({ tripId, tripName, tripLocation }: {
  tripId: string; tripName: string; tripLocation: string;
}) {
  const list = useTripList();
  const workspace = useOptionalTripWorkspaceStatus();
  const guard = useOptionalTripDraftGuard();
  const router = useRouter();
  const phone = usePhoneLayout();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const online = Boolean(list.userId && workspace?.source === 'online' && workspace.connectivity === 'online');
  const capability = useRef(online);
  useEffect(() => { capability.current = online; }, [online]);
  useEffect(() => () => { capability.current = false; }, []);

  function showChooser() {
    setNow(new Date());
    setOpen(true);
    setDeleteError(null);
    if (online) void list.reload().catch(() => {});
  }
  const close = () => { if (!busyRef.current) setOpen(false); };

  async function remove(trip: UserTrip) {
    if (!online || busyRef.current || !canDeleteTrip(trip)) return;
    if (!window.confirm(`Delete "${trip.name}"? This also permanently deletes its prep-feed photos and cannot be undone.`)) return;
    setOpen(false); // Release the chooser focus trap before the draft guard dialog.
    const action = async () => {
      if (!capability.current || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setDeleteError(null);
      try {
        await deleteOwnedTrip(trip);
        if (!capability.current) return;
        list.invalidate();
        try {
          const remaining = await list.reload();
          if (!capability.current) return;
          if (trip.id === tripId) router.replace(deletedTripDestination(remaining.filter((item) => item.id !== trip.id), new Date()));
          else setOpen(true);
        } catch {
          if (!capability.current) return;
          if (trip.id === tripId) router.replace('/trips');
          else { setDeleteError('Trip deleted. The list could not be refreshed. Please retry.'); setOpen(true); }
        }
      } catch (error) {
        if (capability.current) {
          setDeleteError(error instanceof Error ? error.message : 'The trip could not be deleted.');
          setOpen(true);
        }
      } finally { busyRef.current = false; setBusy(false); }
    };
    if (guard) await guard.requestAction(action);
    else await action();
  }

  const ranked = rankDefaultTrips(list.trips, now);
  const groups = [
    ['Active', ranked.groups.active], ['Upcoming', ranked.groups.upcoming],
    ['Completed', ranked.groups.completed], ['Dates unavailable', ranked.invalidTrips],
  ] as const;
  const content = <div className="trip-chooser-content">
    <p className="trip-chooser-current">Current trip: <strong>{tripName}</strong></p>
    {!online ? <p role="status">Saved trip · Read-only. Reconnect to switch, create, or manage trips.</p> : <>
      {(list.status === 'idle' || list.status === 'loading') && <p role="status">Loading your trips…</p>}
      {list.status === 'error' && <div role="alert"><p>{list.error}</p><button type="button" onClick={() => void list.reload().catch(() => {})}>Retry</button></div>}
      {list.status === 'ready' && list.trips.length === 0 && <p role="status">No trips are available in this account.</p>}
      {list.status === 'ready' && <div className="trip-chooser-list">{groups.map(([label, trips]) => trips.length > 0 && <section key={label} aria-label={label}>
        <h3>{label}</h3><ul>{trips.map((trip) => <li key={trip.id}>
          {trip.id === tripId ? <div className="trip-chooser-trip" aria-current="true"><strong>{trip.name}</strong><span>{getTripLocation(trip)}</span><span>Current trip</span></div> :
            <GuardedTripLink className="trip-chooser-trip" href={`/trips/${encodeURIComponent(trip.id)}`} onClick={() => setOpen(false)}>
              <strong>{trip.name}</strong><span>{getTripLocation(trip)}</span><span>{label === 'Dates unavailable' ? label : formatTripDates(trip.start_date, trip.end_date)}</span>
            </GuardedTripLink>}
          {managing && canDeleteTrip(trip) && <button type="button" className="trip-chooser-delete" disabled={busy} onClick={() => void remove(trip)} aria-label={`Delete ${trip.name}`}>Delete trip</button>}
        </li>)}</ul>
      </section>)}</div>}
      {deleteError && <p role="alert">{deleteError}</p>}
      <div className="trip-chooser-actions">
        <GuardedTripLink href="/trips/new" onClick={() => setOpen(false)}>New Trip</GuardedTripLink>
        {list.status === 'ready' && list.trips.some(canDeleteTrip) && <button type="button" aria-pressed={managing} onClick={() => setManaging(!managing)}>{managing ? 'Done managing' : 'Manage trips'}</button>}
      </div>
    </>}
  </div>;

  return <div className={`trip-switcher${phone ? ' trip-switcher--phone' : ''}`}>
    <button ref={trigger} type="button" className="trip-switcher-trigger" aria-label={`Switch trip: ${tripName}`} aria-haspopup="dialog" aria-expanded={open} onClick={showChooser} disabled={busy}>
      <span><strong>{tripName}</strong><span>{tripLocation}</span></span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {busy && <span role="status">Deleting trip…</span>}
    {open && (phone ? <CrudSheet isOpen onClose={close} title="Your trips" surface="workspace" panelClassName="trip-chooser-sheet">{content}</CrudSheet> : <DesktopChooser anchor={trigger} onClose={close}>{content}</DesktopChooser>)}
  </div>;
}
