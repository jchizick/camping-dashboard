import { describe, expect, it } from 'vitest';
import type { Meal, TimelineEvent, TripDashboard } from '@/types';
import {
  formatPlanDateRange,
  formatPlanDayDate,
  getLatestPlannedDay,
  getPlanDayEvents,
  getPlanDayMeals,
  getTripCampsite,
  getTripDestination,
} from './planViewModel';

function event(overrides: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: 'event',
    trip_id: 'trip',
    day_number: 1,
    event_time: '09:00',
    title: 'Event',
    details: '',
    sort_order: 10,
    phase: null,
    ...overrides,
  };
}

function meal(overrides: Partial<Meal>): Meal {
  return {
    id: 'meal',
    trip_id: 'trip',
    day_number: 1,
    meal_type: 'breakfast',
    prep_type: 'fresh',
    title: 'Meal',
    notes: '',
    calories: 0,
    assigned_to: '',
    ...overrides,
  } as Meal;
}

describe('mobile Plan view model', () => {
  it('selects a day and preserves canonical itinerary ordering', () => {
    const events = [
      event({ id: 'later', day_number: 2, sort_order: 20, event_time: '08:00' }),
      event({ id: 'earlier', day_number: 2, sort_order: 10, event_time: '10:00' }),
      event({ id: 'other-day', day_number: 1 }),
    ];

    expect(getPlanDayEvents(events, 2).map(({ id }) => id)).toEqual([
      'earlier',
      'later',
    ]);
  });

  it('keeps duplicate meal slots visible while ordering meal types', () => {
    const meals = [
      meal({ id: 'dinner', meal_type: 'dinner' }),
      meal({ id: 'breakfast-1', meal_type: 'breakfast' }),
      meal({ id: 'breakfast-2', meal_type: 'breakfast' }),
      meal({ id: 'other-day', day_number: 2 }),
    ];

    expect(getPlanDayMeals(meals, 1).map(({ id }) => id)).toEqual([
      'breakfast-1',
      'breakfast-2',
      'dinner',
    ]);
  });

  it('derives day labels and the latest day without local duration rules', () => {
    expect(formatPlanDayDate('2026-07-05', 2)).toBe('Jul 6');
    expect(formatPlanDateRange('2026-07-05', '2026-07-09')).toBe(
      'Jul 5, 2026 – Jul 9, 2026'
    );
    expect(
      getLatestPlannedDay(
        [event({ day_number: 4 })],
        [meal({ day_number: 5 })]
      )
    ).toBe(5);
  });

  it('uses existing destination and campsite fields with quiet fallbacks', () => {
    const trip = {
      lake_name: 'Maple Lake',
      park_name: 'Algonquin Park',
      site_name: 'Site 4',
      campsite_label: 'Site 4',
    } as TripDashboard;

    expect(getTripDestination(trip)).toBe('Maple Lake');
    expect(getTripCampsite(trip)).toBe('Site 4');
    expect(
      getTripDestination({ ...trip, lake_name: null, park_name: null })
    ).toBe('Destination to be confirmed');
  });
});
