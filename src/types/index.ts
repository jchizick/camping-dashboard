// ============================================================
// Camping Dashboard — All TypeScript Interfaces
// Source of truth: gemini.md Data Schema
// DO NOT define types inline in components
// ============================================================

// ─── Theme ────────────────────────────────────────────────
export type ThemeMode = 'day' | 'night';
export type ThemeOverride = 'auto' | 'day' | 'night';
export type Priority = 'critical' | 'high' | 'low';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type PrepType = 'dehydrated' | 'fresh' | 'fire';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type Units = 'metric' | 'imperial';

// ─── Core Entities ────────────────────────────────────────
export interface Trip {
  id: string;
  name: string;
  park_name: string;
  lake_name: string;
  site_name: string;
  start_date: string; // ISO date string
  end_date: string;   // ISO date string
  launch_point_name: string;
  launch_lat: number;
  launch_lng: number;
  site_lat: number;
  site_lng: number;
  distance_km: number;
  notes: string;
  theme_mode: ThemeOverride;
  created_at: string;
  updated_at: string;
}

export interface WeatherCurrent {
  id: string;
  trip_id: string;
  temperature_c: number;
  wind_kph: number;
  humidity: number;
  rain_chance: number;
  sunset_time: string;   // "HH:MM"
  sunrise_time: string;  // "HH:MM"
  moonset_time: string;
  moonrise_time: string;
  condition_label: string;
  icon: string;
  updated_at: string;
}

export interface WeatherForecast {
  id: string;
  trip_id: string;
  forecast_date: string; // ISO date string
  high_c: number;
  low_c: number;
  condition_label: string;
  rain_chance: number;
  wind_kph: number;
  icon: string;
}

export interface GearItem {
  id: string;
  trip_id: string;
  name: string;
  category: string;
  packed: boolean;
  owner: string;
  priority: Priority;
  notes: string;
  weight_kg: number;
}

export interface TimelineEvent {
  id: string;
  trip_id: string;
  day_number: number;
  event_time: string; // "HH:MM"
  title: string;
  details: string;
  sort_order: number;
}

export interface Meal {
  id: string;
  trip_id: string;
  day_number: number;
  meal_type: MealType;
  title: string;
  prep_type: PrepType;
  calories: number;
  assigned_to: string;
  notes: string;
}

export interface CrewMember {
  id: string;
  trip_id: string;
  name: string;
  role: string;
  load_item: string;
  load_weight_kg: number;
  canoe_number: number;
  notes: string;
}

export interface ParkIntel {
  id: string;
  trip_id: string;
  fire_restriction: string;
  wildlife_notes: string;
  ranger_station: string;
  firewood_percent: number;
  water_notes: string;
  custom_notes: string;
  updated_at: string;
}

export interface OfflineStatus {
  id: string;
  trip_id: string;
  maps_cached: boolean;
  permit_saved: boolean;
  route_downloaded: boolean;
  satellite_device_connected: boolean;
  satellite_device_name: string;
  emergency_contact_ready: boolean;
  updated_at: string;
}

export interface AstroData {
  id: string;
  trip_id: string;
  golden_hour_start: string;
  golden_hour_end: string;
  blue_hour_end: string;
  moon_phase: string;
  moon_illumination: number;
  milky_way_visibility: string;
  stargazing_notes: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  trip_id: string;
  title: string;
  body: string;
  severity: AlertSeverity;
  source: string;
  is_active: boolean;
  created_at: string;
}

export interface Settings {
  id: string;
  trip_id: string;
  manual_theme_override: ThemeOverride;
  preferred_units: Units;
  show_astro: boolean;
  show_meals: boolean;
  show_offline: boolean;
  show_crew: boolean;
}

// ─── Derived / Computed Types ──────────────────────────────
export interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isPast: boolean;
}

export interface ReadinessScore {
  overall: number;           // 0–100
  label: string;             // "Locked In" | "Nearly Ready" | etc.
  gear: number;
  meals: number;
  weather: number;
  offline: number;
  timeline: number;
}

// ─── Dashboard Payload (root state) ───────────────────────
export interface DashboardData {
  trip: Trip;
  currentWeather: WeatherCurrent;
  forecast: WeatherForecast[];
  gear: GearItem[];
  timeline: TimelineEvent[];
  meals: Meal[];
  crew: CrewMember[];
  parkIntel: ParkIntel;
  offlineStatus: OfflineStatus;
  astro: AstroData;
  alerts: Alert[];
  settings: Settings;
}
