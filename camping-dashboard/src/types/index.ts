import type {
  AlertRow,
  AstroDataRow,
  CrewMemberRow,
  GearItemRow,
  MealRow,
  OfflineStatusRow,
  ParkIntelRow,
  PrepFeedItemRow,
  SettingsRow,
  TimelineEventRow,
  TripRow,
  WeatherCurrentRow,
  WeatherForecastRow,
  WeatherRefreshStateRow,
} from './database';

export type ThemeMode = 'day' | 'night';
export type ThemeOverride = 'auto' | 'day' | 'night';
export type ThemeVariant = 'expedition' | 'clean';
export type Priority = 'critical' | 'high' | 'low';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type PrepType = 'dehydrated' | 'fresh' | 'fire' | 'restaurant';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type Units = 'metric' | 'imperial';
export type PrepFeedCategory =
  | 'Gear'
  | 'Food'
  | 'Shelter'
  | 'Cook Kit'
  | 'Route'
  | 'Campsite'
  | 'Misc';
export type TripMemberRole = 'owner' | 'editor' | 'viewer';
export type TripMapStyle = 'openstreetmap' | 'expedition';
export type TimelinePhase = 'Transit' | 'Setup' | 'Sustain' | 'Leisure' | 'None';

type PresentColumns<T, K extends keyof T> = T & {
  [P in K]-?: NonNullable<T[P]>;
};

export type TripDashboard = PresentColumns<
  TripRow,
  'end_date' | 'start_date'
> & {
  map_style: TripMapStyle | null;
  theme_mode: ThemeOverride | null;
};

export type TripWithAccess = TripDashboard & {
  role: TripMemberRole;
};

export interface TripFormValues {
  name: string;
  parkName: string;
  lakeName: string;
  siteName: string;
  startDate: string;
  endDate: string;
}

export interface CreateTripRequest {
  name: string;
  park_name?: string;
  lake_name?: string;
  site_name?: string;
  start_date: string;
  end_date: string;
  campsite_latitude: number;
  campsite_longitude: number;
  campsite_label?: string | null;
  campsite_source?: string | null;
  campsite_osm_id?: string | null;
}

export type WeatherCurrent = PresentColumns<
  WeatherCurrentRow,
  'condition_label' | 'icon' | 'temperature_c' | 'updated_at'
>;
export type WeatherForecast = PresentColumns<
  WeatherForecastRow,
  'condition_label' | 'icon'
>;
export type WeatherRefreshStatus = 'idle' | 'refreshing' | 'retry' | 'failed';
export type WeatherRefreshState = WeatherRefreshStateRow & {
  status: WeatherRefreshStatus;
};
export type GearItem = PresentColumns<
  GearItemRow,
  Exclude<keyof GearItemRow, 'id' | 'name' | 'acquired'>
> & { priority: Priority };
export type TimelineEvent = PresentColumns<
  TimelineEventRow,
  Exclude<keyof TimelineEventRow, 'id' | 'phase'>
> & { phase: TimelinePhase | null };
export type Meal = PresentColumns<MealRow, Exclude<keyof MealRow, 'id'>> & {
  meal_type: MealType;
  prep_type: PrepType;
};
export type CrewMember = PresentColumns<
  CrewMemberRow,
  Exclude<keyof CrewMemberRow, 'id' | 'name'>
>;
export type ParkIntel = PresentColumns<ParkIntelRow, Exclude<keyof ParkIntelRow, 'trip_id'>>;
export type OfflineStatus = PresentColumns<
  OfflineStatusRow,
  Exclude<keyof OfflineStatusRow, 'trip_id'>
>;
export type AstroData = PresentColumns<AstroDataRow, Exclude<keyof AstroDataRow, 'trip_id'>>;
export type Alert = PresentColumns<AlertRow, Exclude<keyof AlertRow, 'id'>> & {
  severity: AlertSeverity;
};
export type PrepFeedItem = PresentColumns<PrepFeedItemRow, 'caption'> & {
  category: PrepFeedCategory;
};
export type Settings = PresentColumns<SettingsRow, Exclude<keyof SettingsRow, 'trip_id'>> & {
  manual_theme_override: ThemeOverride;
  preferred_units: Units;
  theme_variant: ThemeVariant;
};

export interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isPast: boolean;
}

export interface ReadinessScore {
  overall: number;
  label: string;
  gear: number;
  meals: number;
  weather: number;
  offline: number;
  timeline: number;
}

export interface TripDashboardData {
  trip: TripDashboard;
  currentWeather: WeatherCurrent | null;
  forecast: WeatherForecast[];
  weatherRefresh: WeatherRefreshState | null;
  gear: GearItem[];
  timeline: TimelineEvent[];
  meals: Meal[];
  crew: CrewMember[];
  parkIntel: ParkIntel | null;
  offlineStatus: OfflineStatus | null;
  astro: AstroData | null;
  alerts: Alert[];
  prepFeed: PrepFeedItem[];
  settings: Settings;
}

export type DashboardData = TripDashboardData;
