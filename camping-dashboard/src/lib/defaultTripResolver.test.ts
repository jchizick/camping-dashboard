import { describe, expect, it } from 'vitest';
import { resolveDefaultTrip, type DefaultTripCandidate } from './defaultTripResolver';

const now = new Date('2026-07-05T16:00:00Z');
const trip = (id: string, start_date = '2026-07-05', end_date = '2026-07-09') => ({ id, start_date, end_date });

function permutations<T>(items: T[]): T[][] {
  return items.length === 0 ? [[]] : items.flatMap((item, index) =>
    permutations(items.filter((_, i) => i !== index)).map((rest) => [item, ...rest]));
}

describe('resolveDefaultTrip', () => {
  it('distinguishes a successful empty collection', () => {
    expect(resolveDefaultTrip([], now)).toEqual({ status: 'no-trips' });
  });

  it.each([
    ['active', '2026-07-05', '2026-07-09'],
    ['upcoming', '2026-07-06', '2026-07-09'],
    ['completed', '2026-07-01', '2026-07-04'],
  ])('resolves one %s trip', (category, start, end) => {
    const candidate = trip('one', start, end);
    expect(resolveDefaultTrip([candidate], now)).toEqual({ status: 'resolved', trip: candidate, category, invalidTrips: [] });
  });

  it.each([
    ['active beats upcoming and completed', [trip('winner'), trip('future', '2026-07-06'), trip('past', '2026-07-01', '2026-07-04')]],
    ['upcoming beats completed', [trip('winner', '2026-07-06'), trip('past', '2026-07-01', '2026-07-04')]],
    ['nearest upcoming', [trip('winner', '2026-07-06'), trip('later', '2026-07-07')]],
    ['upcoming end tie', [trip('winner', '2026-07-06', '2026-07-08'), trip('later', '2026-07-06', '2026-07-09')]],
    ['latest completed end', [trip('winner', '2026-07-01', '2026-07-04'), trip('older', '2026-07-01', '2026-07-03')]],
    ['latest completed start tie', [trip('winner', '2026-07-02', '2026-07-04'), trip('older', '2026-07-01', '2026-07-04')]],
    ['active latest start', [trip('winner'), trip('earlier', '2026-07-04', '2026-07-06')]],
    ['active earliest end tie', [trip('winner', '2026-07-05', '2026-07-06'), trip('longer')]],
  ] satisfies [string, DefaultTripCandidate[]][])('uses %s regardless of row order', (_, candidates) => {
    for (const input of permutations(candidates)) {
      expect(resolveDefaultTrip(input, now)).toMatchObject({ status: 'resolved', trip: { id: 'winner' } });
    }
  });

  it.each([
    ['2026-07-05', '2026-07-09'],
    ['2026-07-06', '2026-07-09'],
    ['2026-07-01', '2026-07-04'],
  ])('breaks identical %s–%s ranges by stable ID', (start, end) => {
    for (const input of permutations(['z', 'a', 'm'].map((id) => trip(id, start, end)))) {
      expect(resolveDefaultTrip(input, now)).toMatchObject({ trip: { id: 'a' } });
    }
  });

  it.each([
    ['TBD', '2026-07-09'], ['2026-07-05', 'TBD'],
    ['2026-07-09', '2026-07-05'], ['2026-02-30', '2026-07-09'],
    ['2026-07-05', '2026-13-01'], ['', '2026-07-09'],
    ['2026-7-05', '2026-07-09'], ['2026-07-05T00:00:00Z', '2026-07-09'],
    ['2026-02-29', '2026-07-09'],
  ])('preserves invalid range %s–%s without ranking it', (start, end) => {
    const invalid = trip('invalid', start, end);
    expect(resolveDefaultTrip([invalid], now)).toEqual({ status: 'chooser-required', invalidTrips: [invalid] });
    const valid = trip('valid', '2026-07-01', '2026-07-04');
    expect(resolveDefaultTrip([invalid, valid], now)).toEqual({ status: 'resolved', trip: valid, category: 'completed', invalidTrips: [invalid] });
  });

  it('returns all invalid trips in stable order for a chooser', () => {
    const a = trip('a', '', '');
    const z = trip('z', 'bad', 'bad');
    for (const input of [[a, z], [z, a]]) {
      expect(resolveDefaultTrip(input, now)).toEqual({ status: 'chooser-required', invalidTrips: [a, z] });
    }
  });

  it.each([
    ['2026-07-04T16:00:00Z', 'upcoming'],
    ['2026-07-05T16:00:00Z', 'active'],
    ['2026-07-09T16:00:00Z', 'active'],
    ['2026-07-10T16:00:00Z', 'completed'],
    ['2026-07-05T03:59:59Z', 'upcoming'],
    ['2026-07-05T04:00:00Z', 'active'],
    ['2026-07-10T03:59:59Z', 'active'],
    ['2026-07-10T04:00:00Z', 'completed'],
  ])('classifies inclusive Toronto days at %s', (instant, category) => {
    expect(resolveDefaultTrip([trip('one')], new Date(instant))).toMatchObject({ status: 'resolved', category });
  });

  it.each([
    ['2026-01-05T04:59:59Z', 'upcoming'], ['2026-01-05T05:00:00Z', 'active'],
  ])('uses Toronto winter offset at %s', (instant, category) => {
    expect(resolveDefaultTrip([trip('one', '2026-01-05', '2026-01-05')], new Date(instant))).toMatchObject({ category });
  });

  it('accepts a valid leap day', () => {
    expect(resolveDefaultTrip([trip('leap', '2028-02-29', '2028-02-29')], now)).toMatchObject({ status: 'resolved', category: 'upcoming' });
  });

  it('preserves input objects and additional trip fields without mutation', () => {
    const chosen = Object.freeze({ ...trip('a'), name: 'My trip' });
    const input = Object.freeze([Object.freeze(trip('z')), chosen]);
    const result = resolveDefaultTrip(input, now);
    expect(input.map(({ id }) => id)).toEqual(['z', 'a']);
    if (result.status !== 'resolved') throw new Error('Expected a resolved trip');
    expect(result.trip).toBe(chosen);
  });

  it('rejects an invalid clock instead of silently classifying trips', () => {
    expect(() => resolveDefaultTrip([trip('one')], new Date('invalid'))).toThrow(RangeError);
  });
});
