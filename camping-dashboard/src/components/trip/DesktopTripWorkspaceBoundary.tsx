'use client';

import type { ReactNode } from 'react';
import { usePhoneLayout } from './PhoneLayoutProvider';
import './desktopTripWorkspace.css';

/**
 * Persistent composition seam shared by online and offline trip shells.
 * Reuse the existing shell div in both branches: an extra wrapper or a
 * different element type would change layout or remount shared route state.
 * The non-phone root owns the rail and document-flow main region supplied by
 * TripAppShell. Its route-content slot can later contain compact sections.
 */
export default function DesktopTripWorkspaceBoundary({ children }: { children: ReactNode }) {
  const isPhoneLayout = usePhoneLayout();

  if (isPhoneLayout) {
    return (
      <div className="trip-workspace-shell min-h-[100dvh] text-text-main" data-trip-app-shell>
        {children}
      </div>
    );
  }

  return (
    <div
      className="trip-workspace-shell min-h-[100dvh] text-text-main"
      data-trip-app-shell
      data-desktop-trip-workspace
    >
      {children}
    </div>
  );
}
