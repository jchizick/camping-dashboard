// ============================================================
// labels.ts — Language translation map for theme variants
// Components read labels from themeContext instead of hardcoding
// strings like "Expedition Control" or "Mission Crew".
// ============================================================

import type { ThemeVariant } from '@/types';

export const LABELS = {
  expedition: {
    dashboardTitle: 'Expedition Control',
    readiness: 'Mission Readiness',
    offline: 'Offline Vault',
    crew: 'Mission Crew',
    prepFeed: 'Field Prep Feed',
    parkIntel: 'Park Intelligence',
    gear: 'Gear Checklist',
    meals: 'Meal Planner',
    timeline: 'Trip Timeline',
    weather: 'Weather Intel',
    forecast: 'Forecast',
    map: 'Route Map',
    astro: 'Astro Conditions',
    alerts: 'Alerts',
    countdown: 'Launch Countdown',
    createTrip: 'Launch New Expedition',
    tripList: 'Your Expeditions',
    settings: 'Mission Settings',
    missionBrief: 'Mission Brief',
  },
  clean: {
    dashboardTitle: 'Trip Dashboard',
    readiness: 'Trip Readiness',
    offline: 'Offline Checklist',
    crew: 'Trip Crew',
    prepFeed: 'Prep Photos',
    parkIntel: 'Park Info',
    gear: 'Gear Checklist',
    meals: 'Meal Planner',
    timeline: 'Trip Schedule',
    weather: 'Weather',
    forecast: 'Forecast',
    map: 'Route Map',
    astro: 'Night Sky',
    alerts: 'Alerts',
    countdown: 'Trip Countdown',
    createTrip: 'Create New Trip',
    tripList: 'Your Trips',
    settings: 'Trip Settings',
    missionBrief: 'Trip Summary',
  },
} as const;

/** Get the label set for a given theme variant */
export function getLabels(variant: ThemeVariant): (typeof LABELS)[ThemeVariant] {
  return LABELS[variant];
}
