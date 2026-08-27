'use client';

import React, { createContext, useContext } from 'react';

export interface TripWorkspaceStatusValue {
  source: 'online' | 'cache';
  connectivity: 'online' | 'offline' | 'checking';
  navigationPath?: string | null;
  cachedAt: string | null;
  lastOnlineVerifiedAt: string | null;
  reload: () => Promise<void>;
}

const TripWorkspaceStatusContext =
  createContext<TripWorkspaceStatusValue | null>(null);

export function TripWorkspaceStatusProvider({
  value,
  children,
}: {
  value: TripWorkspaceStatusValue;
  children: React.ReactNode;
}) {
  return (
    <TripWorkspaceStatusContext.Provider value={value}>
      {children}
    </TripWorkspaceStatusContext.Provider>
  );
}

export function useOptionalTripWorkspaceStatus() {
  return useContext(TripWorkspaceStatusContext);
}
