'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { TripMemberRole } from '@/types';
import { supabase } from '@/lib/supabase';
import { toTripMemberRole } from './dashboardMapper';
import { useAuth } from './authContext';
import {
  tripRepository,
  type TripRepositoryResult,
} from './tripRepository';

export type TripVerificationSource = 'online' | 'cache';
export type TripRevalidationResult = 'online' | 'cache' | 'denied';

interface TripContextValue {
  tripId: string;
  role: TripMemberRole | null;
  canEdit: boolean;
  isOwner: boolean;
  isLoading: boolean;
  error: string | null;
  verificationSource: TripVerificationSource | null;
  cachedWorkspace: TripRepositoryResult | null;
  revalidateAccess: () => Promise<TripRevalidationResult>;
}

const TripContext = createContext<TripContextValue>({
  tripId: '',
  role: null,
  canEdit: false,
  isOwner: false,
  isLoading: true,
  error: null,
  verificationSource: null,
  cachedWorkspace: null,
  revalidateAccess: async () => 'denied',
});

function isExplicitMembershipDenial(error: {
  code?: string;
  status?: number;
} | null) {
  return (
    error?.code === 'PGRST116' ||
    error?.status === 401 ||
    error?.status === 403 ||
    error?.status === 404
  );
}

export function TripProvider({
  tripId,
  children,
  initialCachedWorkspace,
}: {
  tripId: string;
  children: React.ReactNode;
  initialCachedWorkspace?: TripRepositoryResult;
}) {
  const { identity, isLoading: authLoading } = useAuth();
  const [role, setRole] = useState<TripMemberRole | null>(
    initialCachedWorkspace?.verifiedRole ?? null
  );
  const [verificationSource, setVerificationSource] =
    useState<TripVerificationSource | null>(
      initialCachedWorkspace ? 'cache' : null
    );
  const [cachedWorkspace, setCachedWorkspace] =
    useState<TripRepositoryResult | null>(initialCachedWorkspace ?? null);
  const [isLoading, setIsLoading] = useState(!initialCachedWorkspace);
  const [error, setError] = useState<string | null>(null);

  const readCachedAccess = useCallback(async (): Promise<TripRevalidationResult> => {
    const cached = await tripRepository.readOfflineTrip({ tripId });
    if (cached.status === 'available') {
      setRole(cached.workspace.verifiedRole);
      setVerificationSource('cache');
      setCachedWorkspace(cached.workspace);
      setError(null);
      return 'cache';
    }
    setRole(null);
    setVerificationSource(null);
    setCachedWorkspace(null);
    setError(
      cached.status === 'expired'
        ? 'Reconnect to verify access to this saved trip.'
        : 'Trip access could not be verified and no eligible saved trip is available.'
    );
    return 'denied';
  }, [tripId]);

  const revalidateAccess = useCallback(async (): Promise<TripRevalidationResult> => {
    if (!identity) {
      setRole(null);
      setVerificationSource(null);
      setCachedWorkspace(null);
      setError('Not signed in');
      return 'denied';
    }

    setIsLoading(true);
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) return await readCachedAccess();
      if (!userData.user || userData.user.id !== identity.userId) {
        setRole(null);
        setVerificationSource(null);
        setCachedWorkspace(null);
        setError('Not signed in');
        try {
          await tripRepository.clearUserCache({ userId: identity.userId });
        } catch (cacheError) {
          console.error('[tripContext] Denied user cache could not be cleared.', cacheError);
        }
        return 'denied';
      }

      const { data, error: fetchError } = await supabase
        .from('trip_members')
        .select('role')
        .eq('trip_id', tripId)
        .eq('user_id', userData.user.id)
        .single();

      if (fetchError || !data) {
        if (isExplicitMembershipDenial(fetchError) || (!fetchError && !data)) {
          setRole(null);
          setVerificationSource(null);
          setCachedWorkspace(null);
          setError('You are not a member of this trip');
          try {
            await tripRepository.clearCachedTrip({
              userId: identity.userId,
              tripId,
            });
          } catch (cacheError) {
            console.error('[tripContext] Denied trip cache could not be cleared.', cacheError);
          }
          return 'denied';
        }
        return await readCachedAccess();
      }

      const verifiedRole = toTripMemberRole(data.role);
      setRole(verifiedRole);
      setVerificationSource('online');
      setCachedWorkspace(null);
      setError(null);
      return 'online';
    } catch {
      return await readCachedAccess();
    } finally {
      setIsLoading(false);
    }
  }, [identity, readCachedAccess, tripId]);

  useEffect(() => {
    if (initialCachedWorkspace || authLoading) return;
    void revalidateAccess();
  }, [authLoading, initialCachedWorkspace, revalidateAccess]);

  const canEdit =
    verificationSource === 'online' && (role === 'owner' || role === 'editor');
  const isOwner = role === 'owner';

  return (
    <TripContext.Provider
      value={{
        tripId,
        role,
        canEdit,
        isOwner,
        isLoading,
        error,
        verificationSource,
        cachedWorkspace,
        revalidateAccess,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  return useContext(TripContext);
}
