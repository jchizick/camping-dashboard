export type AlertProviderName = 'ontario-parks' | 'environment-canada';
export type AlertSeverity = 'info' | 'advisory' | 'watch' | 'warning' | 'critical';
export type AlertStatus = 'active' | 'updated' | 'cancelled';

export type TripAlertContext = {
  tripId: string;
  countryCode: string | null;
  regionCode: string | null;
  provider: AlertProviderName;
  providerExternalId: string;
};

export type NormalizedTripAlert = {
  provider: AlertProviderName;
  externalId: string;
  category: string;
  severity: AlertSeverity;
  title: string;
  summary: string | null;
  details: string | null;
  sourceUrl: string | null;
  issuedAt: string | null;
  effectiveAt: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
  status: AlertStatus;
  fingerprint: string;
};

export type AlertProviderResult = {
  provider: AlertProviderName;
  fetchedAt: string;
  alerts: NormalizedTripAlert[];
  fingerprint: string;
  complete: true;
};

export interface TripAlertProvider {
  readonly name: AlertProviderName;
  supports(context: TripAlertContext): boolean;
  fetchAlerts(context: TripAlertContext): Promise<AlertProviderResult>;
}

export type AlertProviderErrorCode =
  | 'provider_timeout'
  | 'provider_network'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'provider_rejected'
  | 'provider_contract'
  | 'invalid_provider_configuration';

export class AlertProviderError extends Error {
  constructor(
    readonly code: AlertProviderErrorCode,
    readonly retryable: boolean,
    message: string
  ) {
    super(message);
    this.name = 'AlertProviderError';
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function alertSha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function validTimestamp(value: string | null): string | null {
  if (!value) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

function validateSourceUrl(raw: string | null, allowedHosts: string[]): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname)) {
      throw new Error('invalid');
    }
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    throw new AlertProviderError(
      'provider_contract',
      false,
      'Alert provider returned an invalid source URL.'
    );
  }
}

function severityFromText(value: string): AlertSeverity {
  const text = value.toLowerCase();
  if (text.includes('emergency') || text.includes('extreme')) return 'critical';
  if (text.includes('warning') || text.includes('closure')) return 'warning';
  if (text.includes('watch')) return 'watch';
  if (text.includes('advisory') || text.includes('statement')) return 'advisory';
  return 'info';
}

async function fetchText(
  fetchImpl: typeof fetch,
  url: URL,
  timeoutMs: number,
  accept: string
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        Accept: accept,
        'User-Agent': 'FieldProtocolAlerts/1.0 (+https://www.fieldprotocol.online)',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AlertProviderError('provider_timeout', true, 'Alert provider timed out.');
    }
    throw new AlertProviderError('provider_network', true, 'Alert provider could not be reached.');
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 429) {
    throw new AlertProviderError('provider_rate_limited', true, 'Alert provider rate limit was reached.');
  }
  if (response.status >= 500) {
    throw new AlertProviderError('provider_unavailable', true, 'Alert provider is temporarily unavailable.');
  }
  if (!response.ok) {
    throw new AlertProviderError('provider_rejected', false, 'Alert provider rejected the request.');
  }
  return response.text();
}

function tag(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<(?:atom:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:atom:)?${name}>`, 'i'));
  return match ? decode(match[1]) : null;
}

function linkHref(xml: string): string | null {
  const match = xml.match(/<(?:atom:)?link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return match?.[1] ?? null;
}

async function finalizeAlert(
  alert: Omit<NormalizedTripAlert, 'fingerprint'>
): Promise<NormalizedTripAlert> {
  return { ...alert, fingerprint: await alertSha256(alert) };
}

export function createOntarioParksProvider(options?: {
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}): TripAlertProvider {
  const fetchImpl = options?.fetch ?? fetch;
  const now = options?.now ?? (() => new Date());
  const timeoutMs = options?.timeoutMs ?? 10_000;
  return {
    name: 'ontario-parks',
    supports(context) {
      return context.countryCode === 'CA'
        && context.regionCode === 'ON'
        && /^[a-z0-9-]+\/[a-z0-9-]+$/i.test(context.providerExternalId);
    },
    async fetchAlerts(context) {
      if (!this.supports(context)) {
        throw new AlertProviderError(
          'invalid_provider_configuration',
          false,
          'Ontario Parks alert configuration is unsupported.'
        );
      }
      const [parkSlug, section] = context.providerExternalId.split('/');
      const url = new URL(`https://www.ontarioparks.ca/park/${parkSlug}/${section}/alerts`);
      const html = await fetchText(fetchImpl, url, timeoutMs, 'text/html');
      const fetchedAt = now().toISOString();
      const alertSection = html.match(
        /<section\b[^>]*id=["']alerts["'][^>]*>([\s\S]*?)<\/section>/i
      )?.[1];
      if (!alertSection) {
        throw new AlertProviderError(
          'provider_contract',
          true,
          'Ontario Parks page structure is not recognized.'
        );
      }
      if (/no active (?:alerts|advisories)|there are no (?:alerts|advisories)/i.test(decode(alertSection))) {
        return {
          provider: 'ontario-parks',
          fetchedAt,
          alerts: [],
          fingerprint: await alertSha256([]),
          complete: true,
        };
      }

      const blocks = alertSection
        .split(/<hr\b[^>]*>/gi)
        .filter((block) => /Park Notice/i.test(block))
        .map((block) => ['', '', block]);
      if (blocks.length === 0) {
        throw new AlertProviderError(
          'provider_contract',
          true,
          'Ontario Parks alert markup changed or is incomplete.'
        );
      }
      const alerts: NormalizedTripAlert[] = [];
      for (const block of blocks) {
        const text = decode(block[2]);
        if (!text) continue;
        const heading = block[2].match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
        const title = decode(heading?.[1] ?? text).slice(0, 300);
        const href = block[2].match(/href=["']([^"']+)["']/i)?.[1] ?? null;
        const absoluteHref = href ? new URL(href, url).toString() : url.toString();
        const externalId =
          `ontario-${(await alertSha256({ parkSlug, section, title })).slice(0, 32)}`;
        alerts.push(await finalizeAlert({
          provider: 'ontario-parks',
          externalId,
          category: /closure/i.test(text) ? 'closure' : 'park-advisory',
          severity: severityFromText(text),
          title,
          summary: text.slice(0, 1000),
          details: null,
          sourceUrl: validateSourceUrl(absoluteHref, ['www.ontarioparks.ca', 'ontarioparks.ca']),
          issuedAt: null,
          effectiveAt: null,
          expiresAt: null,
          updatedAt: null,
          status: /cancelled|resolved|ended/i.test(text) ? 'cancelled' : 'active',
        }));
      }
      const unique = [...new Map(alerts.map((alert) => [alert.externalId, alert])).values()];
      return {
        provider: 'ontario-parks',
        fetchedAt,
        alerts: unique,
        fingerprint: await alertSha256(unique),
        complete: true,
      };
    },
  };
}

export function createEnvironmentCanadaProvider(options?: {
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}): TripAlertProvider {
  const fetchImpl = options?.fetch ?? fetch;
  const now = options?.now ?? (() => new Date());
  const timeoutMs = options?.timeoutMs ?? 10_000;
  return {
    name: 'environment-canada',
    supports(context) {
      return context.countryCode === 'CA'
        && /^[a-z]{2,8}\d{1,5}$/i.test(context.providerExternalId);
    },
    async fetchAlerts(context) {
      if (!this.supports(context)) {
        throw new AlertProviderError(
          'invalid_provider_configuration',
          false,
          'Environment Canada alert configuration is unsupported.'
        );
      }
      const region = context.providerExternalId.toLowerCase();
      const url = new URL(`https://weather.gc.ca/rss/battleboard/${region}_e.xml`);
      const xml = await fetchText(fetchImpl, url, timeoutMs, 'application/atom+xml, application/xml');
      if (!/<(?:atom:)?feed\b/i.test(xml)) {
        throw new AlertProviderError(
          'provider_contract',
          true,
          'Environment Canada feed structure is not recognized.'
        );
      }
      const fetchedAt = now().toISOString();
      const entries = Array.from(xml.matchAll(/<(?:atom:)?entry\b[^>]*>([\s\S]*?)<\/(?:atom:)?entry>/gi));
      const alerts: NormalizedTripAlert[] = [];
      for (const entry of entries) {
        const body = entry[1];
        const title = tag(body, 'title');
        const summary = tag(body, 'summary');
        if (!title) {
          throw new AlertProviderError(
            'provider_contract',
            true,
            'Environment Canada entry is missing a title.'
          );
        }
        if (/no alerts in effect/i.test(`${title} ${summary ?? ''}`)) continue;
        const id = tag(body, 'id');
        const sourceUrl = validateSourceUrl(
          linkHref(body),
          ['weather.gc.ca', 'www.weather.gc.ca']
        );
        const externalId = id
          ? `ec-${(await alertSha256(id)).slice(0, 32)}`
          : `ec-${(await alertSha256({ region, title, issued: tag(body, 'published') })).slice(0, 32)}`;
        const status: AlertStatus = /cancelled|ended/i.test(`${title} ${summary ?? ''}`)
          ? 'cancelled'
          : /updated/i.test(title) ? 'updated' : 'active';
        alerts.push(await finalizeAlert({
          provider: 'environment-canada',
          externalId,
          category: 'weather-alert',
          severity: severityFromText(`${title} ${summary ?? ''}`),
          title: title.slice(0, 300),
          summary: summary?.slice(0, 1000) ?? null,
          details: null,
          sourceUrl,
          issuedAt: validTimestamp(tag(body, 'published')),
          effectiveAt: null,
          expiresAt: null,
          updatedAt: validTimestamp(tag(body, 'updated')),
          status,
        }));
      }
      const unique = [...new Map(alerts.map((alert) => [alert.externalId, alert])).values()];
      return {
        provider: 'environment-canada',
        fetchedAt,
        alerts: unique,
        fingerprint: await alertSha256(unique),
        complete: true,
      };
    },
  };
}

export function createAlertProviders(
  options?: Parameters<typeof createOntarioParksProvider>[0]
): Map<AlertProviderName, TripAlertProvider> {
  const providers = [
    createOntarioParksProvider(options),
    createEnvironmentCanadaProvider(options),
  ];
  return new Map(providers.map((provider) => [provider.name, provider]));
}
