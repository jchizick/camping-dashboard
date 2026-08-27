// ============================================================
// lib/mutations.ts — Centralized Supabase mutation helpers
// All writes go through here. Components stay clean.
// Every helper accepts tripId as first param — no hardcoded IDs.
// ============================================================

import { supabase } from './supabase';
import type {
  Alert,
  CrewMember,
  GearItem,
  Meal,
  OfflineStatus,
  ThemeVariant,
  TimelineEvent,
  TripDetailsUpdate,
} from '@/types';
import type { SettingsUpdate, TripUpdate } from '@/types/database';
import type { CampsiteSelection } from '@/components/maps/CampsiteMapSelector';

/** Generate a UUID for new rows — belt-and-suspenders alongside the DB default */
function generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older environments
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

// ─── Gear Items ────────────────────────────────────────────

export async function createGearItem(
    tripId: string,
    item: Omit<GearItem, 'id' | 'trip_id'>
) {
    return supabase
        .from('gear_items')
        .insert({ id: generateId(), ...item, trip_id: tripId })
        .select()
        .single();
}

export async function updateGearItem(
    id: string,
    patch: Partial<Omit<GearItem, 'id' | 'trip_id'>>
) {
    return supabase
        .from('gear_items')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
}

export async function deleteGearItem(id: string) {
    return supabase.from('gear_items').delete().eq('id', id);
}

export async function toggleGearPacked(id: string, packed: boolean) {
    return supabase
        .from('gear_items')
        .update({ packed })
        .eq('id', id);
}

export async function toggleGearAcquired(id: string, acquired: boolean) {
    return supabase
        .from('gear_items')
        .update({ acquired })
        .eq('id', id);
}

// ─── Meals ────────────────────────────────────────────────

export async function createMeal(
    tripId: string,
    meal: Omit<Meal, 'id' | 'trip_id'>
) {
    return supabase
        .from('meals')
        .insert({ id: generateId(), ...meal, trip_id: tripId })
        .select()
        .single();
}

export async function updateMeal(
    id: string,
    patch: Partial<Omit<Meal, 'id' | 'trip_id'>>
) {
    return supabase
        .from('meals')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
}

export async function deleteMeal(id: string) {
    return supabase.from('meals').delete().eq('id', id);
}

// ─── Timeline Events ───────────────────────────────────────

export async function createTimelineEvent(
    tripId: string,
    event: Omit<TimelineEvent, 'id' | 'trip_id'>
) {
    return supabase
        .from('timeline_events')
        .insert({ id: generateId(), ...event, trip_id: tripId })
        .select()
        .single();
}

export async function updateTimelineEvent(
    id: string,
    patch: Partial<Omit<TimelineEvent, 'id' | 'trip_id'>>
) {
    return supabase
        .from('timeline_events')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
}

export async function deleteTimelineEvent(id: string) {
    return supabase.from('timeline_events').delete().eq('id', id);
}

// ─── Crew Members ─────────────────────────────────────────

export async function createCrewMember(
    tripId: string,
    member: Omit<CrewMember, 'id' | 'trip_id'>
) {
    return supabase
        .from('crew_members')
        .insert({ id: generateId(), ...member, trip_id: tripId })
        .select()
        .single();
}

export async function updateCrewMember(
    id: string,
    patch: Partial<Omit<CrewMember, 'id' | 'trip_id'>>
) {
    return supabase
        .from('crew_members')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
}

export async function deleteCrewMember(id: string) {
    return supabase.from('crew_members').delete().eq('id', id);
}

// ─── Alerts ───────────────────────────────────────────────

export async function createAlert(
    tripId: string,
    alert: {
        title: string;
        body: string;
        severity: Alert['severity'];
        source: string;
        is_active: boolean;
    }
) {
    const id = generateId();
    return supabase
        .from('alerts')
        .insert({
            id,
            ...alert,
            trip_id: tripId,
            provider: 'manual',
            external_id: id,
            category: 'manual',
            status: 'active',
        })
        .select()
        .single();
}

export async function deactivateAlert(id: string) {
    return supabase
        .from('alerts')
        .update({ is_active: false })
        .eq('id', id);
}

export async function deleteAlert(id: string) {
    return supabase.from('alerts').delete().eq('id', id);
}

export async function dismissAlert(id: string) {
    return supabase
        .from('alerts')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', id);
}

// ─── Park Intel ───────────────────────────────────────────────

export async function updateParkIntel(
    tripId: string,
    patch: Partial<Omit<import('@/types').ParkIntel, 'trip_id' | 'updated_at'>>
) {
    return supabase
        .from('park_intel')
        .upsert({
            trip_id: tripId,
            fire_restriction: 'Unknown',
            wildlife_notes: '',
            ranger_station: '',
            firewood_percent: 0,
            water_notes: '',
            custom_notes: '',
            ...patch,
        }, { onConflict: 'trip_id' })
        .select()
        .single();
}

// ─── Offline Status ──────────────────────────────────────────

export async function updateOfflineStatus(
    tripId: string,
    patch: Partial<Omit<OfflineStatus, 'trip_id'>>
) {
    return supabase
        .from('offline_status')
        .upsert({
            trip_id: tripId,
            maps_cached: false,
            permit_saved: false,
            daily_vehicle_permit_saved: false,
            route_downloaded: false,
            satellite_device_connected: false,
            satellite_device_name: '',
            emergency_contact_ready: false,
            ...patch,
        }, { onConflict: 'trip_id' })
        .select()
        .single();
}

// ─── Trip Campsite ─────────────────────────────────────────

export async function updateTripCampsite(
    tripId: string,
    selection: CampsiteSelection
) {
    return supabase
        .from('trips')
        .update({
            campsite_latitude: selection.latitude,
            campsite_longitude: selection.longitude,
            campsite_label: selection.label,
            campsite_source: selection.source,
            campsite_osm_id: selection.osmId,
            site_lat: selection.latitude,
            site_lng: selection.longitude,
        } satisfies TripUpdate)
        .eq('id', tripId)
        .select()
        .single();
}

// ─── Trip Appearance ───────────────────────────────────────

export async function updateTripDetails(
  tripId: string,
  patch: TripDetailsUpdate
) {
  return supabase
    .from('trips')
    .update({ ...patch } satisfies TripUpdate)
    .eq('id', tripId)
    .select()
    .single();
}

export async function updateThemeVariant(
  tripId: string,
  themeVariant: ThemeVariant
) {
  return supabase
    .from('settings')
    .update({ theme_variant: themeVariant } satisfies SettingsUpdate)
    .eq('trip_id', tripId)
    .select()
    .single();
}

// ─── Prep Feed ────────────────────────────────────────────
