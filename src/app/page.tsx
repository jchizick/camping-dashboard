'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { GearItem, ThemeOverride } from '@/types';
import { mockDashboardData } from '@/lib/mockData';
import {
  getTripCountdown,
  getThemeModeFromTime,
  calculateGearReadiness,
  calculateMealCompleteness,
  calculateOfflineReadiness,
  calculateTimelineCompleteness,
  calculateWeatherPreparedness,
  calculateOverallReadiness,
  getTripDays,
} from '@/lib/helpers';

import HeroHeader from '@/components/cards/HeroHeader';
import CountdownCard from '@/components/cards/CountdownCard';
import WeatherCard from '@/components/cards/WeatherCard';
import ForecastCard from '@/components/cards/ForecastCard';
import MapRouteCard from '@/components/cards/MapRouteCard';
import GearChecklistCard from '@/components/cards/GearChecklistCard';
import TimelineCard from '@/components/cards/TimelineCard';
import ParkIntelCard from '@/components/cards/ParkIntelCard';
import ReadinessScoreCard from '@/components/cards/ReadinessScoreCard';
import MealPlannerCard from '@/components/cards/MealPlannerCard';
import CrewRosterCard from '@/components/cards/CrewRosterCard';
import OfflineVaultCard from '@/components/cards/OfflineVaultCard';
import AstroCard from '@/components/cards/AstroCard';
import AlertsCard from '@/components/cards/AlertsCard';

export default function TripDashboardPage() {
  // ── Server/mock data (in Phase 2 this becomes a Supabase fetch) ──
  const data = mockDashboardData;

  // ── Local UI state (never mixed with server data) ────────────────
  const [themeOverride, setThemeOverride] = useState<ThemeOverride>(
    data.settings.manual_theme_override
  );
  const [gear, setGear] = useState<GearItem[]>(data.gear);
  const [countdown, setCountdown] = useState(() => getTripCountdown(data.trip.start_date));
  const [isMounted, setIsMounted] = useState(false);

  // Hydration guard — prevent SSR/client time mismatch
  useEffect(() => { setIsMounted(true); }, []);

  // Live countdown ticker
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(getTripCountdown(data.trip.start_date));
    }, 1000);
    return () => clearInterval(id);
  }, [data.trip.start_date]);

  // ── Derived values (all computed from helpers, never inline) ─────
  const sunriseHour = parseInt(data.currentWeather.sunrise_time.split(':')[0], 10);
  const sunsetHour = parseInt(data.currentWeather.sunset_time.split(':')[0], 10);
  // Use 10 (daytime) as SSR placeholder; isMounted ensures client value is used after hydration
  const currentHour = isMounted ? new Date().getHours() : 10;

  const themeMode = useMemo(
    () => getThemeModeFromTime(currentHour, sunriseHour, sunsetHour, themeOverride),
    [currentHour, sunriseHour, sunsetHour, themeOverride]
  );

  const tripDays = useMemo(
    () => getTripDays(data.trip.start_date, data.trip.end_date),
    [data.trip.start_date, data.trip.end_date]
  );

  const gearReadiness = useMemo(() => calculateGearReadiness(gear), [gear]);
  const mealReadiness = useMemo(
    () => calculateMealCompleteness(data.meals, tripDays),
    [data.meals, tripDays]
  );
  const offlineReadiness = useMemo(
    () => calculateOfflineReadiness(data.offlineStatus),
    [data.offlineStatus]
  );
  const timelineReadiness = useMemo(
    () => calculateTimelineCompleteness(data.timeline, tripDays),
    [data.timeline, tripDays]
  );
  const weatherReadiness = useMemo(
    () => calculateWeatherPreparedness(data.currentWeather, data.forecast),
    [data.currentWeather, data.forecast]
  );

  const readiness = useMemo(
    () =>
      calculateOverallReadiness({
        gear: gearReadiness,
        meals: mealReadiness,
        weather: weatherReadiness,
        offline: offlineReadiness,
        timeline: timelineReadiness,
      }),
    [gearReadiness, mealReadiness, weatherReadiness, offlineReadiness, timelineReadiness]
  );

  // ── Event handlers ────────────────────────────────────────────────
  function handleThemeToggle() {
    setThemeOverride((prev) => {
      if (prev === 'auto') return 'day';
      if (prev === 'day') return 'night';
      return 'auto';
    });
  }

  function handleGearToggle(id: string) {
    setGear((prev) =>
      prev.map((g) => (g.id === id ? { ...g, packed: !g.packed } : g))
    );
  }

  // ── Active alerts count ───────────────────────────────────────────
  const activeAlertsCount = data.alerts.filter((a) => a.is_active).length;

  return (
    <main
      className={`dashboard theme-${themeMode}`}
      data-theme={themeMode}
    >
      {/* Atmospheric background layers */}
      <div className="dashboard__bg" aria-hidden="true">
        <div className="dashboard__bg-gradient" />
        <div className="dashboard__bg-texture" />
        {themeMode === 'night' && <div className="dashboard__bg-stars" />}
      </div>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <HeroHeader
        trip={data.trip}
        weather={data.currentWeather}
        readiness={readiness}
        countdown={countdown}
        themeMode={themeMode}
        themeOverride={themeOverride}
        onThemeToggle={handleThemeToggle}
      />

      {/* ── Dashboard Grid ───────────────────────────────────────── */}
      <section className="dashboard__grid">

        {/* ── Row A: Route + Route Support ─── */}
        <div className="dashboard__row dashboard__row--route">
          <div className="dashboard__col dashboard__col--map">
            <MapRouteCard trip={data.trip} />
          </div>
          <div className="dashboard__col dashboard__col--sidebar">
            <WeatherCard weather={data.currentWeather} astro={data.astro} />
          </div>
        </div>

        {/* ── Row B: Forecast + Readiness ─── */}
        <div className="dashboard__row dashboard__row--forecast">
          <div className="dashboard__col dashboard__col--forecast">
            <ForecastCard forecast={data.forecast} />
          </div>
          <div className="dashboard__col dashboard__col--readiness">
            <ReadinessScoreCard readiness={readiness} />
          </div>
        </div>

        {/* ── Row C: Gear + Timeline ─────── */}
        <div className="dashboard__row dashboard__row--prep">
          <div className="dashboard__col dashboard__col--gear">
            <GearChecklistCard gear={gear} onToggle={handleGearToggle} />
          </div>
          <div className="dashboard__col dashboard__col--timeline">
            <TimelineCard events={data.timeline} tripDays={tripDays} />
          </div>
        </div>

        {/* ── Row D: Park Intel + Alerts ─── */}
        <div className="dashboard__row dashboard__row--intel">
          <div className="dashboard__col dashboard__col--park">
            <ParkIntelCard intel={data.parkIntel} />
          </div>
          <div className="dashboard__col dashboard__col--alerts">
            <AlertsCard alerts={data.alerts} />
          </div>
        </div>

        {/* ── Row E: Phase 2 cards ──────── */}
        {(data.settings.show_meals || data.settings.show_crew || data.settings.show_offline) && (
          <div className="dashboard__row dashboard__row--logistics">
            {data.settings.show_meals && (
              <div className="dashboard__col">
                <MealPlannerCard meals={data.meals} totalDays={tripDays} />
              </div>
            )}
            {data.settings.show_crew && (
              <div className="dashboard__col">
                <CrewRosterCard crew={data.crew} />
              </div>
            )}
            {data.settings.show_offline && (
              <div className="dashboard__col">
                <OfflineVaultCard status={data.offlineStatus} />
              </div>
            )}
          </div>
        )}

        {/* ── Row F: Astro (Phase 3) ────── */}
        {data.settings.show_astro && (
          <div className="dashboard__row dashboard__row--astro">
            <div className="dashboard__col dashboard__col--astro">
              <AstroCard astro={data.astro} weather={data.currentWeather} />
            </div>
          </div>
        )}

      </section>

      <footer className="dashboard__footer">
        <p>Algonquin Wilderness Mission Control · Mock data · Last updated {new Date().toLocaleDateString('en-CA')}</p>
      </footer>
    </main>
  );
}
