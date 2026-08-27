// ============================================================
// Camping Dashboard — Derived Logic Helpers
// All computed values live here — never inline in JSX
// ============================================================

import type {
    CountdownResult,
    WeatherCurrent,
    AstroData,
    ThemeMode,
    ThemeOverride,
} from '@/types';

// ─── Countdown ────────────────────────────────────────────
export function getTripCountdown(startDate: string): CountdownResult {
    const now = Date.now();
    // Append T12:00:00 to avoid UTC-midnight parsing (which would be prev-day in EDT/EST).
    // Targeting local noon ensures the countdown reflects the correct calendar date.
    const target = new Date(`${startDate}T12:00:00`).getTime();
    const diff = target - now;

    if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, isPast: true };
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { days, hours, minutes, seconds, totalSeconds, isPast: false };
}

// ─── Theme ────────────────────────────────────────────────
export function getThemeModeFromTime(
    currentHour: number,
    sunriseHour: number,
    sunsetHour: number,
    override: ThemeOverride
): ThemeMode {
    if (override === 'day') return 'day';
    if (override === 'night') return 'night';
    // Auto: day between sunrise+30min and sunset-30min
    const isDaytime = currentHour >= sunriseHour && currentHour < sunsetHour;
    return isDaytime ? 'day' : 'night';
}

export interface EstimatedGearWeight {
    totalKg: number;
    knownItemCount: number;
    unknownItemCount: number;
}

type WeightedGearItem = {
    weight_kg: number | null | undefined;
};

export function calculateEstimatedGearWeight(
    gear: readonly WeightedGearItem[]
): EstimatedGearWeight {
    return gear.reduce<EstimatedGearWeight>(
        (estimate, item) => {
            const weight = item.weight_kg;
            if (typeof weight === 'number' && Number.isFinite(weight) && weight > 0) {
                estimate.totalKg += weight;
                estimate.knownItemCount += 1;
            } else {
                estimate.unknownItemCount += 1;
            }
            return estimate;
        },
        { totalKg: 0, knownItemCount: 0, unknownItemCount: 0 }
    );
}

export function formatEstimatedGearWeight(estimate: EstimatedGearWeight): string {
    if (estimate.knownItemCount === 0) {
        return estimate.unknownItemCount === 0 ? '0 kg' : '—';
    }

    const roundedKg = Math.round((estimate.totalKg + Number.EPSILON) * 10) / 10;
    const formattedKg = Number.isInteger(roundedKg)
        ? roundedKg.toFixed(0)
        : roundedKg.toFixed(1);
    const approximation = estimate.unknownItemCount > 0 ? '~' : '';

    return `${approximation}${formattedKg} kg`;
}

// ─── Astro Helpers ────────────────────────────────────────
export function getSkyQuality(weather: WeatherCurrent | null, astro: AstroData): string {
    if (!weather) return 'Unavailable';
    if (weather.rain_chance !== null && weather.rain_chance > 60) return 'Poor — Overcast';
    if (weather.rain_chance !== null && weather.rain_chance > 30) return 'Fair — Partly Cloudy';
    if (astro.moon_illumination > 80) return 'Good — Bright Moon';
    if (astro.moon_illumination > 50) return 'Good — Moon Affects Faint Objects';
    return 'Excellent — Dark Skies';
}

export function getHeadlampTime(astro: AstroData): string {
    return astro.blue_hour_end || astro.golden_hour_end || '21:30';
}

export function getGoldenHourLabel(astro: AstroData): string {
    if (!astro.golden_hour_start || !astro.golden_hour_end) return 'N/A';
    return `${astro.golden_hour_start} – ${astro.golden_hour_end}`;
}

// ─── Formatting Utilities ─────────────────────────────────
export function formatTripDates(startDate: string, endDate: string): string {
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const start = new Date(startDate).toLocaleDateString('en-CA', opts);
    const end = new Date(endDate).toLocaleDateString('en-CA', {
        ...opts,
        year: 'numeric',
    });
    return `${start} – ${end}`;
}

export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return items.reduce<Record<string, T[]>>((acc, item) => {
        const key = keyFn(item);
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});
}

export function padTwo(n: number): string {
    return String(n).padStart(2, '0');
}
