'use client';

// ============================================================
// /trips/[tripId]/layout.tsx — Wraps trip dashboard in providers
// ============================================================

import React from 'react';
import { useParams } from 'next/navigation';
import { AuthProvider } from '@/lib/authContext';
import { TripProvider } from '@/lib/tripContext';

export default function TripLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const tripId = params.tripId as string;

  return (
    <AuthProvider>
      <TripProvider tripId={tripId}>
        {children}
      </TripProvider>
    </AuthProvider>
  );
}
