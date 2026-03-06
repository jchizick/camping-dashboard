// ============================================================
// Camping Dashboard — Derived Logic Helpers
// All computed values live here — never inline in JSX
// ============================================================

import type {
    CountdownResult,
    GearItem,
    Meal,
    OfflineStatus,
    TimelineEvent,
    WeatherCurrent,
    WeatherForecast,
    AstroData,
    ReadinessScore,
    ThemeMode,
    ThemeOverride,
} from '@/types';

// ─── Countdown ────────────────────────────────────────────
export function getTripCountdown(startDate: string): CountdownResult {
    const now = Date.now();
    const target = new Date(startDate).getTime();
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

// ─── Readiness Calculators ────────────────────────────────
export function calculateGearReadiness(gear: GearItem[]): number {
    if (gear.length === 0) return 0;
    const criticalItems = gear.filter((g) => g.priority === 'critical');
    const critical = criticalItems.length > 0
        ? criticalItems.filter((g) => g.packed).length / criticalItems.length
        : 1;
    const total = gear.filter((g) => g.packed).length / gear.length;
    // Weight critical items higher
    return Math.round((critical * 0.6 + total * 0.4) * 100);
}

export function calculateMealCompleteness(meals: Meal[], totalDays: number): number {
    if (totalDays === 0) return 0;
    const expectedMeals = totalDays * 3; // breakfast + lunch + dinner per day
    const plannedMeals = meals.filter(
        (m) => m.meal_type === 'breakfast' || m.meal_type === 'lunch' || m.meal_type === 'dinner'
    ).length;
    return Math.min(Math.round((plannedMeals / expectedMeals) * 100), 100);
}

export function calculateOfflineReadiness(status: OfflineStatus): number {
    const checks = [
        status.maps_cached,
        status.permit_saved,
        status.route_downloaded,
        status.satellite_device_connected,
        status.emergency_contact_ready,
    ];
    const passed = checks.filter(Boolean).length;
    return Math.round((passed / checks.length) * 100);
}

export function calculateTimelineCompleteness(
    events: TimelineEvent[],
    totalDays: number
): number {
    if (totalDays === 0) return 0;
    const expectedEventsPerDay = 4; // launch, paddle, camp, dinner (rough baseline)
    const expected = totalDays * expectedEventsPerDay;
    return Math.min(Math.round((events.length / expected) * 100), 100);
}

export function calculateWeatherPreparedness(
    weather: WeatherCurrent,
    forecast: WeatherForecast[]
): number {
    let score = 100;
    // Penalise for high rain chance in forecast
    const maxRain = Math.max(weather.rain_chance, ...forecast.map((f) => f.rain_chance));
    if (maxRain > 70) score -= 30;
    else if (maxRain > 40) score -= 15;
    // Penalise for high wind
    const maxWind = Math.max(weather.wind_kph, ...forecast.map((f) => f.wind_kph));
    if (maxWind > 40) score -= 20;
    else if (maxWind > 25) score -= 10;
    return Math.max(score, 0);
}

// ─── Overall Readiness ────────────────────────────────────
const READINESS_WEIGHTS = {
    gear: 0.35,
    meals: 0.20,
    weather: 0.15,
    offline: 0.20,
    timeline: 0.10,
};

export function getReadinessLabel(score: number): string {
    if (score >= 90) return 'Locked In';
    if (score >= 75) return 'Nearly Ready';
    if (score >= 50) return 'Needs Attention';
    return 'Not Ready';
}

export function calculateOverallReadiness(scores: {
    gear: number;
    meals: number;
    weather: number;
    offline: number;
    timeline: number;
}): ReadinessScore {
    const overall = Math.round(
        scores.gear * READINESS_WEIGHTS.gear +
        scores.meals * READINESS_WEIGHTS.meals +
        scores.weather * READINESS_WEIGHTS.weather +
        scores.offline * READINESS_WEIGHTS.offline +
        scores.timeline * READINESS_WEIGHTS.timeline
    );
    return {
        overall,
        label: getReadinessLabel(overall),
        ...scores,
    };
}

// ─── Astro Helpers ────────────────────────────────────────
export function getSkyQuality(weather: WeatherCurrent, astro: AstroData): string {
    if (weather.rain_chance > 60) return 'Poor — Overcast';
    if (weather.rain_chance > 30) return 'Fair — Partly Cloudy';
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

export function getTripDays(startDate: string, endDate: string): number {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return Math.ceil((end - start) / 86400000) + 1;
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
