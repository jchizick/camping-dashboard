'use client';

// ============================================================
// /trips/[tripId]/layout.tsx — Wraps trip dashboard in providers
// ============================================================

import React from 'react';
import { useParams } from 'next/navigation';
import TripAppShell from '@/components/trip/TripAppShell';
import { TripDraftGuardProvider } from '@/components/trip/TripDraftGuardProvider';
import { TripWorkspaceProvider } from '@/components/trip/TripWorkspaceProvider';
import { AuthProvider } from '@/lib/authContext';
import { TripProvider } from '@/lib/tripContext';

export default function TripLayout({ children }: { children: React.ReactNode }) {
  const { tripId } = useParams<{ tripId: string }>();

  return (
    <AuthProvider>
      <TripProvider tripId={tripId}>
        <TripDraftGuardProvider>
          <TripWorkspaceProvider>
            <TripAppShell>{children}</TripAppShell>
          </TripWorkspaceProvider>
        </TripDraftGuardProvider>
      </TripProvider>
    </AuthProvider>
  );
}
