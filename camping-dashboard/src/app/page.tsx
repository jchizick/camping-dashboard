'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { GearItem, Meal, TimelineEvent, CrewMember, Alert, DashboardData, OfflineStatus, ParkIntel } from '@/types';
import { fetchDashboardData } from '@/lib/fetchDashboard';
import { AuthProvider, useAuth } from '@/lib/authContext';
import {
  // Gear
  createGearItem, updateGearItem, deleteGearItem, toggleGearPacked,
  // Meals
  createMeal, updateMeal, deleteMeal,
  // Timeline
  createTimelineEvent, updateTimelineEvent, deleteTimelineEvent,
  // Crew
  createCrewMember, updateCrewMember, deleteCrewMember,
  // Alerts
  createAlert, deleteAlert,
  // Offline
  updateOfflineStatus,
  // Park Intel
  updateParkIntel,
} from '@/lib/mutations';
import {
  getTripCountdown,
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
  return (
    <AuthProvider>
      <DashboardLoader />
    </AuthProvider>
  );
}

function DashboardLoader() {
  const [initialData, setInitialData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData()
      .then((dashboardData) => {
        setInitialData(dashboardData);
      })
      .catch((err) => {
        console.error('Fetch failed:', err);
        setError(err.message || 'Failed to connect to Supabase database. Please try again.');
      });
  }, []);

  if (error) {
    return (
      <main className="dashboard theme-night" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#ffb74d' }}>System Initialization Error</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)' }}>{error}</p>
      </main>
    );
  }

  if (!initialData) {
    return (
      <main style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#121210',
        fontFamily: '"JetBrains Mono", "Courier New", monospace',
      }}>
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

          {/* Compass / Radar ring stack */}
          <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

            {/* Outer pulse ring */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              animation: 'pulse-ring 2.4s ease-in-out infinite',
            }} />

            {/* Middle pulse ring */}
            <div style={{
              position: 'absolute', inset: '12px', borderRadius: '50%',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              animation: 'pulse-ring 2.4s ease-in-out infinite 0.4s',
            }} />

            {/* Spinning outer arc */}
            <div style={{
              position: 'absolute', inset: '4px', borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: 'rgba(234, 179, 8, 0.7)',
              borderRightColor: 'rgba(234, 179, 8, 0.2)',
              animation: 'spin-slow 1.8s linear infinite',
            }} />

            {/* Spinning inner arc (reverse) */}
            <div style={{
              position: 'absolute', inset: '20px', borderRadius: '50%',
              border: '1.5px solid transparent',
              borderBottomColor: 'rgba(234, 179, 8, 0.5)',
              borderLeftColor: 'rgba(234, 179, 8, 0.15)',
              animation: 'spin-reverse 1.2s linear infinite',
            }} />

            {/* Center compass dot */}
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#eab308',
              boxShadow: '0 0 12px 3px rgba(234,179,8,0.5)',
            }} />
          </div>

          {/* Labels */}
          <div style={{ textAlign: 'center' }}>
            <p style={{
              color: '#eab308',
              fontSize: '0.7rem',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              margin: '0 0 0.5rem',
              opacity: 0.6,
            }}>
              Algonquin · Maple Lake
            </p>
            <p style={{
              color: 'rgba(243,244,246,0.9)',
              fontSize: '0.85rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              margin: 0,
              fontWeight: 600,
            }}>
              Initializing Mission Control
              <span style={{ animation: 'blink 1.2s step-end infinite' }}>_</span>
            </p>
          </div>

        </div>
      </main>
    );
  }

  return <DashboardContent data={initialData} />;
}

function DashboardContent({ data }: { data: DashboardData }) {
  // ── Auth ──────────────────────────────────────────────────────────
  const { isAuthorized } = useAuth();

  // ── User-authored state slices ───────────────────────────────────

  const [gear, setGear] = useState<GearItem[]>(data.gear);
  const [meals, setMeals] = useState<Meal[]>(data.meals);
  const [timeline, setTimeline] = useState<TimelineEvent[]>(data.timeline);
  const [crew, setCrew] = useState<CrewMember[]>(data.crew);
  const [alerts, setAlerts] = useState<Alert[]>(data.alerts);
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>(data.offlineStatus);
  const [parkIntel, setParkIntel] = useState<ParkIntel>(data.parkIntel);

  // ── Theme (locked to night) ───────────────────────────────────────
  const themeMode = 'night' as const;

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const [countdown, setCountdown] = useState(() => getTripCountdown(data.trip.start_date));

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(getTripCountdown(data.trip.start_date));
    }, 1000);
    return () => clearInterval(id);
  }, [data.trip.start_date]);

  const tripDays = useMemo(
    () => getTripDays(data.trip.start_date, data.trip.end_date),
    [data.trip.start_date, data.trip.end_date]
  );
  const gearReadiness = useMemo(() => calculateGearReadiness(gear), [gear]);
  const mealReadiness = useMemo(() => calculateMealCompleteness(meals, tripDays), [meals, tripDays]);
  const offlineReadiness = useMemo(() => calculateOfflineReadiness(offlineStatus), [offlineStatus]);
  const timelineReadiness = useMemo(() => calculateTimelineCompleteness(timeline, tripDays), [timeline, tripDays]);
  const weatherReadiness = useMemo(() => calculateWeatherPreparedness(data.currentWeather, data.forecast), [data.currentWeather, data.forecast]);

  const readiness = useMemo(
    () => calculateOverallReadiness({ gear: gearReadiness, meals: mealReadiness, weather: weatherReadiness, offline: offlineReadiness, timeline: timelineReadiness }),
    [gearReadiness, mealReadiness, weatherReadiness, offlineReadiness, timelineReadiness]
  );

  // ── Gear mutations ────────────────────────────────────────────────
  async function handleGearToggle(id: string) {
    const item = gear.find(g => g.id === id);
    if (!item) return;
    const newPacked = !item.packed;
    setGear(prev => prev.map(g => g.id === id ? { ...g, packed: newPacked } : g));
    const { error } = await toggleGearPacked(id, newPacked);
    if (error) {
      console.error('[toggleGear] Supabase write failed, reverting:', error.message);
      setGear(prev => prev.map(g => g.id === id ? { ...g, packed: item.packed } : g));
    }
  }

  async function handleGearAdd(item: Omit<GearItem, 'id' | 'trip_id'>) {
    const { data: newItem, error } = await createGearItem(item);
    if (error || !newItem) { console.error('[createGear]', error?.message); throw error; }
    setGear(prev => [...prev, newItem as GearItem]);
  }

  async function handleGearUpdate(id: string, patch: Partial<Omit<GearItem, 'id' | 'trip_id'>>) {
    const { data: updated, error } = await updateGearItem(id, patch);
    if (error || !updated) { console.error('[updateGear]', error?.message); throw error; }
    setGear(prev => prev.map(g => g.id === id ? updated as GearItem : g));
  }

  async function handleGearDelete(id: string) {
    const { error } = await deleteGearItem(id);
    if (error) { console.error('[deleteGear]', error.message); throw error; }
    setGear(prev => prev.filter(g => g.id !== id));
  }

  // ── Meal mutations ────────────────────────────────────────────────
  async function handleMealAdd(item: Omit<Meal, 'id' | 'trip_id'>) {
    const { data: newMeal, error } = await createMeal(item);
    if (error || !newMeal) { console.error('[createMeal]', error?.message); throw error; }
    setMeals(prev => [...prev, newMeal as Meal]);
  }

  async function handleMealUpdate(id: string, patch: Partial<Omit<Meal, 'id' | 'trip_id'>>) {
    const { data: updated, error } = await updateMeal(id, patch);
    if (error || !updated) { console.error('[updateMeal]', error?.message); throw error; }
    setMeals(prev => prev.map(m => m.id === id ? updated as Meal : m));
  }

  async function handleMealDelete(id: string) {
    const { error } = await deleteMeal(id);
    if (error) { console.error('[deleteMeal]', error.message); throw error; }
    setMeals(prev => prev.filter(m => m.id !== id));
  }

  // ── Timeline mutations ────────────────────────────────────────────
  async function handleTimelineAdd(event: Omit<TimelineEvent, 'id' | 'trip_id'>) {
    const { data: newEvent, error } = await createTimelineEvent(event);
    if (error || !newEvent) { console.error('[createTimeline]', error?.message); throw error; }
    setTimeline(prev => [...prev, newEvent as TimelineEvent]);
  }

  async function handleTimelineUpdate(id: string, patch: Partial<Omit<TimelineEvent, 'id' | 'trip_id'>>) {
    const { data: updated, error } = await updateTimelineEvent(id, patch);
    if (error || !updated) { console.error('[updateTimeline]', error?.message); throw error; }
    setTimeline(prev => prev.map(e => e.id === id ? updated as TimelineEvent : e));
  }

  async function handleTimelineDelete(id: string) {
    const { error } = await deleteTimelineEvent(id);
    if (error) { console.error('[deleteTimeline]', error.message); throw error; }
    setTimeline(prev => prev.filter(e => e.id !== id));
  }

  // ── Crew mutations ────────────────────────────────────────────────
  async function handleCrewAdd(member: Omit<CrewMember, 'id' | 'trip_id'>) {
    const { data: newMember, error } = await createCrewMember(member);
    if (error || !newMember) { console.error('[createCrew]', error?.message); throw error; }
    setCrew(prev => [...prev, newMember as CrewMember]);
  }

  async function handleCrewUpdate(id: string, patch: Partial<Omit<CrewMember, 'id' | 'trip_id'>>) {
    const { data: updated, error } = await updateCrewMember(id, patch);
    if (error || !updated) { console.error('[updateCrew]', error?.message); throw error; }
    setCrew(prev => prev.map(m => m.id === id ? updated as CrewMember : m));
  }

  async function handleCrewDelete(id: string) {
    const { error } = await deleteCrewMember(id);
    if (error) { console.error('[deleteCrew]', error.message); throw error; }
    setCrew(prev => prev.filter(m => m.id !== id));
  }

  // ── Alert mutations ───────────────────────────────────────────────
  async function handleAlertAdd(alertData: { title: string; body: string; severity: Alert['severity']; source: string; is_active: boolean }) {
    const { data: newAlert, error } = await createAlert(alertData);
    if (error || !newAlert) { console.error('[createAlert]', error?.message); throw error; }
    setAlerts(prev => [newAlert as Alert, ...prev]);
  }

  async function handleAlertDelete(id: string) {
    const { error } = await deleteAlert(id);
    if (error) { console.error('[deleteAlert]', error.message); throw error; }
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  // ── Park Intel mutations ─────────────────────────────────────────
  async function handleParkIntelUpdate(patch: Partial<Omit<ParkIntel, 'id' | 'trip_id' | 'updated_at'>>) {
    const { data: updated, error } = await updateParkIntel(parkIntel.id, patch);
    if (error || !updated) { console.error('[updateParkIntel]', error?.message); throw error; }
    setParkIntel(updated as ParkIntel);
  }

  // ── Offline Status mutations ──────────────────────────────────────
  async function handleOfflineToggle(key: keyof OfflineStatus) {
    if (key === 'id' || key === 'trip_id' || key === 'updated_at') return;
    const newValue = !offlineStatus[key];
    const patch = { [key]: newValue };
    const { data: updated, error } = await updateOfflineStatus(offlineStatus.id, patch);
    if (error || !updated) { console.error('[updateOfflineStatus]', error?.message); throw error; }
    setOfflineStatus(updated as OfflineStatus);
  }

  return (
    <>
      <div className="bg-topography" />
      <div className={`min-h-screen p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 relative z-10 ${themeMode === 'night' ? 'dark' : ''}`}>
        <HeroHeader
          trip={data.trip}
          weather={data.currentWeather}
          readiness={readiness}
          countdown={countdown}
          themeMode={themeMode}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          <div className="lg:col-span-8">
            <MapRouteCard trip={data.trip} />
          </div>
          <div className="lg:col-span-4 flex flex-col gap-6">
            <WeatherCard weather={data.currentWeather} astro={data.astro} />
          </div>

          <div className="lg:col-span-8">
            <ForecastCard forecast={data.forecast} />
          </div>
          <div className="lg:col-span-4">
            <ReadinessScoreCard readiness={readiness} />
          </div>

          <div className="lg:col-span-6">
            <GearChecklistCard
              gear={gear}
              onToggle={isAuthorized ? handleGearToggle : undefined}
              onAdd={isAuthorized ? handleGearAdd : undefined}
              onUpdate={isAuthorized ? handleGearUpdate : undefined}
              onDelete={isAuthorized ? handleGearDelete : undefined}
            />
          </div>
          <div className="lg:col-span-6">
            <TimelineCard
              events={timeline}
              tripDays={tripDays}
              onAdd={isAuthorized ? handleTimelineAdd : undefined}
              onUpdate={isAuthorized ? handleTimelineUpdate : undefined}
              onDelete={isAuthorized ? handleTimelineDelete : undefined}
            />
          </div>

          <div className="lg:col-span-8">
            <ParkIntelCard intel={parkIntel} onUpdate={isAuthorized ? handleParkIntelUpdate : undefined} />
          </div>
          <div className="lg:col-span-4">
            <AlertsCard
              alerts={alerts}
              onAddManual={isAuthorized ? handleAlertAdd : undefined}
              onDeleteManual={isAuthorized ? handleAlertDelete : undefined}
            />
          </div>

          {(data.settings.show_meals || data.settings.show_crew || data.settings.show_offline) && (
            <>
              {data.settings.show_meals && (
                <div className="lg:col-span-4">
                  <MealPlannerCard
                    meals={meals}
                    totalDays={tripDays}
                    onAdd={isAuthorized ? handleMealAdd : undefined}
                    onUpdate={isAuthorized ? handleMealUpdate : undefined}
                    onDelete={isAuthorized ? handleMealDelete : undefined}
                  />
                </div>
              )}
              {data.settings.show_crew && (
                <div className="lg:col-span-4">
                  <CrewRosterCard
                    crew={crew}
                    onAdd={isAuthorized ? handleCrewAdd : undefined}
                    onUpdate={isAuthorized ? handleCrewUpdate : undefined}
                    onDelete={isAuthorized ? handleCrewDelete : undefined}
                  />
                </div>
              )}
              {data.settings.show_offline && (
                <div className="lg:col-span-4">
                  <OfflineVaultCard status={offlineStatus} onToggle={isAuthorized ? handleOfflineToggle : undefined} />
                </div>
              )}
            </>
          )}

          {data.settings.show_astro && (
            <div className="lg:col-span-12">
              <AstroCard astro={data.astro} weather={data.currentWeather} />
            </div>
          )}

        </div>

        <footer className="text-center py-8 text-xs font-mono text-text-muted uppercase tracking-widest">
          Algonquin Wilderness Mission Control · Supabase live · {new Date().toLocaleDateString('en-CA')}
        </footer>
      </div>
    </>
  );
}
