'use client';

// ============================================================
// tripContext.tsx — Trip-scoped authorization provider
// Wraps trip dashboard pages to provide the user's role on the
// current trip. Fetches membership from trip_members table.
// ============================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { TripMemberRole } from '@/types';
import { supabase } from '@/lib/supabase';
import { toTripMemberRole } from './dashboardMapper';

// ── Context shape ─────────────────────────────────────────────────────────────
interface TripContextValue {
  tripId: string;
  role: TripMemberRole | null;
  canEdit: boolean;
  isOwner: boolean;
  isLoading: boolean;
  error: string | null;
}

const TripContext = createContext<TripContextValue>({
  tripId: '',
  role: null,
  canEdit: false,
  isOwner: false,
  isLoading: true,
  error: null,
});

// ── Provider ──────────────────────────────────────────────────────────────────
export function TripProvider({
  tripId,
  children,
}: {
  tripId: string;
  children: React.ReactNode;
}) {
  const [role, setRole] = useState<TripMemberRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) {
            setRole(null);
            setError('Not signed in');
            setIsLoading(false);
          }
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('trip_members')
          .select('role')
          .eq('trip_id', tripId)
          .eq('user_id', user.id)
          .single();

        if (!cancelled) {
          if (fetchError || !data) {
            setRole(null);
            setError('You are not a member of this trip');
          } else {
            setRole(toTripMemberRole(data.role));
            setError(null);
          }
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to verify trip membership');
          setIsLoading(false);
        }
      }
    }

    loadRole();
    return () => { cancelled = true; };
  }, [tripId]);

  const canEdit = role === 'owner' || role === 'editor';
  const isOwner = role === 'owner';

  return (
    <TripContext.Provider value={{ tripId, role, canEdit, isOwner, isLoading, error }}>
      {children}
    </TripContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useTrip() {
  return useContext(TripContext);
}
