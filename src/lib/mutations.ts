// ============================================================
// lib/mutations.ts — Centralized Supabase mutation helpers
// All writes go through here. Components stay clean.
// Every helper returns { data, error } from Supabase.
// ============================================================

import { supabase } from './supabase';
import type { GearItem, Meal, TimelineEvent, CrewMember, Alert, OfflineStatus } from '@/types';

const TRIP_ID = 'trip-maple-lake-001';

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
    item: Omit<GearItem, 'id' | 'trip_id'>
) {
    return supabase
        .from('gear_items')
        .insert({ id: generateId(), ...item, trip_id: TRIP_ID })
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

// ─── Meals ────────────────────────────────────────────────

export async function createMeal(
    meal: Omit<Meal, 'id' | 'trip_id'>
) {
    return supabase
        .from('meals')
        .insert({ id: generateId(), ...meal, trip_id: TRIP_ID })
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
    event: Omit<TimelineEvent, 'id' | 'trip_id'>
) {
    return supabase
        .from('timeline_events')
        .insert({ id: generateId(), ...event, trip_id: TRIP_ID })
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
    member: Omit<CrewMember, 'id' | 'trip_id'>
) {
    return supabase
        .from('crew_members')
        .insert({ id: generateId(), ...member, trip_id: TRIP_ID })
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
    alert: Omit<Alert, 'id' | 'trip_id' | 'created_at'>
) {
    return supabase
        .from('alerts')
        .insert({ id: generateId(), ...alert, trip_id: TRIP_ID })
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

// ─── Park Intel ───────────────────────────────────────────────

export async function updateParkIntel(
    id: string,
    patch: Partial<import('@/types').ParkIntel>
) {
    return supabase
        .from('park_intel')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
}

// ─── Offline Status ──────────────────────────────────────────

export async function updateOfflineStatus(
    id: string,
    patch: Partial<Omit<OfflineStatus, 'id' | 'trip_id'>>
) {
    return supabase
        .from('offline_status')
        .update(patch)
        .eq('id', id);
}
