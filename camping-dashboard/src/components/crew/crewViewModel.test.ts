import { describe, expect, it } from 'vitest';
import type { CrewMember } from '@/types';
import { getCrewLoadRows, splitResponsibilities } from './crewViewModel';

describe('shared crew load helpers', () => {
  it('splits combined responsibilities', () => {
    expect(splitResponsibilities('SHELTER SYSTEM + SAFETY CORE')).toEqual(['SHELTER SYSTEM', 'SAFETY CORE']);
  });

  it('preserves raw ratios separately from rounded display percentages', () => {
    const crew = [25, 12].map(load_weight_kg => ({ load_weight_kg }) as CrewMember);
    const { rows, totalLoad } = getCrewLoadRows(crew);
    expect(totalLoad).toBe(37);
    expect(rows[0].rawPercentage).toBeCloseTo(67.5676, 3);
    expect(rows[1].rawPercentage).toBeCloseTo(32.4324, 3);
    expect(rows.map(row => row.displayPercentage)).toEqual([68, 32]);
  });
});
