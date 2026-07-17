'use client';

// ============================================================
// /trips/new/page.tsx — Trip Creation Form
// Submits to POST /api/trips/create for atomic server-side creation.
// App-shell page: defaults to Clean Light theme.
// ============================================================

import React, { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { ThemeProvider } from '@/lib/themeContext';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';

// Default settings for app-shell pages (no trip context yet)
const APP_SHELL_SETTINGS = {
  id: '',
  trip_id: '',
  manual_theme_override: 'day' as const,
  preferred_units: 'metric' as const,
  show_astro: false,
  show_meals: false,
  show_offline: false,
  show_crew: false,
  theme_variant: 'clean' as const,
};

export default function NewTripPage() {
  return (
    <AuthProvider>
      <ThemeProvider settings={APP_SHELL_SETTINGS}>
        <NewTripContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

function NewTripContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [parkName, setParkName] = useState('');
  const [lakeName, setLakeName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-app-bg">
        <div className="flex items-center gap-3 text-text-muted text-sm">
          <Loader2 size={18} className="animate-spin" />
          Loading...
        </div>
      </main>
    );
  }

  if (!user) {
    router.push('/trips');
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/trips/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          park_name: parkName,
          lake_name: lakeName,
          site_name: siteName,
          start_date: startDate,
          end_date: endDate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create trip');
      }

      router.push(`/trips/${data.tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-app-bg p-6 md:p-8 font-sans">
      <div className="max-w-[600px] mx-auto">
        {/* Back button */}
        <button
          onClick={() => router.push('/trips')}
          className="inline-flex items-center gap-1.5 text-text-muted text-sm bg-transparent border-none cursor-pointer mb-8 p-0 hover:text-text-main transition-colors"
        >
          <ArrowLeft size={14} /> Back to Trips
        </button>

        <h1 className="text-text-main text-2xl font-bold mb-2">
          Create New Trip
        </h1>
        <p className="text-text-muted text-sm mb-8 leading-relaxed">
          Fill in the basics — you can add gear, meals, and timeline details later.
        </p>

        {error && (
          <div className="p-3 mb-6 rounded-lg text-sm border"
            style={{
              background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)',
              borderColor: 'color-mix(in srgb, var(--accent-red) 25%, transparent)',
              color: 'var(--accent-red)',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="block text-text-muted text-xs font-semibold uppercase tracking-wide mb-1.5">
              Trip Name *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Algonquin Backcountry"
              required
              className="w-full px-3.5 py-2.5 bg-card-bg border border-border-subtle rounded-lg text-text-main text-sm outline-none transition-all duration-200 focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow/20 placeholder:text-text-muted/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-text-muted text-xs font-semibold uppercase tracking-wide mb-1.5">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-card-bg border border-border-subtle rounded-lg text-text-main text-sm outline-none transition-all duration-200 focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow/20"
              />
            </div>
            <div>
              <label className="block text-text-muted text-xs font-semibold uppercase tracking-wide mb-1.5">
                End Date *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-card-bg border border-border-subtle rounded-lg text-text-main text-sm outline-none transition-all duration-200 focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-text-muted text-xs font-semibold uppercase tracking-wide mb-1.5">
              Park Name
            </label>
            <input
              value={parkName}
              onChange={(e) => setParkName(e.target.value)}
              placeholder="e.g. Algonquin Provincial Park"
              className="w-full px-3.5 py-2.5 bg-card-bg border border-border-subtle rounded-lg text-text-main text-sm outline-none transition-all duration-200 focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow/20 placeholder:text-text-muted/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-text-muted text-xs font-semibold uppercase tracking-wide mb-1.5">
                Lake / Destination
              </label>
              <input
                value={lakeName}
                onChange={(e) => setLakeName(e.target.value)}
                placeholder="e.g. Maple Lake"
                className="w-full px-3.5 py-2.5 bg-card-bg border border-border-subtle rounded-lg text-text-main text-sm outline-none transition-all duration-200 focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow/20 placeholder:text-text-muted/50"
              />
            </div>
            <div>
              <label className="block text-text-muted text-xs font-semibold uppercase tracking-wide mb-1.5">
                Site
              </label>
              <input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="e.g. Site 4"
                className="w-full px-3.5 py-2.5 bg-card-bg border border-border-subtle rounded-lg text-text-main text-sm outline-none transition-all duration-200 focus:border-accent-yellow focus:ring-1 focus:ring-accent-yellow/20 placeholder:text-text-muted/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !name || !startDate || !endDate}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-semibold text-sm mt-2 transition-all duration-200 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
            style={{
              background: 'var(--accent-yellow)',
              color: 'white',
            }}
          >
            {isSubmitting ? (
              <><Loader2 size={18} className="animate-spin" /> Creating...</>
            ) : (
              <><Plus size={18} /> Create Trip</>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
