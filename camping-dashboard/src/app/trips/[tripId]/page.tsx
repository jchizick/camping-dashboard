'use client';

// ============================================================
// /trips/[tripId]/page.tsx — Trip Dashboard Page
// Loads dashboard data for a specific trip and renders the shell.
// ============================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { DashboardData } from '@/types';
import { fetchDashboardData } from '@/lib/fetchDashboard';
import { useTrip } from '@/lib/tripContext';
import DashboardShell from '@/components/DashboardShell';

export default function TripDashboardPage() {
  const params = useParams();
  const tripId = params.tripId as string;
  const { isLoading: roleLoading, error: roleError } = useTrip();

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (roleLoading || roleError) return;

    fetchDashboardData(tripId)
      .then(setData)
      .catch((err) => {
        console.error('Fetch failed:', err);
        setError(err.message || 'Failed to load trip data.');
      });
  }, [tripId, roleLoading, roleError]);

  // ── Role error (not a member) ────────────────────────────────────
  if (roleError) {
    return (
      <main className="dashboard theme-night" style={{ padding: '2rem', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>
          <h2 style={{ color: '#ffb74d', fontSize: '1.5rem', marginBottom: '1rem' }}>Access Denied</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>{roleError}</p>
          <Link href="/trips" style={{ color: '#eab308', marginTop: '1rem', display: 'inline-block', textDecoration: 'underline' }}>
            ← Back to Trips
          </Link>
        </div>
      </main>
    );
  }

  // ── Data error ───────────────────────────────────────────────────
  if (error) {
    return (
      <main className="dashboard theme-night" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#ffb74d' }}>System Initialization Error</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>{error}</p>
      </main>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────
  if (!data || roleLoading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-app-bg font-sans">
        <style>{`
          @keyframes spin-slow { to { transform: rotate(360deg); } }
          @keyframes spin-reverse { to { transform: rotate(-360deg); } }
          @keyframes pulse-ring {
            0% { transform: scale(0.8); opacity: 0.6; }
            50% { transform: scale(1.15); opacity: 0.2; }
            100% { transform: scale(0.8); opacity: 0.6; }
          }
          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          @keyframes fade-up {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', animation: 'fade-up 0.6s ease forwards' }}>
          <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px solid color-mix(in srgb, var(--accent-yellow) 25%, transparent)', animation: 'pulse-ring 2.4s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', inset: '12px', borderRadius: '50%', border: '1px solid color-mix(in srgb, var(--accent-yellow) 35%, transparent)', animation: 'pulse-ring 2.4s ease-in-out infinite 0.4s' }} />
            <div style={{ position: 'absolute', inset: '4px', borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'color-mix(in srgb, var(--accent-yellow) 70%, transparent)', borderRightColor: 'color-mix(in srgb, var(--accent-yellow) 20%, transparent)', animation: 'spin-slow 1.8s linear infinite' }} />
            <div style={{ position: 'absolute', inset: '20px', borderRadius: '50%', border: '1.5px solid transparent', borderBottomColor: 'color-mix(in srgb, var(--accent-yellow) 50%, transparent)', borderLeftColor: 'color-mix(in srgb, var(--accent-yellow) 15%, transparent)', animation: 'spin-reverse 1.2s linear infinite' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-yellow)', boxShadow: '0 0 12px 3px color-mix(in srgb, var(--accent-yellow) 50%, transparent)' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p className="text-text-main/90 text-sm tracking-widest uppercase font-semibold">
              Loading Trip Dashboard
              <span style={{ animation: 'blink 1.2s step-end infinite' }}>_</span>
            </p>
          </div>
        </div>
      </main>
    );
  }

  return <DashboardShell data={data} />;
}
