import { describe, expect, it } from 'vitest';
import {
  calculateEstimatedGearWeight,
  formatEstimatedGearWeight,
} from './helpers';

describe('estimated gear weight', () => {
  it('sums multiple planned item weights and formats sensible decimal precision', () => {
    const estimate = calculateEstimatedGearWeight([
      { weight_kg: 2.4 },
      { weight_kg: 1.35 },
      { weight_kg: 0.3 },
    ]);

    expect(estimate).toEqual({
      totalKg: 4.05,
      knownItemCount: 3,
      unknownItemCount: 0,
    });
    expect(formatEstimatedGearWeight(estimate)).toBe('4.1 kg');
  });

  it('marks partial totals approximate and ignores missing or invalid weights', () => {
    const estimate = calculateEstimatedGearWeight([
      { weight_kg: 2.4 },
      { weight_kg: null },
      { weight_kg: 0 },
      { weight_kg: -1 },
      { weight_kg: Number.POSITIVE_INFINITY },
    ]);

    expect(estimate).toEqual({
      totalKg: 2.4,
      knownItemCount: 1,
      unknownItemCount: 4,
    });
    expect(formatEstimatedGearWeight(estimate)).toBe('~2.4 kg');
  });

  it('distinguishes an empty plan from planned gear with no known weights', () => {
    expect(formatEstimatedGearWeight(calculateEstimatedGearWeight([]))).toBe('0 kg');
    expect(formatEstimatedGearWeight(calculateEstimatedGearWeight([
      { weight_kg: null },
      { weight_kg: 0 },
    ]))).toBe('—');
  });

  it('does not change the total with acquired or packed state', () => {
    const gear = [
      { weight_kg: 2, acquired: true, packed: true },
      { weight_kg: 3, acquired: false, packed: false },
    ];
    const estimate = calculateEstimatedGearWeight(gear);

    expect(estimate.totalKg).toBe(5);
    expect(formatEstimatedGearWeight(estimate)).toBe('5 kg');
  });
});
