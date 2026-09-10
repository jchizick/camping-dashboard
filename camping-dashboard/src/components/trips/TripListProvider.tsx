'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/authContext';
import { fetchUserTrips, type UserTrip } from '@/lib/fetchDashboard';

type ListState =
  | { status: 'idle' | 'loading'; trips: readonly UserTrip[]; error: null }
  | { status: 'ready'; trips: readonly UserTrip[]; error: null }
  | { status: 'error'; trips: readonly UserTrip[]; error: string };

type TripListValue = ListState & {
  userId: string | null;
  reload: () => Promise<readonly UserTrip[]>;
  invalidate: () => void;
};

const TripListContext = createContext<TripListValue | null>(null);
const initialState: ListState = { status: 'idle', trips: [], error: null };

function UserTripList({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [state, setState] = useState<ListState>(initialState);
  const request = useRef<Promise<readonly UserTrip[]> | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);

  const invalidate = useCallback(() => {
    generation.current += 1;
    request.current = null;
    setState(initialState);
  }, []);

  const reload = useCallback((): Promise<readonly UserTrip[]> => {
    if (request.current) return request.current;
    if (!userId) return Promise.reject(new Error('Reconnect to load your trips.'));
    const revision = generation.current;
    setState({ status: 'loading', trips: [], error: null });
    const pending = fetchUserTrips(userId).then((trips) => {
      if (revision !== generation.current) throw new Error('Trip list request is no longer current.');
      setState({ status: 'ready', trips, error: null });
      return trips;
    }).catch((error: unknown) => {
      if (revision === generation.current) {
        setState({ status: 'error', trips: [], error: 'Trips unavailable. Please try again.' });
      }
      throw error;
    }).finally(() => {
      if (revision === generation.current) request.current = null;
    });
    request.current = pending;
    return pending;
  }, [userId]);

  const value = useMemo(() => ({ ...state, userId, reload, invalidate }), [state, userId, reload, invalidate]);
  return <TripListContext.Provider value={value}>{children}</TripListContext.Provider>;
}

/** No trip-ID dependency and no eager network request; account changes reset the scope. */
export function TripListProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return <UserTripList key={userId ?? 'signed-out'} userId={userId}>{children}</UserTripList>;
}

export function useTripList() {
  const value = useContext(TripListContext);
  if (!value) throw new Error('useTripList must be used within TripListProvider');
  return value;
}
