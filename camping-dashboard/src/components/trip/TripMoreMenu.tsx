'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  BookOpenText,
  ChevronDown,
  FileText,
  LogOut,
  MoreHorizontal,
  Radio,
} from 'lucide-react';
import GuardedTripLink from './GuardedTripLink';
import { tripDestinationHref } from './tripNavigation';

interface TripMoreMenuProps {
  id: string;
  tripId: string;
  onMissionBrief: () => void;
  onProjectIntel: () => void;
  onSignOut: () => Promise<void>;
  mobile?: boolean;
  placement?: 'below' | 'sidebar';
}

export default function TripMoreMenu({
  id,
  tripId,
  onMissionBrief,
  onProjectIntel,
  onSignOut,
  mobile = false,
  placement = 'below',
}: TripMoreMenuProps) {
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
          placement === 'sidebar' ? 'w-full justify-between' : ''
        } ${
          fieldLogActive
            ? 'border-accent-yellow/40 bg-accent-yellow/15 text-accent-yellow'
            : ''
        }`}
      >
        <span className="inline-flex items-center gap-2">
          <MoreHorizontal size={18} aria-hidden="true" />
          {!mobile && 'More'}
        </span>
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
          aria-label="More trip actions"
          className={`trip-more-menu absolute z-[var(--layer-menu)] w-64 overflow-hidden rounded-2xl border p-2 ${
            placement === 'sidebar'
              ? 'bottom-0 left-[calc(100%+0.75rem)]'
              : 'right-0 top-[calc(100%+0.5rem)]'
          }`}
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
