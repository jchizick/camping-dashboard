'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { GearItem, Meal, TimelineEvent, CrewMember, Alert, ThemeOverride, DashboardData, OfflineStatus, ParkIntel } from '@/types';
import { fetchDashboardData } from '@/lib/fetchDashboard';
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
      <main className="dashboard theme-night" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,183,77,0.3)', borderTopColor: '#ffb74d', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <h2 style={{ color: '#ffb74d', letterSpacing: '2px', textTransform: 'uppercase', margin: 0, fontSize: '1.2rem' }}>Initializing Mission Control...</h2>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </main>
    );
  }

  return <DashboardContent data={initialData} />;
}

function DashboardContent({ data }: { data: DashboardData }) {
  // ── User-authored state slices ───────────────────────────────────
  const [gear, setGear] = useState<GearItem[]>(data.gear);
  const [meals, setMeals] = useState<Meal[]>(data.meals);
  const [timeline, setTimeline] = useState<TimelineEvent[]>(data.timeline);
  const [crew, setCrew] = useState<CrewMember[]>(data.crew);
  const [alerts, setAlerts] = useState<Alert[]>(data.alerts);
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>(data.offlineStatus);
  const [parkIntel, setParkIntel] = useState<ParkIntel>(data.parkIntel);

  // ── Local UI state ────────────────────────────────────────────────
  const [themeOverride, setThemeOverride] = useState<ThemeOverride>(
    data.settings.manual_theme_override
  );
  const [countdown, setCountdown] = useState(() => getTripCountdown(data.trip.start_date));
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(getTripCountdown(data.trip.start_date));
    }, 1000);
    return () => clearInterval(id);
  }, [data.trip.start_date]);

  // ── Derived values ────────────────────────────────────────────────
  const sunriseHour = parseInt(data.currentWeather.sunrise_time.split(':')[0], 10);
  const sunsetHour = parseInt(data.currentWeather.sunset_time.split(':')[0], 10);
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
  const mealReadiness = useMemo(() => calculateMealCompleteness(meals, tripDays), [meals, tripDays]);
  const offlineReadiness = useMemo(() => calculateOfflineReadiness(offlineStatus), [offlineStatus]);
  const timelineReadiness = useMemo(() => calculateTimelineCompleteness(timeline, tripDays), [timeline, tripDays]);
  const weatherReadiness = useMemo(() => calculateWeatherPreparedness(data.currentWeather, data.forecast), [data.currentWeather, data.forecast]);

  const readiness = useMemo(
    () => calculateOverallReadiness({ gear: gearReadiness, meals: mealReadiness, weather: weatherReadiness, offline: offlineReadiness, timeline: timelineReadiness }),
    [gearReadiness, mealReadiness, weatherReadiness, offlineReadiness, timelineReadiness]
  );

  // ── Theme toggle ──────────────────────────────────────────────────
  function handleThemeToggle() {
    setThemeOverride((prev) => {
      if (prev === 'auto') return 'day';
      if (prev === 'day') return 'night';
      return 'auto';
    });
  }

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

  // ── Park Intel mutations ──────────────────────────────────────────
  async function handleParkIntelUpdate(patch: Partial<Omit<ParkIntel, 'id' | 'trip_id' | 'updated_at'>>) {
    const prev = parkIntel;
    setParkIntel(current => ({ ...current, ...patch }));
    const { error } = await updateParkIntel(parkIntel.id, patch);
    if (error) {
      console.error('[updateParkIntel] Supabase write failed, reverting:', error.message);
      setParkIntel(prev);
    }
  }

  // ── Offline mutations ─────────────────────────────────────────────
  async function handleOfflineToggle(key: keyof OfflineStatus) {
    const current = offlineStatus[key];
    if (typeof current !== 'boolean') return;
    const newValue = !current;
    
    setOfflineStatus(prev => ({ ...prev, [key]: newValue }));
    
    const patch = { [key]: newValue };
    const { error } = await updateOfflineStatus(offlineStatus.id, patch);
    
    if (error) {
      console.error('[updateOfflineStatus] Supabase write failed, reverting:', error.message);
      setOfflineStatus(prev => ({ ...prev, [key]: current }));
    }
  }

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

      {/* ── Hero ────────────────────────────────────────────────── */}
      <HeroHeader
        trip={data.trip}
        weather={data.currentWeather}
        readiness={readiness}
        countdown={countdown}
        themeMode={themeMode}
        themeOverride={themeOverride}
        onThemeToggle={handleThemeToggle}
      />

      {/* ── Dashboard Grid ──────────────────────────────────────── */}
      <section className="dashboard__grid">

        {/* ── Row A: Route + Weather ─── */}
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

        {/* ── Row C: Gear + Timeline ─── */}
        <div className="dashboard__row dashboard__row--prep">
          <div className="dashboard__col dashboard__col--gear">
            <GearChecklistCard
              gear={gear}
              onToggle={handleGearToggle}
              onAdd={handleGearAdd}
              onUpdate={handleGearUpdate}
              onDelete={handleGearDelete}
            />
          </div>
          <div className="dashboard__col dashboard__col--timeline">
            <TimelineCard
              events={timeline}
              tripDays={tripDays}
              onAdd={handleTimelineAdd}
              onUpdate={handleTimelineUpdate}
              onDelete={handleTimelineDelete}
            />
          </div>
        </div>

        {/* ── Row D: Park Intel + Alerts ─── */}
        <div className="dashboard__row dashboard__row--intel">
          <div className="dashboard__col dashboard__col--park">
            <ParkIntelCard intel={parkIntel} onUpdate={handleParkIntelUpdate} />
          </div>
          <div className="dashboard__col dashboard__col--alerts">
            <AlertsCard
              alerts={alerts}
              onAddManual={handleAlertAdd}
              onDeleteManual={handleAlertDelete}
            />
          </div>
        </div>

        {/* ── Row E: Meals + Crew + Offline ─── */}
        {(data.settings.show_meals || data.settings.show_crew || data.settings.show_offline) && (
          <div className="dashboard__row dashboard__row--logistics">
            {data.settings.show_meals && (
              <div className="dashboard__col">
                <MealPlannerCard
                  meals={meals}
                  totalDays={tripDays}
                  onAdd={handleMealAdd}
                  onUpdate={handleMealUpdate}
                  onDelete={handleMealDelete}
                />
              </div>
            )}
            {data.settings.show_crew && (
              <div className="dashboard__col">
                <CrewRosterCard
                  crew={crew}
                  onAdd={handleCrewAdd}
                  onUpdate={handleCrewUpdate}
                  onDelete={handleCrewDelete}
                />
              </div>
            )}
            {data.settings.show_offline && (
              <div className="dashboard__col">
                <OfflineVaultCard status={offlineStatus} onToggle={handleOfflineToggle} />
              </div>
            )}
          </div>
        )}

        {/* ── Row F: Astro ─── */}
        {data.settings.show_astro && (
          <div className="dashboard__row dashboard__row--astro">
            <div className="dashboard__col dashboard__col--astro">
              <AstroCard astro={data.astro} weather={data.currentWeather} />
            </div>
          </div>
        )}

      </section>

      <footer className="dashboard__footer">
        <p>Algonquin Wilderness Mission Control · Supabase live · {new Date().toLocaleDateString('en-CA')}</p>
      </footer>
    </main>
  );
}

