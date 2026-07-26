import { describe, expect, it } from 'vitest';
import {
  calculateOfflineReadiness,
  calculateWeatherPreparedness,
  getSkyQuality,
} from './helpers';
import type { AstroData } from '@/types';

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
