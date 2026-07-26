import type { Database, Json } from './supabase';

type PublicSchema = Database['public'];

export type TableName = keyof PublicSchema['Tables'];
export type TableRow<T extends TableName> = PublicSchema['Tables'][T]['Row'];
export type TableInsert<T extends TableName> = PublicSchema['Tables'][T]['Insert'];
export type TableUpdate<T extends TableName> = PublicSchema['Tables'][T]['Update'];

export type AlertRow = TableRow<'alerts'>;
export type AstroDataRow = TableRow<'astro_data'>;
export type CrewMemberRow = TableRow<'crew_members'>;
export type GearItemRow = TableRow<'gear_items'>;
export type MealRow = TableRow<'meals'>;
export type OfflineStatusRow = TableRow<'offline_status'>;
export type ParkIntelRow = TableRow<'park_intel'>;
export type PrepFeedItemRow = TableRow<'prep_feed_items'>;
export type PrepFeedItemInsert = TableInsert<'prep_feed_items'>;
export type PrepFeedItemUpdate = TableUpdate<'prep_feed_items'>;
export type PrepFeedStorageCleanupJobRow =
  TableRow<'prep_feed_storage_cleanup_jobs'>;
export type SettingsRow = TableRow<'settings'>;
export type TimelineEventRow = TableRow<'timeline_events'>;
export type TripMemberRow = TableRow<'trip_members'>;
export type TripRow = TableRow<'trips'>;
export type TripInsert = TableInsert<'trips'>;
export type TripUpdate = TableUpdate<'trips'>;
export type WeatherCurrentRow = TableRow<'weather_current'>;
export type WeatherCurrentInsert = TableInsert<'weather_current'>;
export type WeatherForecastRow = TableRow<'weather_forecast'>;
export type WeatherForecastInsert = TableInsert<'weather_forecast'>;

export type CreateTripArgs = PublicSchema['Functions']['create_trip']['Args'];
export type CreateTripResult = PublicSchema['Functions']['create_trip']['Returns'];
export type BeginTripDeletionArgs =
  PublicSchema['Functions']['begin_trip_deletion']['Args'];
export type BeginTripDeletionResult =
  PublicSchema['Functions']['begin_trip_deletion']['Returns'];
export type CompleteTripDeletionArgs =
  PublicSchema['Functions']['complete_trip_deletion']['Args'];
export type CompleteTripDeletionResult =
  PublicSchema['Functions']['complete_trip_deletion']['Returns'];
export type ReplacePrepFeedImageArgs =
  PublicSchema['Functions']['replace_prep_feed_image']['Args'];
export type ReplacePrepFeedImageResult =
  PublicSchema['Functions']['replace_prep_feed_image']['Returns'];

export type { Database, Json };
