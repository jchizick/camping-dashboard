export type WeatherLocation = {
  latitude: number;
  longitude: number;
  timezone?: string | null;
};

export type NormalizedCurrentWeather = {
  temperatureC: number;
  weatherCode: number;
  conditionLabel: string;
  icon: string;
  windKph: number | null;
  humidity: number | null;
  rainChance: number | null;
  sunriseTime: string | null;
  sunsetTime: string | null;
  visibilityMeters: number | null;
};

export type NormalizedDailyForecast = {
  forecast_date: string;
  high_c: number | null;
  low_c: number | null;
  condition_label: string;
  rain_chance: number | null;
  wind_kph: number | null;
  icon: string;
};

export type NormalizedWeatherPayload = {
  provider: 'open-meteo';
  requestedAt: string;
  providerGeneratedAt: null;
  sourceObservedAt: string;
  timezone: string;
  utcOffsetSeconds: number | null;
  requestFingerprint: string;
  current: NormalizedCurrentWeather;
  daily: NormalizedDailyForecast[];
  fingerprint: string;
};

export interface WeatherProvider {
  fetchWeather(location: WeatherLocation): Promise<NormalizedWeatherPayload>;
}

export type WeatherProviderErrorCode =
  | 'provider_timeout'
  | 'provider_network'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'provider_rejected'
  | 'provider_contract';

export class WeatherProviderError extends Error {
  constructor(
    readonly code: WeatherProviderErrorCode,
    readonly retryable: boolean,
    message: string
  ) {
    super(message);
    this.name = 'WeatherProviderError';
  }
}

type OpenMeteoResponse = {
  timezone?: unknown;
  utc_offset_seconds?: unknown;
  current?: {
    time?: unknown;
    temperature_2m?: unknown;
    relative_humidity_2m?: unknown;
    wind_speed_10m?: unknown;
    weather_code?: unknown;
    precipitation_probability?: unknown;
    visibility?: unknown;
  };
  daily?: {
    time?: unknown;
    weather_code?: unknown;
    temperature_2m_max?: unknown;
    temperature_2m_min?: unknown;
    precipitation_probability_max?: unknown;
    wind_speed_10m_max?: unknown;
    sunrise?: unknown;
    sunset?: unknown;
  };
};

const LABELS: Record<number, string> = {
  0: 'Clear Sky',
  1: 'Mainly Clear',
  2: 'Partly Cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Rime Fog',
  51: 'Light Drizzle',
  53: 'Drizzle',
  55: 'Heavy Drizzle',
  61: 'Light Rain',
  63: 'Rain',
  65: 'Heavy Rain',
  71: 'Light Snow',
  73: 'Snow',
  75: 'Heavy Snow',
  80: 'Rain Showers',
  81: 'Rain Showers',
  82: 'Heavy Showers',
  85: 'Snow Showers',
  86: 'Heavy Snow Showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with Hail',
  99: 'Severe Thunderstorm',
};

function weatherLabel(code: number): string {
  return LABELS[code] ?? 'Unknown';
}

function weatherIcon(code: number): string {
  if (code === 0) return 'sun';
  if (code <= 2) return 'cloud-sun';
  if (code === 3 || code === 45 || code === 48) return 'cloud';
  if (code >= 71 && code <= 86) return 'snowflake';
  if (code >= 95) return 'cloud-lightning';
  return 'cloud-rain';
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WeatherProviderError(
      'provider_contract',
      false,
      `Provider response is missing required ${field}.`
    );
  }
  return value;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new WeatherProviderError(
      'provider_contract',
      false,
      `Provider response is missing required ${field}.`
    );
  }
  return value;
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new WeatherProviderError(
      'provider_contract',
      false,
      `Provider response has invalid ${field}.`
    );
  }
  return value as string[];
}

function numberArray(value: unknown, field: string): Array<number | null> {
  if (
    !Array.isArray(value)
    || value.some((item) => item !== null && (typeof item !== 'number' || !Number.isFinite(item)))
  ) {
    throw new WeatherProviderError(
      'provider_contract',
      false,
      `Provider response has invalid ${field}.`
    );
  }
  return value as Array<number | null>;
}

function round(value: number | null, digits = 0): number | null {
  if (value === null) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function timePart(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? null;
}

function providerLocalTimeToUtc(value: string, utcOffsetSeconds: number | null): string {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)
    || utcOffsetSeconds === null
  ) {
    throw new WeatherProviderError(
      'provider_contract',
      false,
      'Provider response has an invalid source timestamp.'
    );
  }
  const localAsUtc = Date.parse(`${value}Z`);
  if (!Number.isFinite(localAsUtc)) {
    throw new WeatherProviderError(
      'provider_contract',
      false,
      'Provider response has an invalid source timestamp.'
    );
  }
  return new Date(localAsUtc - utcOffsetSeconds * 1000).toISOString();
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

export async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function buildOpenMeteoUrl(location: WeatherLocation): URL {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  const parameters: Array<[string, string]> = [
    ['latitude', String(location.latitude)],
    ['longitude', String(location.longitude)],
    ['timezone', 'auto'],
    ['forecast_days', '5'],
    ['temperature_unit', 'celsius'],
    ['wind_speed_unit', 'kmh'],
    ['precipitation_unit', 'mm'],
    [
      'current',
      [
        'temperature_2m',
        'relative_humidity_2m',
        'wind_speed_10m',
        'weather_code',
        'precipitation_probability',
        'visibility',
      ].join(','),
    ],
    [
      'daily',
      [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
        'wind_speed_10m_max',
        'sunrise',
        'sunset',
      ].join(','),
    ],
  ];
  for (const [key, value] of parameters) url.searchParams.set(key, value);
  return url;
}

export function createOpenMeteoProvider(options?: {
  fetch?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}): WeatherProvider {
  const fetchImpl = options?.fetch ?? fetch;
  const now = options?.now ?? (() => new Date());
  const timeoutMs = options?.timeoutMs ?? 9_000;

  return {
    async fetchWeather(location) {
      if (
        !Number.isFinite(location.latitude)
        || location.latitude < -90
        || location.latitude > 90
        || !Number.isFinite(location.longitude)
        || location.longitude < -180
        || location.longitude > 180
      ) {
        throw new WeatherProviderError(
          'provider_rejected',
          false,
          'Weather location is invalid.'
        );
      }

      const requestDescriptor = {
        provider: 'open-meteo',
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: 'auto',
        forecastDays: 5,
        units: { temperature: 'celsius', wind: 'kmh', precipitation: 'mm' },
      };
      const requestFingerprint = await sha256(requestDescriptor);
      const requestedAt = now().toISOString();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;

      try {
        response = await fetchImpl(buildOpenMeteoUrl(location), {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new WeatherProviderError(
            'provider_timeout',
            true,
            'Weather provider timed out.'
          );
        }
        throw new WeatherProviderError(
          'provider_network',
          true,
          'Weather provider could not be reached.'
        );
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        if (response.status === 429) {
          throw new WeatherProviderError(
            'provider_rate_limited',
            true,
            'Weather provider rate limit was reached.'
          );
        }
        if (response.status >= 500) {
          throw new WeatherProviderError(
            'provider_unavailable',
            true,
            'Weather provider is temporarily unavailable.'
          );
        }
        throw new WeatherProviderError(
          'provider_rejected',
          false,
          'Weather provider rejected the request.'
        );
      }

      let raw: OpenMeteoResponse;
      try {
        raw = await response.json() as OpenMeteoResponse;
      } catch {
        throw new WeatherProviderError(
          'provider_contract',
          false,
          'Weather provider returned invalid JSON.'
        );
      }

      const timezone = stringValue(raw.timezone, 'timezone');
      const currentTime = stringValue(raw.current?.time, 'current time');
      const utcOffsetSeconds = optionalNumber(raw.utc_offset_seconds);
      const sourceObservedAt = providerLocalTimeToUtc(currentTime, utcOffsetSeconds);
      const weatherCode = finiteNumber(raw.current?.weather_code, 'weather code');
      const dates = stringArray(raw.daily?.time, 'daily dates');
      const codes = numberArray(raw.daily?.weather_code, 'daily weather codes');
      const highs = numberArray(raw.daily?.temperature_2m_max, 'daily highs');
      const lows = numberArray(raw.daily?.temperature_2m_min, 'daily lows');
      const rain = numberArray(
        raw.daily?.precipitation_probability_max,
        'daily precipitation probability'
      );
      const wind = numberArray(raw.daily?.wind_speed_10m_max, 'daily wind');
      const sunrise = stringArray(raw.daily?.sunrise, 'daily sunrise');
      const sunset = stringArray(raw.daily?.sunset, 'daily sunset');
      const lengths = [
        dates.length,
        codes.length,
        highs.length,
        lows.length,
        rain.length,
        wind.length,
        sunrise.length,
        sunset.length,
      ];
      if (
        dates.length !== 5
        || lengths.some((length) => length !== dates.length)
        || dates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date))
        || codes.some((code) => code === null)
        || new Set(dates).size !== dates.length
        || dates.some((date, index) => {
          if (index === 0) return false;
          const previous = new Date(`${dates[index - 1]}T00:00:00Z`);
          previous.setUTCDate(previous.getUTCDate() + 1);
          return previous.toISOString().slice(0, 10) !== date;
        })
      ) {
        throw new WeatherProviderError(
          'provider_contract',
          false,
          'Weather provider daily arrays are not aligned.'
        );
      }

      const current: NormalizedCurrentWeather = {
        temperatureC: finiteNumber(raw.current?.temperature_2m, 'temperature'),
        weatherCode,
        conditionLabel: weatherLabel(weatherCode),
        icon: weatherIcon(weatherCode),
        windKph: round(optionalNumber(raw.current?.wind_speed_10m), 1),
        humidity: round(optionalNumber(raw.current?.relative_humidity_2m)),
        rainChance: round(optionalNumber(raw.current?.precipitation_probability)),
        sunriseTime: timePart(sunrise[0]),
        sunsetTime: timePart(sunset[0]),
        visibilityMeters: round(optionalNumber(raw.current?.visibility)),
      };
      const daily = dates.map((forecastDate, index) => {
        const code = codes[index] as number;
        return {
          forecast_date: forecastDate,
          high_c: round(highs[index], 1),
          low_c: round(lows[index], 1),
          condition_label: weatherLabel(code),
          rain_chance: round(rain[index]),
          wind_kph: round(wind[index], 1),
          icon: weatherIcon(code),
        };
      });
      const fingerprintSource = {
        provider: 'open-meteo',
        sourceObservedAt,
        timezone,
        utcOffsetSeconds,
        current,
        daily,
      };

      return {
        provider: 'open-meteo',
        requestedAt,
        providerGeneratedAt: null,
        sourceObservedAt,
        timezone,
        utcOffsetSeconds,
        requestFingerprint,
        current,
        daily,
        fingerprint: await sha256(fingerprintSource),
      };
    },
  };
}
