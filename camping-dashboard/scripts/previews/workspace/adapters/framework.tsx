import type { ComponentProps, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TripWorkspaceStatusValue } from '../historical/components/trip/TripWorkspaceStatus';

// Capture-only adapters. They have no client code, services, or event effects.
export function GuardedTripLink({ children, ...props }: ComponentProps<'a'>) {
  return <a {...props}>{children}</a>;
}
export function HiddenSurface(props: { children?: ReactNode; [key: string]: unknown }) {
  void props;
  return null;
}
export function usePhoneLayout() { return false; }
export function useDesktopActiveSection(navigationPath: string | null, tripId: string) {
  void navigationPath;
  return '/trips/' + tripId;
}
export function useOptionalTripWorkspaceStatus(): TripWorkspaceStatusValue {
  return { source: 'online', connectivity: 'online', navigationPath: '/trips/demo',
    cachedAt: null, lastOnlineVerifiedAt: null, reload: async () => {} };
}
export function TripSwitcher({ tripId, tripName, tripLocation }: {
  tripId: string; tripName: string; tripLocation: string;
}) {
  void tripId;
  return <div className="trip-switcher">
    <button type="button" className="trip-switcher-trigger" aria-expanded={false}>
      <span><strong>{tripName}</strong><span>{tripLocation}</span></span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  </div>;
}
