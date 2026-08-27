import { describe, expect, it, vi } from 'vitest';
import type {
  Alert,
  DashboardData,
  GearItem,
  TimelineEvent,
  TripDashboard,
} from '@/types';
import { evaluateReadiness } from '@/lib/readiness';
import { createHomeViewModel } from './homeViewModel';

function event(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'event-1',
    trip_id: 'trip/one',
    day_number: 1,
    event_time: '09:00',
    title: 'Launch',
    details: '',
    sort_order: 10,
    phase: null,
    ...overrides,
  } as TimelineEvent;
}

function alert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-1',
    trip_id: 'trip/one',
    title: 'Wind watch',
    body: 'Secure loose equipment.',
    severity: 'watch',
    is_active: true,
    dismissed_at: null,
    created_at: '2026-08-24T12:00:00Z',
    updated_at: '2026-08-24T12:00:00Z',
    ...overrides,
  } as Alert;
}

describe('Home view model', () => {
  it('collects shared presentation data without recalculating domain results', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 12));

    const trip = {
      id: 'trip/one',
      name: 'Maple Lake Weekend',
      park_name: 'Algonquin Park',
      lake_name: 'Maple Lake',
      site_name: 'Site 4',
      start_date: '2026-08-24',
      end_date: '2026-08-26',
      campsite_latitude: 45.6,
      campsite_longitude: -78.4,
    } as TripDashboard;
    const timeline = [
      event(),
      event({ id: 'event-2', title: 'Make camp', sort_order: 20 }),
    ];
    const readiness = evaluateReadiness({
      tripId: trip.id,
      tripDays: 3,
      gear: [
        {
          id: 'gear-1',
          name: 'Tent',
          priority: 'critical',
          acquired: true,
          packed: true,
        } as GearItem,
      ],
      meals: [],
      timeline,
      currentWeather: null,
      forecast: [],
      offlineStatus: null,
      modules: { mealsEnabled: false, offlineEnabled: false },
    });
    const model = createHomeViewModel({
      data: {
        currentWeather: null,
        weatherRefresh: null,
        forecast: [],
        astro: null,
      } as unknown as DashboardData,
      trip,
      tripDays: 3,
      timeline,
      alerts: [
        alert({ id: 'info', severity: 'info' }),
        alert({ id: 'critical', severity: 'critical' }),
        alert({ id: 'dismissed', severity: 'critical', dismissed_at: '2026-08-24' }),
      ],
      gear: [{
        id: 'gear-1',
        trip_id: trip.id,
        name: 'Tent',
        priority: 'critical',
        acquired: true,
        packed: true,
      } as GearItem],
      readiness,
    });

    expect(model.readiness).toBe(readiness);
    expect(model.schedule.events.map((item) => item.id)).toEqual([
      'event-1',
      'event-2',
    ]);
    expect(model.nextEvent?.id).toBe('event-1');
    expect(model.laterEvents.map((item) => item.id)).toEqual(['event-2']);
    expect(model.notice?.id).toBe('critical');
    expect(model.hrefs).toEqual({
      gear: '/trips/trip%2Fone/gear',
      plan: '/trips/trip%2Fone/plan',
      field: '/trips/trip%2Fone/guide',
    });
    expect(model.hasCampsiteContext).toBe(true);
    expect(model.setup).toBeNull();

    vi.useRealTimers();
  });

  it('derives Required Gear setup from trip state and removes it once assessment exists', () => {
    const trip = {
      id: 'trip-1',
      name: 'Fresh trip',
      start_date: '2026-08-24',
      end_date: '2026-08-26',
    } as TripDashboard;
    const baseInput = {
      data: {
        currentWeather: null,
        weatherRefresh: null,
        forecast: [],
        astro: null,
      } as unknown as DashboardData,
      trip,
      tripDays: 3,
      timeline: [],
      alerts: [],
    };
    const emptyReadiness = evaluateReadiness({
      tripId: trip.id,
      tripDays: 3,
      gear: [],
      meals: [],
      timeline: [],
      currentWeather: null,
      forecast: [],
      offlineStatus: null,
      modules: { mealsEnabled: true, offlineEnabled: true },
    });
    const emptyModel = createHomeViewModel({
      ...baseInput,
      gear: [],
      readiness: emptyReadiness,
    });

    expect(emptyModel.setup).toEqual(expect.objectContaining({
      need: 'identify-required-gear',
      action: {
        href: '/trips/trip-1/gear?intent=add-required',
        label: 'Identify Required Gear',
      },
    }));

    const requiredGear = [{
      id: 'gear-required',
      trip_id: trip.id,
      name: 'Water filter',
      priority: 'critical',
      acquired: false,
      packed: false,
    } as GearItem];
    const matureReadiness = evaluateReadiness({
      tripId: trip.id,
      tripDays: 3,
      gear: requiredGear,
      meals: [],
      timeline: [],
      currentWeather: null,
      forecast: [],
      offlineStatus: null,
      modules: { mealsEnabled: true, offlineEnabled: true },
    });
    expect(createHomeViewModel({
      ...baseInput,
      gear: requiredGear,
      readiness: matureReadiness,
    }).setup).toBeNull();
  });
});
