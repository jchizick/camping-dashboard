import type {
  Alert,
  DashboardData,
  GearItem,
  TimelineEvent,
  TripDashboard,
} from '@/types';
import type { ReadinessResult } from '@/lib/readiness';
import {
  getHomeScheduleSummary,
  getPriorityAlert,
  getVisibleAlerts,
  type HomeScheduleSummary,
} from './homeSelectors';

export interface HomeSetupContext {
  need: 'identify-required-gear';
  title: string;
  description: string;
  action: {
    href: string;
    label: string;
  };
}

export function getHomeSetupContext({
  gear,
  readiness,
  gearHref,
}: {
  gear: GearItem[];
  readiness: ReadinessResult;
  gearHref: string;
}): HomeSetupContext | null {
  const hasRequiredGear = gear.some((item) => item.priority === 'critical');
  const gearAssessmentUnavailable =
    readiness.categories.gear.availability !== 'scored';

  if (hasRequiredGear || !gearAssessmentUnavailable) return null;

  return {
    need: 'identify-required-gear',
    title: 'Identify Required Gear',
    description:
      'Mark the items this trip must have so readiness can assess what still needs attention.',
    action: {
      href: `${gearHref}?intent=add-required`,
      label: 'Identify Required Gear',
    },
  };
}

export interface HomeViewModel {
  trip: TripDashboard;
  readiness: ReadinessResult;
  setup: HomeSetupContext | null;
  schedule: HomeScheduleSummary;
  nextEvent: TimelineEvent | null;
  laterEvents: TimelineEvent[];
  notice: Alert | null;
  conditions: Pick<
    DashboardData,
    'currentWeather' | 'weatherRefresh' | 'forecast' | 'astro'
  >;
  hrefs: {
    gear: string;
    plan: string;
    field: string;
  };
  hasCampsiteContext: boolean;
}

export function createHomeViewModel({
  data,
  trip,
  tripDays,
  timeline,
  alerts,
  gear,
  readiness,
}: {
  data: DashboardData;
  trip: TripDashboard;
  tripDays: number;
  timeline: TimelineEvent[];
  alerts: Alert[];
  gear: GearItem[];
  readiness: ReadinessResult;
}): HomeViewModel {
  const base = `/trips/${encodeURIComponent(trip.id)}`;
  const gearHref = `${base}/gear`;
  const schedule = getHomeScheduleSummary({ trip, tripDays, timeline });
  const notice = getPriorityAlert(getVisibleAlerts(alerts));
  const hasCoordinates =
    typeof trip.campsite_latitude === 'number' &&
    Number.isFinite(trip.campsite_latitude) &&
    typeof trip.campsite_longitude === 'number' &&
    Number.isFinite(trip.campsite_longitude);

  return {
    trip,
    readiness,
    setup: getHomeSetupContext({ gear, readiness, gearHref }),
    schedule,
    nextEvent: schedule.events[0] ?? null,
    laterEvents: schedule.events.slice(1),
    notice,
    conditions: {
      currentWeather: data.currentWeather,
      weatherRefresh: data.weatherRefresh,
      forecast: data.forecast,
      astro: data.astro,
    },
    hrefs: {
      gear: gearHref,
      plan: `${base}/plan`,
      field: `${base}/guide`,
    },
    hasCampsiteContext: Boolean(
      hasCoordinates || trip.park_name || trip.lake_name || trip.site_name
    ),
  };
}
