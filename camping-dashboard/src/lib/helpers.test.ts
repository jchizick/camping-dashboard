import { describe, expect, it } from 'vitest';
import {
  calculateMealCompleteness,
  calculateOfflineReadiness,
  calculateTimelineCompleteness,
  calculateWeatherPreparedness,
  getSkyQuality,
} from './helpers';
import type { AstroData, Meal, TimelineEvent } from '@/types';

const astro: AstroData = {
  trip_id: 'trip-test',
  golden_hour_start: '',
  golden_hour_end: '',
  blue_hour_end: '',
  moon_phase: '',
  moon_illumination: 20,
  milky_way_visibility: '',
  stargazing_notes: '',
  updated_at: '',
};

describe('blank dashboard calculations', () => {
  it('treats missing optional modules as not ready without throwing', () => {
    expect(calculateOfflineReadiness(null)).toBe(0);
    expect(calculateWeatherPreparedness(null, [])).toBe(0);
    expect(getSkyQuality(null, astro)).toBe('Unavailable');
  });
});

describe('trip-length-dependent readiness calculations', () => {
  it('uses all five inclusive trip days for meal completeness', () => {
    const meals = [
      { meal_type: 'breakfast' },
      { meal_type: 'lunch' },
      { meal_type: 'dinner' },
    ] as unknown as Meal[];

    expect(calculateMealCompleteness(meals, 5)).toBe(20);
  });

  it('uses all five inclusive trip days for timeline completeness', () => {
    const events = Array.from({ length: 4 }, (_, index) => ({
      id: `event-${index}`,
    })) as unknown as TimelineEvent[];

    expect(calculateTimelineCompleteness(events, 5)).toBe(20);
  });
});
