import { describe, expect, it } from 'vitest';
import { resolveTripWorkspaceBackground } from './tripWorkspaceVisuals';

describe('resolveTripWorkspaceBackground', () => {
  it.each([
    ['Algonquin Park', 'Maple Lake'],
    ['Algonquin Park', 'Maple Leaf Lake'],
    ['Algonquin Provincial Park', 'Maple Lake'],
    ['Algonquin Provincial Park', 'Maple Leaf Lake'],
    ['  ALGONQUIN PARK  ', '  maple lake  '],
  ])('resolves the approved %s and %s identity', (parkName, lakeName) => {
    expect(
      resolveTripWorkspaceBackground({
        park_name: parkName,
        lake_name: lakeName,
      })
    ).toBe('/sunset-over-the-lake.webp');
  });

  it.each([
    ['Algonquin Park', 'Opeongo Lake'],
    ['Killarney Provincial Park', 'Maple Lake'],
    ['Algonquin', 'Maple Lake'],
    ['Algonquin Park', 'Maple'],
    [null, 'Maple Lake'],
    ['Algonquin Park', null],
  ])('returns null for the unapproved %s and %s identity', (parkName, lakeName) => {
    expect(
      resolveTripWorkspaceBackground({
        park_name: parkName,
        lake_name: lakeName,
      })
    ).toBeNull();
  });
});
