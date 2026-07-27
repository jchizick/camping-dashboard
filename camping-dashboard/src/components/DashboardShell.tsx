'use client';

// ============================================================
// DashboardShell.tsx — Main dashboard layout + state management
// Extracted from the monolithic page.tsx for reuse at
// /trips/[tripId]. Uses TripContext for role-based access.
// ============================================================

import React, { useState, useEffect, useMemo } from 'react';
import type { GearItem, Meal, TimelineEvent, CrewMember, Alert, DashboardData, OfflineStatus, ParkIntel, PrepFeedItem, PrepFeedCategory } from '@/types';
import {
  parsePrepFeedItem,
  readApiError,
  readApiItem,
  toAlert,
  toCrewMember,
  toGearItem,
  toMeal,
  toOfflineStatus,
  toParkIntel,
  toTimelineEvent,
  toTripDashboard,
} from '@/lib/dashboardMapper';
import { useAuth } from '@/lib/authContext';
import { useTrip } from '@/lib/tripContext';
import { ThemeProvider, useTheme } from '@/lib/themeContext';
import {
  // Gear
  createGearItem, updateGearItem, deleteGearItem, toggleGearPacked, toggleGearAcquired,
  // Meals
  createMeal, updateMeal, deleteMeal,
  // Timeline
  createTimelineEvent, updateTimelineEvent, deleteTimelineEvent,
  // Crew
  createCrewMember, updateCrewMember, deleteCrewMember,
  // Alerts
  createAlert, deleteAlert, dismissAlert,
  // Offline
  updateOfflineStatus,
  // Park Intel
  updateParkIntel,
  // Prep Feed
  updateTripCampsite,
} from '@/lib/mutations';
import type { CampsiteSelection } from '@/components/maps/CampsiteMapSelector';
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
import FieldPrepFeedCard from '@/components/cards/FieldPrepFeedCard';
import MissionBriefModal from '@/components/ui/MissionBriefModal';
import ProjectIntelModal from '@/components/ui/ProjectIntelModal';

const emptyOfflineStatus = (tripId: string): OfflineStatus => ({
  trip_id: tripId,
  maps_cached: false,
  permit_saved: false,
  daily_vehicle_permit_saved: false,
  route_downloaded: false,
  satellite_device_connected: false,
  satellite_device_name: '',
  emergency_contact_ready: false,
  updated_at: '',
});

export default function DashboardShell({ data }: { data: DashboardData }) {
  // ── Auth + Trip Role ─────────────────────────────────────────────
  const { user } = useAuth();
  const { tripId, canEdit } = useTrip();
  const { themeMode } = useTheme();

  // ── User-authored state slices ───────────────────────────────────
  const [trip, setTrip] = useState(data.trip);
  const [gear, setGear] = useState<GearItem[]>(data.gear);
  const [meals, setMeals] = useState<Meal[]>(data.meals);
  const [timeline, setTimeline] = useState<TimelineEvent[]>(data.timeline);
  const [crew, setCrew] = useState<CrewMember[]>(data.crew);
  const [alerts, setAlerts] = useState<Alert[]>(data.alerts);
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus | null>(data.offlineStatus);
  const [parkIntel, setParkIntel] = useState<ParkIntel | null>(data.parkIntel);
  const [prepFeed, setPrepFeed] = useState<PrepFeedItem[]>(data.prepFeed);

  // ── Theme is now handled globally by ThemeProvider ──────────────────

  const [countdown, setCountdown] = useState(() => getTripCountdown(trip.start_date));

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(getTripCountdown(trip.start_date));
    }, 1000);
    return () => clearInterval(id);
  }, [trip.start_date]);

  const tripDays = useMemo(
    () => getTripDays(trip.start_date, trip.end_date),
    [trip.start_date, trip.end_date]
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
  async function handleGearToggleAcquired(id: string) {
    const item = gear.find(g => g.id === id);
    if (!item) return;
    const newAcquired = !item.acquired;
    setGear(prev => prev.map(g => g.id === id ? { ...g, acquired: newAcquired } : g));
    const { error } = await toggleGearAcquired(id, newAcquired);
    if (error) {
      console.error('[toggleGearAcquired] Supabase write failed, reverting:', error.message);
      setGear(prev => prev.map(g => g.id === id ? { ...g, acquired: item.acquired } : g));
    }
  }

  async function handleGearTogglePacked(id: string) {
    const item = gear.find(g => g.id === id);
    if (!item) return;
    const newPacked = !item.packed;
    setGear(prev => prev.map(g => g.id === id ? { ...g, packed: newPacked } : g));
    const { error } = await toggleGearPacked(id, newPacked);
    if (error) {
      console.error('[toggleGearPacked] Supabase write failed, reverting:', error.message);
      setGear(prev => prev.map(g => g.id === id ? { ...g, packed: item.packed } : g));
    }
  }

  async function handleGearAdd(item: Omit<GearItem, 'id' | 'trip_id'>) {
    const { data: newItem, error } = await createGearItem(tripId, item);
    if (error || !newItem) { console.error('[createGear]', error?.message); throw error; }
    setGear(prev => [...prev, toGearItem(newItem)]);
  }

  async function handleGearUpdate(id: string, patch: Partial<Omit<GearItem, 'id' | 'trip_id'>>) {
    const { data: updated, error } = await updateGearItem(id, patch);
    if (error || !updated) { console.error('[updateGear]', error?.message); throw error; }
    setGear(prev => prev.map(g => g.id === id ? toGearItem(updated) : g));
  }

  async function handleGearDelete(id: string) {
    const { error } = await deleteGearItem(id);
    if (error) { console.error('[deleteGear]', error.message); throw error; }
    setGear(prev => prev.filter(g => g.id !== id));
  }

  // ── Meal mutations ────────────────────────────────────────────────
  async function handleMealAdd(item: Omit<Meal, 'id' | 'trip_id'>) {
    const { data: newMeal, error } = await createMeal(tripId, item);
    if (error || !newMeal) { console.error('[createMeal]', error?.message); throw error; }
    setMeals(prev => [...prev, toMeal(newMeal)]);
  }

  async function handleMealUpdate(id: string, patch: Partial<Omit<Meal, 'id' | 'trip_id'>>) {
    const { data: updated, error } = await updateMeal(id, patch);
    if (error || !updated) { console.error('[updateMeal]', error?.message); throw error; }
    setMeals(prev => prev.map(m => m.id === id ? toMeal(updated) : m));
  }

  async function handleMealDelete(id: string) {
    const { error } = await deleteMeal(id);
    if (error) { console.error('[deleteMeal]', error.message); throw error; }
    setMeals(prev => prev.filter(m => m.id !== id));
  }

  // ── Timeline mutations ────────────────────────────────────────────
  async function handleTimelineAdd(event: Omit<TimelineEvent, 'id' | 'trip_id'>) {
    const { data: newEvent, error } = await createTimelineEvent(tripId, event);
    if (error || !newEvent) { console.error('[createTimeline]', error?.message); throw error; }
    setTimeline(prev => [...prev, toTimelineEvent(newEvent)]);
  }

  async function handleTimelineUpdate(id: string, patch: Partial<Omit<TimelineEvent, 'id' | 'trip_id'>>) {
    const { data: updated, error } = await updateTimelineEvent(id, patch);
    if (error || !updated) { console.error('[updateTimeline]', error?.message); throw error; }
    setTimeline(prev => prev.map(e => e.id === id ? toTimelineEvent(updated) : e));
  }

  async function handleTimelineDelete(id: string) {
    const { error } = await deleteTimelineEvent(id);
    if (error) { console.error('[deleteTimeline]', error.message); throw error; }
    setTimeline(prev => prev.filter(e => e.id !== id));
  }

  // ── Crew mutations ────────────────────────────────────────────────
  async function handleCrewAdd(member: Omit<CrewMember, 'id' | 'trip_id'>) {
    const { data: newMember, error } = await createCrewMember(tripId, member);
    if (error || !newMember) { console.error('[createCrew]', error?.message); throw error; }
    setCrew(prev => [...prev, toCrewMember(newMember)]);
  }

  async function handleCrewUpdate(id: string, patch: Partial<Omit<CrewMember, 'id' | 'trip_id'>>) {
    const { data: updated, error } = await updateCrewMember(id, patch);
    if (error || !updated) { console.error('[updateCrew]', error?.message); throw error; }
    setCrew(prev => prev.map(m => m.id === id ? toCrewMember(updated) : m));
  }

  async function handleCrewDelete(id: string) {
    const { error } = await deleteCrewMember(id);
    if (error) { console.error('[deleteCrew]', error.message); throw error; }
    setCrew(prev => prev.filter(m => m.id !== id));
  }

  // ── Alert mutations ───────────────────────────────────────────────
  async function handleAlertAdd(alertData: { title: string; body: string; severity: Alert['severity']; source: string; is_active: boolean }) {
    const { data: newAlert, error } = await createAlert(tripId, alertData);
    if (error || !newAlert) { console.error('[createAlert]', error?.message); throw error; }
    setAlerts(prev => [toAlert(newAlert), ...prev]);
  }

  async function handleAlertDelete(id: string) {
    const { error } = await deleteAlert(id);
    if (error) { console.error('[deleteAlert]', error.message); throw error; }
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  async function handleAlertDismiss(id: string) {
    const { error } = await dismissAlert(id);
    if (error) { console.error('[dismissAlert]', error.message); throw error; }
    setAlerts(prev => prev.map(alert => alert.id === id
      ? { ...alert, dismissed_at: new Date().toISOString() }
      : alert));
  }

  async function handleAlertRefresh() {
    const response = await fetch('/api/refresh-alerts', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error ?? 'Alerts could not be refreshed.');
    window.location.reload();
  }

  // ── Park Intel mutations ─────────────────────────────────────────
  async function handleParkIntelUpdate(patch: Partial<Omit<ParkIntel, 'trip_id' | 'updated_at'>>) {
    const { data: updated, error } = await updateParkIntel(tripId, patch);
    if (error || !updated) { console.error('[updateParkIntel]', error?.message); throw error; }
    setParkIntel(toParkIntel(updated));
  }

  // ── Prep Feed mutations ───────────────────────────────────────
  const uploaderName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Unknown';

  async function handlePrepFeedAdd(payload: { file: File; caption: string; category: PrepFeedCategory; uploaded_by: string }) {
    const form = new FormData();
    form.set('file', payload.file);
    form.set('caption', payload.caption);
    form.set('category', payload.category);
    form.set('uploaded_by', payload.uploaded_by);
    const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}/prep-feed`, {
      method: 'POST',
      body: form,
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      throw new Error(readApiError(result) ?? 'The prep-feed item could not be saved.');
    }
    const item = parsePrepFeedItem(readApiItem(result));
    setPrepFeed(prev => [item, ...prev]);
  }

  async function handlePrepFeedDelete(id: string) {
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/prep-feed/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error ?? 'The prep-feed item could not be deleted.');
    }
    setPrepFeed(prev => prev.filter(i => i.id !== id));
  }

  // ── Mission Brief modal ──────────────────────────────────────────
  const [missionBriefOpen, setMissionBriefOpen] = useState(false);
  const [projectIntelOpen, setProjectIntelOpen] = useState(false);

  // ── Offline Status mutations ──────────────────────────────────────
  async function handleOfflineToggle(key: keyof OfflineStatus) {
    if (key === 'trip_id' || key === 'updated_at') return;
    const currentStatus = offlineStatus ?? emptyOfflineStatus(tripId);
    const newValue = !currentStatus[key];
    
    // Optimistic update
    setOfflineStatus({ ...currentStatus, [key]: newValue });

    const patch = { [key]: newValue };
    const { data: updated, error } = await updateOfflineStatus(tripId, patch);
    
    if (error || !updated) { 
      console.error('[updateOfflineStatus]', error?.message); 
      // Revert on error
      setOfflineStatus(currentStatus);
      return; 
    }
    
    setOfflineStatus(toOfflineStatus(updated));
  }

  async function handleCampsiteSave(selection: CampsiteSelection) {
    const { data: updated, error } = await updateTripCampsite(tripId, selection);
    if (error || !updated) {
      console.error('[updateTripCampsite]', error);
      throw new Error(error?.message ?? 'The campsite location could not be saved.');
    }
    setTrip(toTripDashboard(updated));
  }

  return (
    <ThemeProvider
      settings={data.settings}
      sunriseTime={data.currentWeather?.sunrise_time ?? undefined}
      sunsetTime={data.currentWeather?.sunset_time ?? undefined}
    >
      <div className="bg-topography" />
      <div className="min-h-screen p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 relative z-10">
        <HeroHeader
          trip={trip}
          weather={data.currentWeather}
          readiness={readiness}
          countdown={countdown}
          themeMode={themeMode}
          onMissionBrief={() => setMissionBriefOpen(true)}
        />

        <MissionBriefModal
          isOpen={missionBriefOpen}
          onClose={() => setMissionBriefOpen(false)}
        />

        <ProjectIntelModal
          isOpen={projectIntelOpen}
          onClose={() => setProjectIntelOpen(false)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          <div className="lg:col-span-8">
            <MapRouteCard
              trip={trip}
              onSaveLocation={canEdit ? handleCampsiteSave : undefined}
            />
          </div>
          <div className="lg:col-span-4 flex flex-col gap-6">
            <WeatherCard
              tripId={trip.id}
              weather={data.currentWeather}
              weatherRefresh={data.weatherRefresh}
              astro={data.astro}
            />
          </div>

          <div className="lg:col-span-8">
            <ForecastCard forecast={data.forecast} />
          </div>
          <div className="lg:col-span-4">
            <ReadinessScoreCard
              readiness={readiness}
              unavailable={{
                offline: offlineStatus === null,
                weather: data.currentWeather === null,
              }}
            />
          </div>

          <div className="lg:col-span-6">
            <GearChecklistCard
              gear={gear}
              onToggle={canEdit ? handleGearToggleAcquired : undefined}
              onTogglePacked={canEdit ? handleGearTogglePacked : undefined}
              onAdd={canEdit ? handleGearAdd : undefined}
              onUpdate={canEdit ? handleGearUpdate : undefined}
              onDelete={canEdit ? handleGearDelete : undefined}
            />
          </div>
          <div className="lg:col-span-6">
            <TimelineCard
              events={timeline}
              tripDays={tripDays}
              onAdd={canEdit ? handleTimelineAdd : undefined}
              onUpdate={canEdit ? handleTimelineUpdate : undefined}
              onDelete={canEdit ? handleTimelineDelete : undefined}
            />
          </div>

          <div className="lg:col-span-4">
            <ParkIntelCard intel={parkIntel} onUpdate={canEdit ? handleParkIntelUpdate : undefined} />
          </div>
          <div className="lg:col-span-4">
            <FieldPrepFeedCard
              items={prepFeed}
              onAdd={canEdit ? handlePrepFeedAdd : undefined}
              onDelete={canEdit ? handlePrepFeedDelete : undefined}
              defaultUploader={uploaderName}
            />
          </div>
          <div className="lg:col-span-4">
            <AlertsCard
              alerts={alerts}
              refreshStates={data.alertRefresh}
              onAddManual={canEdit ? handleAlertAdd : undefined}
              onDeleteManual={canEdit ? handleAlertDelete : undefined}
              onDismissSystem={canEdit ? handleAlertDismiss : undefined}
              onRefresh={canEdit ? handleAlertRefresh : undefined}
            />
          </div>

          {(data.settings.show_meals || data.settings.show_crew || data.settings.show_offline) && (
            <>
              {data.settings.show_meals && (
                <div className="lg:col-span-4">
                  <MealPlannerCard
                    meals={meals}
                    totalDays={tripDays}
                    onAdd={canEdit ? handleMealAdd : undefined}
                    onUpdate={canEdit ? handleMealUpdate : undefined}
                    onDelete={canEdit ? handleMealDelete : undefined}
                  />
                </div>
              )}
              {data.settings.show_crew && (
                <div className="lg:col-span-4">
                  <CrewRosterCard
                    crew={crew}
                    onAdd={canEdit ? handleCrewAdd : undefined}
                    onUpdate={canEdit ? handleCrewUpdate : undefined}
                    onDelete={canEdit ? handleCrewDelete : undefined}
                  />
                </div>
              )}
              {data.settings.show_offline && (
                <div className="lg:col-span-4">
                  <OfflineVaultCard 
                    status={offlineStatus} 
                    onToggle={canEdit ? handleOfflineToggle : undefined} 
                    onOpenIntel={() => setProjectIntelOpen(true)}
                  />
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
          {trip.park_name} · {trip.name} · Supabase live · {new Date().toLocaleDateString('en-CA')}
        </footer>
      </div>
    </ThemeProvider>
  );
}
