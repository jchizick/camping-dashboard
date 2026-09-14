'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { UserPlus } from 'lucide-react';
import { useTripAccessManagement } from './useTripAccessManagement';
import TripAccessSheet from './TripAccessSheet';
import './tripAccess.css';

const Context = createContext<{ available: boolean; show: () => void } | null>(null);
export const useTripAccess = () => useContext(Context);
export function TripAccessProvider({ tripId, eligible, children }: { tripId: string; eligible: boolean; children: ReactNode }) {
  const access = useTripAccessManagement(tripId, eligible);
  return <Context.Provider value={{ available: access.available, show: access.show }}>
    {children}
    {access.open && <TripAccessSheet access={access} />}
  </Context.Provider>;
}
export function TripAccessInvite() {
  const access = useTripAccess();
  return access?.available ? <button type="button" className="trip-access-invite" onClick={access.show} aria-haspopup="dialog">
    <UserPlus size={16} aria-hidden="true" />Invite
  </button> : null;
}
