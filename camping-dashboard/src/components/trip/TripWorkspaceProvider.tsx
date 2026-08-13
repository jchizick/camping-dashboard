'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  Alert,
  CountdownResult,
  CrewMember,
  DashboardData,
  GearItem,
  Meal,
  OfflineStatus,
  ParkIntel,
  PrepFeedCategory,
  PrepFeedItem,
  ReadinessScore,
  TimelineEvent,
  TripDashboard,
  TripMemberRole,
} from '@/types';
import { useAuth } from '@/lib/authContext';
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
import { fetchDashboardData } from '@/lib/fetchDashboard';
import {
  calculateGearReadiness,
  calculateMealCompleteness,
  calculateOfflineReadiness,
  calculateOverallReadiness,
  calculateTimelineCompleteness,
  calculateWeatherPreparedness,
  getTripCountdown,
} from '@/lib/helpers';
import { getTripDuration } from '@/lib/tripDuration';
import {
  createAlert,
  createCrewMember,
  createGearItem,
  createMeal,
  createTimelineEvent,
  deleteAlert,
  deleteCrewMember,
  deleteGearItem,
  deleteMeal,
  deleteTimelineEvent,
  dismissAlert,
  toggleGearAcquired,
  toggleGearPacked,
  updateCrewMember,
  updateGearItem,
  updateMeal,
  updateOfflineStatus,
  updateParkIntel,
  updateTimelineEvent,
  updateTripCampsite,
} from '@/lib/mutations';
import { ThemeProvider } from '@/lib/themeContext';
import { useTrip } from '@/lib/tripContext';
import type { CampsiteSelection } from '@/components/maps/CampsiteMapSelector';
import { useOptionalTripDraftGuard } from './TripDraftGuardProvider';

async function runWithoutDraftGuard(
  action: () => void | Promise<void>
): Promise<boolean> {
  await action();
  return true;
}

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

export interface TripWorkspaceEditableActions {
  toggleGearAcquired: (id: string) => Promise<void>;
  toggleGearPacked: (id: string) => Promise<void>;
  addGearItem: (item: Omit<GearItem, 'id' | 'trip_id'>) => Promise<void>;
  updateGearItem: (
    id: string,
    patch: Partial<Omit<GearItem, 'id' | 'trip_id'>>
  ) => Promise<void>;
  deleteGearItem: (id: string) => Promise<void>;
  addMeal: (meal: Omit<Meal, 'id' | 'trip_id'>) => Promise<void>;
  updateMeal: (
    id: string,
    patch: Partial<Omit<Meal, 'id' | 'trip_id'>>
  ) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  addTimelineEvent: (
    event: Omit<TimelineEvent, 'id' | 'trip_id'>
  ) => Promise<void>;
  updateTimelineEvent: (
    id: string,
    patch: Partial<Omit<TimelineEvent, 'id' | 'trip_id'>>
  ) => Promise<void>;
  deleteTimelineEvent: (id: string) => Promise<void>;
  addCrewMember: (
    member: Omit<CrewMember, 'id' | 'trip_id'>
  ) => Promise<void>;
  updateCrewMember: (
    id: string,
    patch: Partial<Omit<CrewMember, 'id' | 'trip_id'>>
  ) => Promise<void>;
  deleteCrewMember: (id: string) => Promise<void>;
  addAlert: (alert: {
    title: string;
    body: string;
    severity: Alert['severity'];
    source: string;
    is_active: boolean;
  }) => Promise<void>;
  deleteAlert: (id: string) => Promise<void>;
  dismissAlert: (id: string) => Promise<void>;
  refreshAlerts: () => Promise<void>;
  updateParkIntel: (
    patch: Partial<Omit<ParkIntel, 'trip_id' | 'updated_at'>>
  ) => Promise<void>;
  addPrepFeedItem: (payload: {
    file: File;
    caption: string;
    category: PrepFeedCategory;
    uploaded_by: string;
  }) => Promise<void>;
  deletePrepFeedItem: (id: string) => Promise<void>;
  toggleOfflineStatus: (key: keyof OfflineStatus) => Promise<void>;
  saveCampsite: (selection: CampsiteSelection) => Promise<void>;
}

interface TripWorkspacePermissions {
  role: TripMemberRole | null;
  canEdit: boolean;
  isOwner: boolean;
}

interface TripWorkspaceReadinessCategories {
  gear: number;
  meals: number;
  weather: number;
  offline: number;
  timeline: number;
}

export interface TripWorkspaceValue {
  data: DashboardData | null;
  trip: TripDashboard | null;
  gear: GearItem[];
  meals: Meal[];
  timeline: TimelineEvent[];
  crew: CrewMember[];
  alerts: Alert[];
  offlineStatus: OfflineStatus | null;
  parkIntel: ParkIntel | null;
  prepFeed: PrepFeedItem[];
  tripDays: number;
  countdown: CountdownResult | null;
  readiness: ReadinessScore | null;
  readinessCategories: TripWorkspaceReadinessCategories;
  permissions: TripWorkspacePermissions;
  editableActions: TripWorkspaceEditableActions | null;
  uploaderName: string;
  isLoading: boolean;
  isReloading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const TripWorkspaceContext = createContext<TripWorkspaceValue | null>(null);

function workspaceErrorMessage(error: unknown): string {
  void error;
  return 'We could not load this trip workspace. Please try again.';
}

export function TripWorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const draftGuard = useOptionalTripDraftGuard();
  const requestAction = draftGuard?.requestAction ?? runWithoutDraftGuard;
  const {
    tripId,
    role,
    canEdit,
    isOwner,
    isLoading: roleLoading,
    error: roleError,
  } = useTrip();

  const [data, setData] = useState<DashboardData | null>(null);
  const [trip, setTrip] = useState<TripDashboard | null>(null);
  const [gear, setGear] = useState<GearItem[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus | null>(null);
  const [parkIntel, setParkIntel] = useState<ParkIntel | null>(null);
  const [prepFeed, setPrepFeed] = useState<PrepFeedItem[]>([]);
  const [loadedTripId, setLoadedTripId] = useState<string | null>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [isReloading, setIsReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdownTick, setCountdownTick] = useState(0);
  const initialLoadTripRef = useRef<string | null>(null);
  const loadVersionRef = useRef(0);

  const applyDashboardData = useCallback((nextData: DashboardData) => {
    setData(nextData);
    setTrip(nextData.trip);
    setGear(nextData.gear);
    setMeals(nextData.meals);
    setTimeline(nextData.timeline);
    setCrew(nextData.crew);
    setAlerts(nextData.alerts);
    setOfflineStatus(nextData.offlineStatus);
    setParkIntel(nextData.parkIntel);
    setPrepFeed(nextData.prepFeed);
    setLoadedTripId(nextData.trip.id);
  }, []);

  const loadWorkspace = useCallback(
    async (kind: 'initial' | 'reload') => {
      const loadVersion = ++loadVersionRef.current;
      if (kind === 'initial') {
        setIsWorkspaceLoading(true);
      } else {
        setIsReloading(true);
      }
      setError(null);

      try {
        const nextData = await fetchDashboardData(tripId);
        if (loadVersion !== loadVersionRef.current) return;
        applyDashboardData(nextData);
      } catch (loadError) {
        if (loadVersion !== loadVersionRef.current) return;
        console.error('Fetch failed:', loadError);
        setError(workspaceErrorMessage(loadError));
      } finally {
        if (loadVersion === loadVersionRef.current) {
          setIsWorkspaceLoading(false);
          setIsReloading(false);
        }
      }
    },
    [applyDashboardData, tripId]
  );

  useEffect(() => {
    if (roleLoading || roleError) return;
    if (initialLoadTripRef.current === tripId) return;
    initialLoadTripRef.current = tripId;
    void loadWorkspace('initial');
  }, [loadWorkspace, roleError, roleLoading, tripId]);

  useEffect(() => {
    if (!trip) return;
    const id = window.setInterval(() => {
      setCountdownTick((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [trip]);

  const reload = useCallback(async () => {
    if (roleLoading || roleError) return;
    await requestAction(() => loadWorkspace('reload'));
  }, [loadWorkspace, requestAction, roleError, roleLoading]);

  const tripDays = useMemo(
    () =>
      trip
        ? (getTripDuration(trip.start_date, trip.end_date)?.days ?? 0)
        : 0,
    [trip]
  );
  const countdown = useMemo(
    () => {
      void countdownTick;
      return trip ? getTripCountdown(trip.start_date) : null;
    },
    [countdownTick, trip]
  );
  const readinessCategories = useMemo<TripWorkspaceReadinessCategories>(
    () => ({
      gear: calculateGearReadiness(gear),
      meals: calculateMealCompleteness(meals, tripDays),
      weather: calculateWeatherPreparedness(
        data?.currentWeather ?? null,
        data?.forecast ?? []
      ),
      offline: calculateOfflineReadiness(offlineStatus),
      timeline: calculateTimelineCompleteness(timeline, tripDays),
    }),
    [
      data?.currentWeather,
      data?.forecast,
      gear,
      meals,
      offlineStatus,
      timeline,
      tripDays,
    ]
  );
  const readiness = useMemo(
    () =>
      data && trip
        ? calculateOverallReadiness(readinessCategories)
        : null,
    [data, readinessCategories, trip]
  );

  async function handleGearToggleAcquired(id: string) {
    const item = gear.find((candidate) => candidate.id === id);
    if (!item) return;
    const newAcquired = !item.acquired;
    setGear((current) =>
      current.map((candidate) =>
        candidate.id === id
          ? { ...candidate, acquired: newAcquired }
          : candidate
      )
    );
    const { error: mutationError } = await toggleGearAcquired(id, newAcquired);
    if (mutationError) {
      console.error(
        '[toggleGearAcquired] Supabase write failed, reverting:',
        mutationError.message
      );
      setGear((current) =>
        current.map((candidate) =>
          candidate.id === id
            ? { ...candidate, acquired: item.acquired }
            : candidate
        )
      );
    }
  }

  async function handleGearTogglePacked(id: string) {
    const item = gear.find((candidate) => candidate.id === id);
    if (!item) return;
    const newPacked = !item.packed;
    setGear((current) =>
      current.map((candidate) =>
        candidate.id === id ? { ...candidate, packed: newPacked } : candidate
      )
    );
    const { error: mutationError } = await toggleGearPacked(id, newPacked);
    if (mutationError) {
      console.error(
        '[toggleGearPacked] Supabase write failed, reverting:',
        mutationError.message
      );
      setGear((current) =>
        current.map((candidate) =>
          candidate.id === id ? { ...candidate, packed: item.packed } : candidate
        )
      );
    }
  }

  async function handleGearAdd(item: Omit<GearItem, 'id' | 'trip_id'>) {
    const { data: newItem, error: mutationError } = await createGearItem(
      tripId,
      item
    );
    if (mutationError || !newItem) {
      console.error('[createGear]', mutationError?.message);
      throw mutationError;
    }
    setGear((current) => [...current, toGearItem(newItem)]);
  }

  async function handleGearUpdate(
    id: string,
    patch: Partial<Omit<GearItem, 'id' | 'trip_id'>>
  ) {
    const { data: updated, error: mutationError } = await updateGearItem(
      id,
      patch
    );
    if (mutationError || !updated) {
      console.error('[updateGear]', mutationError?.message);
      throw mutationError;
    }
    setGear((current) =>
      current.map((item) => (item.id === id ? toGearItem(updated) : item))
    );
  }

  async function handleGearDelete(id: string) {
    const { error: mutationError } = await deleteGearItem(id);
    if (mutationError) {
      console.error('[deleteGear]', mutationError.message);
      throw mutationError;
    }
    setGear((current) => current.filter((item) => item.id !== id));
  }

  async function handleMealAdd(item: Omit<Meal, 'id' | 'trip_id'>) {
    const { data: newMeal, error: mutationError } = await createMeal(
      tripId,
      item
    );
    if (mutationError || !newMeal) {
      console.error('[createMeal]', mutationError?.message);
      throw mutationError;
    }
    setMeals((current) => [...current, toMeal(newMeal)]);
  }

  async function handleMealUpdate(
    id: string,
    patch: Partial<Omit<Meal, 'id' | 'trip_id'>>
  ) {
    const { data: updated, error: mutationError } = await updateMeal(id, patch);
    if (mutationError || !updated) {
      console.error('[updateMeal]', mutationError?.message);
      throw mutationError;
    }
    setMeals((current) =>
      current.map((meal) => (meal.id === id ? toMeal(updated) : meal))
    );
  }

  async function handleMealDelete(id: string) {
    const { error: mutationError } = await deleteMeal(id);
    if (mutationError) {
      console.error('[deleteMeal]', mutationError.message);
      throw mutationError;
    }
    setMeals((current) => current.filter((meal) => meal.id !== id));
  }

  async function handleTimelineAdd(
    event: Omit<TimelineEvent, 'id' | 'trip_id'>
  ) {
    const { data: newEvent, error: mutationError } = await createTimelineEvent(
      tripId,
      event
    );
    if (mutationError || !newEvent) {
      console.error('[createTimeline]', mutationError?.message);
      throw mutationError;
    }
    setTimeline((current) => [...current, toTimelineEvent(newEvent)]);
  }

  async function handleTimelineUpdate(
    id: string,
    patch: Partial<Omit<TimelineEvent, 'id' | 'trip_id'>>
  ) {
    const { data: updated, error: mutationError } = await updateTimelineEvent(
      id,
      patch
    );
    if (mutationError || !updated) {
      console.error('[updateTimeline]', mutationError?.message);
      throw mutationError;
    }
    setTimeline((current) =>
      current.map((event) =>
        event.id === id ? toTimelineEvent(updated) : event
      )
    );
  }

  async function handleTimelineDelete(id: string) {
    const { error: mutationError } = await deleteTimelineEvent(id);
    if (mutationError) {
      console.error('[deleteTimeline]', mutationError.message);
      throw mutationError;
    }
    setTimeline((current) => current.filter((event) => event.id !== id));
  }

  async function handleCrewAdd(member: Omit<CrewMember, 'id' | 'trip_id'>) {
    const { data: newMember, error: mutationError } = await createCrewMember(
      tripId,
      member
    );
    if (mutationError || !newMember) {
      console.error('[createCrew]', mutationError?.message);
      throw mutationError;
    }
    setCrew((current) => [...current, toCrewMember(newMember)]);
  }

  async function handleCrewUpdate(
    id: string,
    patch: Partial<Omit<CrewMember, 'id' | 'trip_id'>>
  ) {
    const { data: updated, error: mutationError } = await updateCrewMember(
      id,
      patch
    );
    if (mutationError || !updated) {
      console.error('[updateCrew]', mutationError?.message);
      throw mutationError;
    }
    setCrew((current) =>
      current.map((member) =>
        member.id === id ? toCrewMember(updated) : member
      )
    );
  }

  async function handleCrewDelete(id: string) {
    const { error: mutationError } = await deleteCrewMember(id);
    if (mutationError) {
      console.error('[deleteCrew]', mutationError.message);
      throw mutationError;
    }
    setCrew((current) => current.filter((member) => member.id !== id));
  }

  async function handleAlertAdd(alertData: {
    title: string;
    body: string;
    severity: Alert['severity'];
    source: string;
    is_active: boolean;
  }) {
    const { data: newAlert, error: mutationError } = await createAlert(
      tripId,
      alertData
    );
    if (mutationError || !newAlert) {
      console.error('[createAlert]', mutationError?.message);
      throw mutationError;
    }
    setAlerts((current) => [toAlert(newAlert), ...current]);
  }

  async function handleAlertDelete(id: string) {
    const { error: mutationError } = await deleteAlert(id);
    if (mutationError) {
      console.error('[deleteAlert]', mutationError.message);
      throw mutationError;
    }
    setAlerts((current) => current.filter((alert) => alert.id !== id));
  }

  async function handleAlertDismiss(id: string) {
    const { error: mutationError } = await dismissAlert(id);
    if (mutationError) {
      console.error('[dismissAlert]', mutationError.message);
      throw mutationError;
    }
    setAlerts((current) =>
      current.map((alert) =>
        alert.id === id
          ? { ...alert, dismissed_at: new Date().toISOString() }
          : alert
      )
    );
  }

  async function handleAlertRefresh() {
    const response = await fetch('/api/refresh-alerts', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(result.error ?? 'Alerts could not be refreshed.');
    }
    await reload();
  }

  async function handleParkIntelUpdate(
    patch: Partial<Omit<ParkIntel, 'trip_id' | 'updated_at'>>
  ) {
    const { data: updated, error: mutationError } = await updateParkIntel(
      tripId,
      patch
    );
    if (mutationError || !updated) {
      console.error('[updateParkIntel]', mutationError?.message);
      throw mutationError;
    }
    setParkIntel(toParkIntel(updated));
  }

  async function handlePrepFeedAdd(payload: {
    file: File;
    caption: string;
    category: PrepFeedCategory;
    uploaded_by: string;
  }) {
    const form = new FormData();
    form.set('file', payload.file);
    form.set('caption', payload.caption);
    form.set('category', payload.category);
    form.set('uploaded_by', payload.uploaded_by);
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/prep-feed`,
      {
        method: 'POST',
        body: form,
      }
    );
    const result: unknown = await response.json();
    if (!response.ok) {
      throw new Error(
        readApiError(result) ?? 'The prep-feed item could not be saved.'
      );
    }
    const item = parsePrepFeedItem(readApiItem(result));
    setPrepFeed((current) => [item, ...current]);
  }

  async function handlePrepFeedDelete(id: string) {
    const response = await fetch(
      `/api/trips/${encodeURIComponent(tripId)}/prep-feed/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(
        result.error ?? 'The prep-feed item could not be deleted.'
      );
    }
    setPrepFeed((current) => current.filter((item) => item.id !== id));
  }

  async function handleOfflineToggle(key: keyof OfflineStatus) {
    if (key === 'trip_id' || key === 'updated_at') return;
    const currentStatus = offlineStatus ?? emptyOfflineStatus(tripId);
    const newValue = !currentStatus[key];
    setOfflineStatus({ ...currentStatus, [key]: newValue });

    const { data: updated, error: mutationError } = await updateOfflineStatus(
      tripId,
      { [key]: newValue }
    );
    if (mutationError || !updated) {
      console.error('[updateOfflineStatus]', mutationError?.message);
      setOfflineStatus(currentStatus);
      return;
    }
    setOfflineStatus(toOfflineStatus(updated));
  }

  async function handleCampsiteSave(selection: CampsiteSelection) {
    const { data: updated, error: mutationError } = await updateTripCampsite(
      tripId,
      selection
    );
    if (mutationError || !updated) {
      console.error('[updateTripCampsite]', mutationError);
      throw new Error(
        mutationError?.message ?? 'The campsite location could not be saved.'
      );
    }
    setTrip(toTripDashboard(updated));
  }

  const editableActions: TripWorkspaceEditableActions | null = canEdit
    ? {
        toggleGearAcquired: handleGearToggleAcquired,
        toggleGearPacked: handleGearTogglePacked,
        addGearItem: handleGearAdd,
        updateGearItem: handleGearUpdate,
        deleteGearItem: handleGearDelete,
        addMeal: handleMealAdd,
        updateMeal: handleMealUpdate,
        deleteMeal: handleMealDelete,
        addTimelineEvent: handleTimelineAdd,
        updateTimelineEvent: handleTimelineUpdate,
        deleteTimelineEvent: handleTimelineDelete,
        addCrewMember: handleCrewAdd,
        updateCrewMember: handleCrewUpdate,
        deleteCrewMember: handleCrewDelete,
        addAlert: handleAlertAdd,
        deleteAlert: handleAlertDelete,
        dismissAlert: handleAlertDismiss,
        refreshAlerts: handleAlertRefresh,
        updateParkIntel: handleParkIntelUpdate,
        addPrepFeedItem: handlePrepFeedAdd,
        deletePrepFeedItem: handlePrepFeedDelete,
        toggleOfflineStatus: handleOfflineToggle,
        saveCampsite: handleCampsiteSave,
      }
    : null;

  const uploaderName =
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Unknown';
  const isLoading =
    roleLoading ||
    isWorkspaceLoading ||
    (roleError === null && loadedTripId !== tripId);

  const value: TripWorkspaceValue = {
    data,
    trip,
    gear,
    meals,
    timeline,
    crew,
    alerts,
    offlineStatus,
    parkIntel,
    prepFeed,
    tripDays,
    countdown,
    readiness,
    readinessCategories,
    permissions: { role, canEdit, isOwner },
    editableActions,
    uploaderName,
    isLoading,
    isReloading,
    error,
    reload,
  };

  return (
    <TripWorkspaceContext.Provider value={value}>
      <ThemeProvider
        settings={data?.settings ?? null}
        sunriseTime={data?.currentWeather?.sunrise_time ?? undefined}
        sunsetTime={data?.currentWeather?.sunset_time ?? undefined}
      >
        {children}
      </ThemeProvider>
    </TripWorkspaceContext.Provider>
  );
}

export function useTripWorkspace() {
  const context = useContext(TripWorkspaceContext);
  if (!context) {
    throw new Error(
      'useTripWorkspace must be used within a TripWorkspaceProvider'
    );
  }
  return context;
}
