// ============================================================
// weatherMapper.ts — Open-Meteo response → Supabase schema
// Maps raw forecast API data to weather_current + weather_forecast rows
// Source: https://open-meteo.com/en/docs
// ============================================================

// ─── Open-Meteo WMO Weather Codes ────────────────────────────────────────────
// https://open-meteo.com/en/docs#weathervariables
const WMO_LABELS: Record<number, string> = {
    0: 'Clear Sky',
    1: 'Mainly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Icy Fog',
    51: 'Light Drizzle',
    53: 'Moderate Drizzle',
    55: 'Dense Drizzle',
    61: 'Slight Rain',
    63: 'Moderate Rain',
    65: 'Heavy Rain',
    71: 'Slight Snow',
    73: 'Moderate Snow',
    75: 'Heavy Snow',
    77: 'Snow Grains',
    80: 'Light Showers',
    81: 'Moderate Showers',
    82: 'Heavy Showers',
    85: 'Snow Showers',
    86: 'Heavy Snow Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm w/ Hail',
    99: 'Thunderstorm w/ Heavy Hail',
};

const WMO_ICONS: Record<number, string> = {
    0: '☀️',
    1: '🌤',
    2: '⛅',
    3: '☁️',
    45: '🌫',
    48: '🌫',
    51: '🌦',
    53: '🌦',
    55: '🌧',
    61: '🌧',
    63: '🌧',
    65: '🌧',
    71: '❄️',
    73: '❄️',
    75: '❄️',
    77: '🌨',
    80: '🌦',
    81: '🌧',
    82: '🌧',
    85: '🌨',
    86: '🌨',
    95: '⛈',
    96: '⛈',
    99: '⛈',
};

function wmoLabel(code: number): string {
    return WMO_LABELS[code] ?? 'Unknown';
}

function wmoIcon(code: number): string {
    return WMO_ICONS[code] ?? '🌡';
}

// ─── Types returned by this mapper ───────────────────────────────────────────

export interface MappedWeatherCurrent {
    trip_id: string;
    temperature_c: number;
    wind_kph: number;
    humidity: number;
    rain_chance: number;
    sunrise_time: string;  // "HH:MM"
    sunset_time: string;   // "HH:MM"
    visibility: number;
    moonset_time: string;
    condition_label: string;
    icon: string;
    updated_at: string;
}

export interface MappedWeatherForecast {
    id: string;         // deterministic: "<tripId>-<forecast_date>"
    trip_id: string;
    forecast_date: string; // "YYYY-MM-DD"
    high_c: number;
    low_c: number;
    condition_label: string;
    rain_chance: number;
    wind_kph: number;
    icon: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract "HH:MM" from a full ISO datetime string */
function toHHMM(isoString: string | undefined): string {
    if (!isoString) return '--:--';
    // Open-Meteo returns "2026-05-15T05:32" format
    const timePart = isoString.split('T')[1];
    if (!timePart) return '--:--';
    return timePart.slice(0, 5);
}

// ─── Main mapping function ────────────────────────────────────────────────────

export interface OpenMeteoResponse {
    current: {
        time: string;
        temperature_2m: number;
        relative_humidity_2m: number;
        wind_speed_10m: number;
        weather_code: number;
        precipitation_probability: number;
        visibility: number;
    };
    daily: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: number[];
        wind_speed_10m_max: number[];
        sunrise: string[];
        sunset: string[];
        // moonrise / moonset not available from Open-Meteo
    };
}

export function mapOpenMeteoToSupabase(
    raw: OpenMeteoResponse,
    tripId: string,
    days: number
): {
    current: MappedWeatherCurrent;
    forecasts: MappedWeatherForecast[];
} {
    const now = new Date().toISOString();

    // ── Current conditions (from the `current` block) ─────────────────────
    const current: MappedWeatherCurrent = {
        trip_id: tripId,
        temperature_c: Math.round(raw.current.temperature_2m * 10) / 10,
        wind_kph: Math.round(raw.current.wind_speed_10m * 10) / 10,
        humidity: Math.round(raw.current.relative_humidity_2m),
        rain_chance: Math.round(raw.current.precipitation_probability ?? 0),
        // Sunrise/sunset come from today's daily entry (index 0)
        sunrise_time: toHHMM(raw.daily.sunrise[0]),
        sunset_time: toHHMM(raw.daily.sunset[0]),
        // moonset is not available from Open-Meteo — preserve existing DB values by writing '--:--'
        moonset_time: '--:--',
        visibility: raw.current.visibility,
        condition_label: wmoLabel(raw.current.weather_code),
        icon: wmoIcon(raw.current.weather_code),
        updated_at: now,
    };

    // ── Daily forecast (cap at requested days) ─────────────────────────────
    const sliceCount = Math.min(days, raw.daily.time.length);
    const forecasts: MappedWeatherForecast[] = raw.daily.time
        .slice(0, sliceCount)
        .map((date, i) => ({
            id: `${tripId}-${date}`,  // deterministic, safe to re-insert
            trip_id: tripId,
            forecast_date: date,
            high_c: Math.round(raw.daily.temperature_2m_max[i] * 10) / 10,
            low_c: Math.round(raw.daily.temperature_2m_min[i] * 10) / 10,
            condition_label: wmoLabel(raw.daily.weather_code[i]),
            rain_chance: Math.round(raw.daily.precipitation_probability_max[i] ?? 0),
            wind_kph: Math.round(raw.daily.wind_speed_10m_max[i] * 10) / 10,
            icon: wmoIcon(raw.daily.weather_code[i]),
        }));

    return { current, forecasts };
}
