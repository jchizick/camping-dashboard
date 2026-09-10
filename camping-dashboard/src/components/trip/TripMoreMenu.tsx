'use client';
import { useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { BookOpenText, MoreHorizontal } from 'lucide-react';
import GuardedTripLink from './GuardedTripLink';
import { tripDestinationHref } from './tripNavigation';
import CrudSheet from '@/components/ui/CrudSheet';
import WorkspacePopover from './WorkspacePopover';
import { AccountActions } from './WorkspaceAccount';

interface TripMoreMenuProps {
  id: string; tripId: string; onProjectIntel: () => void; onSignOut: () => Promise<void>;
  mobile?: boolean; placement?: 'below' | 'sidebar';
}
export default function TripMoreMenu({ id, tripId, onProjectIntel, onSignOut, mobile = false }: TripMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const fieldLogHref = tripDestinationHref(tripId, 'field-log');
  function run(action: () => void | Promise<void>) { setOpen(false); void action(); }
  // Fixed Mission Brief media has no explicit trip association. Hide until data-driven.
  const extras = <GuardedTripLink href={fieldLogHref} aria-current={pathname === fieldLogHref ? 'page' : undefined}
    className="workspace-extra-link" onClick={() => setOpen(false)}><BookOpenText size={17} aria-hidden="true" />Field Log</GuardedTripLink>;
  return <div>
    <button ref={trigger} type="button" aria-label={mobile ? 'More trip actions' : undefined} aria-haspopup="dialog"
      aria-expanded={open} onClick={() => setOpen(true)}
      className="trip-shell-control inline-flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2">
      <MoreHorizontal size={18} aria-hidden="true" />{!mobile && 'Trip Extras'}
    </button>
    {open && (mobile ? <CrudSheet isOpen title="More" onClose={() => setOpen(false)} surface="workspace" panelClassName="workspace-secondary-sheet">
      <section aria-labelledby={id + '-extras'}><h3 id={id + '-extras'}>Trip Extras</h3>{extras}</section>
      <section aria-label="Account"><h3>Account</h3><AccountActions onAbout={() => run(onProjectIntel)} onSignOut={() => run(onSignOut)} /></section>
    </CrudSheet> : <WorkspacePopover anchor={trigger} title="Trip Extras" onClose={() => setOpen(false)}>{extras}</WorkspacePopover>)}
  </div>;
}
