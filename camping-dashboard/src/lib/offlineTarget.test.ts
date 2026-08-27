import { describe, expect, it } from 'vitest';
import { parseOfflineTarget } from './offlineTarget';

describe('offline destination targets', () => {
  it.each([
    ['/trips/trip-1', 'home'],
    ['/trips/trip-1/plan', 'plan'],
    ['/trips/trip-1/gear', 'gear'],
    ['/trips/trip-1/crew', 'crew'],
    ['/trips/trip-1/guide', 'field'],
  ] as const)('maps %s to %s', (path, destination) => {
    expect(parseOfflineTarget(path)).toMatchObject({
      tripId: 'trip-1',
      destination,
      pathname: path,
    });
  });

  it.each(['/offline', '/trips', '/trips/trip-1/field-log', '/api/trips/trip-1'])(
    'rejects unsupported target %s',
    (path) => expect(parseOfflineTarget(path)).toBeNull()
  );

  it.each([
    'https://attacker.example/trips/trip-1',
    'javascript:alert(1)',
    '/trips/../trip-1',
    '/trips/trip-1/%2e%2e',
    '/trips/trip-1/unknown',
    '/trips/trip-1/gear/extra',
  ])('rejects malicious or non-canonical target %s', (target) => {
    expect(parseOfflineTarget(target)).toBeNull();
  });
});
