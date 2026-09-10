import { describe, expect, it } from 'vitest';
import { getNewTripOrigin, newTripHref } from './newTripNavigation';
describe('New Trip workspace origins', () => {
  it.each(['', '/plan', '/gear', '/crew', '/guide', '/field-log'])('preserves workspace section %s', section => {
    const path = `/trips/trip-123${section}`;
    expect(getNewTripOrigin(path)).toBe(path);
    expect(new URLSearchParams(newTripHref(path).split('?')[1]).get('from')).toBe(path);
  });
  it.each([null, 'https://evil.example', '//evil.example', 'javascript:alert(1)', '/trips/new', '/trips/new/plan', '/account', '/trips/a/../new', '/trips/%ZZ', '/trips/%2fnew', '/trips/a?next=x', '/trips/a#x', '/trips/a\\gear'])('rejects %s', value => {
    expect(getNewTripOrigin(value)).toBeNull();
  });
  it('falls back to direct entry for a non-workspace path', () => {
    expect(newTripHref('/trips')).toBe('/trips/new');
  });
});
