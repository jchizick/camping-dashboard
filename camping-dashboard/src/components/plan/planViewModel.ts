import type { Meal, TimelineEvent, TripDashboard } from '@/types';

const MILLISECONDS_PER_DAY = 86_400_000;
const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const shortDateFormatter = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function calendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getPlanDayEvents(
  events: readonly TimelineEvent[],
  day: number
): TimelineEvent[] {
  return events
    .filter((event) => event.day_number === day)
    .toSorted(
      (left, right) =>
        left.sort_order - right.sort_order ||
        left.event_time.localeCompare(right.event_time)
    );
}

export function getPlanDayMeals(meals: readonly Meal[], day: number): Meal[] {
  return meals
    .map((meal, index) => ({ meal, index }))
    .filter(({ meal }) => meal.day_number === day)
    .toSorted((left, right) => {
      const leftOrder = mealOrder.indexOf(left.meal.meal_type);
      const rightOrder = mealOrder.indexOf(right.meal.meal_type);
      return leftOrder - rightOrder || left.index - right.index;
    })
    .map(({ meal }) => meal);
}

export function getLatestPlannedDay(
  events: readonly TimelineEvent[],
  meals: readonly Meal[]
): number {
  return Math.max(
    1,
    ...events.map((event) => event.day_number),
    ...meals.map((meal) => meal.day_number)
  );
}

export function formatPlanDayDate(startDate: string, day: number): string | null {
  const start = calendarDate(startDate);
  if (!start || !Number.isInteger(day) || day < 1) return null;
  return shortDateFormatter.format(
    new Date(start.getTime() + (day - 1) * MILLISECONDS_PER_DAY)
  );
}

export function formatPlanDateRange(startDate: string, endDate: string): string {
  const start = calendarDate(startDate);
  const end = calendarDate(endDate);
  if (!start || !end) return 'Dates to be confirmed';
  return `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;
}

export function getTripDestination(trip: TripDashboard): string {
  return trip.lake_name || trip.park_name || 'Destination to be confirmed';
}

export function getTripCampsite(trip: TripDashboard): string {
  const values = [trip.site_name, trip.campsite_label]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, all) => all.indexOf(value) === index);
  return values.join(' · ') || 'Campsite to be confirmed';
}
