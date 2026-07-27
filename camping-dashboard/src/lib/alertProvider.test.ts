import { describe, expect, it, vi } from 'vitest';
import {
  AlertProviderError,
  createEnvironmentCanadaProvider,
  createOntarioParksProvider,
} from '../../supabase/functions/_shared/alertProvider';

const ontarioContext = {
  tripId: 'trip-one',
  countryCode: 'CA',
  regionCode: 'ON',
  provider: 'ontario-parks' as const,
  providerExternalId: 'algonquin/backcountry',
};
const canadaContext = {
  tripId: 'trip-one',
  countryCode: 'CA',
  regionCode: 'ON',
  provider: 'environment-canada' as const,
  providerExternalId: 'onrm31',
};

function response(body: string, status = 200) {
  return new Response(body, { status });
}

describe('Ontario Parks alert adapter', () => {
  it('normalizes multiple alerts with stable identities, severity and attribution', async () => {
    const html = `<html><main><section id="alerts">
      <div>Park Notice <h2>Backcountry closure</h2>
        <p>Warning: route closed.</p><a href="/park/algonquin/backcountry/alerts">Details</a>
      </div><hr>
      <div>Park Notice <h2>Water advisory</h2><p>Advisory in effect.</p></div><hr>
    </section></main></html>`;
    const provider = createOntarioParksProvider({
      fetch: vi.fn(async () => response(html)),
      now: () => new Date('2026-07-27T03:00:00Z'),
    });
    const first = await provider.fetchAlerts(ontarioContext);
    const second = await provider.fetchAlerts(ontarioContext);

    expect(first.alerts).toHaveLength(2);
    expect(first.alerts.map((alert) => alert.severity)).toEqual(['warning', 'advisory']);
    expect(first.alerts[0].sourceUrl).toBe(
      'https://www.ontarioparks.ca/park/algonquin/backcountry/alerts'
    );
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.alerts.map((alert) => alert.externalId))
      .toEqual(first.alerts.map((alert) => alert.externalId));
  });

  it('treats an explicit no-alert page as an authoritative empty result', async () => {
    const provider = createOntarioParksProvider({
      fetch: vi.fn(async () => response(
        '<html><main><section id="alerts">No active alerts.</section></main></html>'
      )),
    });
    await expect(provider.fetchAlerts(ontarioContext)).resolves.toMatchObject({
      complete: true,
      alerts: [],
    });
  });

  it('turns unrecognized markup into a retryable parser failure', async () => {
    const provider = createOntarioParksProvider({
      fetch: vi.fn(async () => response('<html><main>Page layout changed</main></html>')),
    });
    await expect(provider.fetchAlerts(ontarioContext)).rejects.toMatchObject({
      code: 'provider_contract',
      retryable: true,
    });
  });

  it('rejects trips without explicit Ontario coverage', async () => {
    const provider = createOntarioParksProvider({ fetch: vi.fn() });
    await expect(provider.fetchAlerts({ ...ontarioContext, regionCode: 'QC' }))
      .rejects.toBeInstanceOf(AlertProviderError);
  });
});

describe('Environment Canada alert adapter', () => {
  it.each([
    ['Advisory issued', 'advisory'],
    ['Severe thunderstorm watch', 'watch'],
    ['Rainfall warning', 'warning'],
    ['Extreme emergency', 'critical'],
  ])('maps %s to %s', async (title, severity) => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry>
      <id>tag:weather.gc.ca,2026:test</id><title>${title}</title>
      <summary>Regional conditions.</summary>
      <published>2026-07-27T02:00:00Z</published>
      <updated>2026-07-27T02:15:00Z</updated>
      <link href="https://weather.gc.ca/warnings/report_e.html" />
    </entry></feed>`;
    const provider = createEnvironmentCanadaProvider({
      fetch: vi.fn(async () => response(xml)),
      now: () => new Date('2026-07-27T03:00:00Z'),
    });
    const result = await provider.fetchAlerts(canadaContext);
    expect(result.alerts[0]).toMatchObject({ severity, issuedAt: '2026-07-27T02:00:00.000Z' });
  });

  it('deduplicates repeated entries and recognizes cancellations', async () => {
    const entry = `<entry><id>same-alert</id><title>Warning ended</title>
      <summary>Cancelled</summary></entry>`;
    const provider = createEnvironmentCanadaProvider({
      fetch: vi.fn(async () => response(`<feed>${entry}${entry}</feed>`)),
    });
    const result = await provider.fetchAlerts(canadaContext);
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].status).toBe('cancelled');
  });

  it('recognizes a complete no-alert feed without fabricating an all-clear row', async () => {
    const provider = createEnvironmentCanadaProvider({
      fetch: vi.fn(async () => response(
        '<feed><entry><id>none</id><title>No alerts in effect</title></entry></feed>'
      )),
    });
    await expect(provider.fetchAlerts(canadaContext)).resolves.toMatchObject({
      complete: true,
      alerts: [],
    });
  });

  it('rejects malformed XML and unsafe source URLs before persistence', async () => {
    const malformed = createEnvironmentCanadaProvider({
      fetch: vi.fn(async () => response('<not-a-feed />')),
    });
    await expect(malformed.fetchAlerts(canadaContext)).rejects.toMatchObject({
      code: 'provider_contract',
    });

    const unsafe = createEnvironmentCanadaProvider({
      fetch: vi.fn(async () => response(
        '<feed><entry><id>x</id><title>Warning</title><link href="https://example.test/private" /></entry></feed>'
      )),
    });
    await expect(unsafe.fetchAlerts(canadaContext)).rejects.toMatchObject({
      code: 'provider_contract',
      retryable: false,
    });
  });
});
