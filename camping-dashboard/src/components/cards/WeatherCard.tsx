'use client';

import React, { useEffect, useState } from 'react';
import type {
    AstroData,
    WeatherCurrent,
    WeatherForecast,
    WeatherRefreshState,
} from '@/types';
import { getSkyQuality } from '@/lib/helpers';
import { getDaylightSummary, getDaylightWindow } from '@/lib/daylight';
import { Card } from '@/components/ui/Primitives';
import { useTheme } from '@/lib/themeContext';
import { useTrip } from '@/lib/tripContext';
import {
    AlertCircle,
    Check,
    Cloud,
    CloudDrizzle,
    CloudFog,
    CloudLightning,
    CloudRain,
    CloudSnow,
    CloudSun,
    Droplets,
    Eye,
    RefreshCw,
    Snowflake,
    Star,
    Sun,
    Sunrise,
    Sunset,
    Wind,
} from 'lucide-react';

interface WeatherCardProps {
    tripId: string;
    weather: WeatherCurrent | null;
    weatherRefresh: WeatherRefreshState | null;
    astro: AstroData | null;
    forecast?: WeatherForecast[];
    variant?: 'default' | 'home';
}

type RefreshState = 'idle' | 'loading' | 'success' | 'error';

function valueOrDash(value: number | string | null): string {
    return value === null ? '—' : String(value);
}

function syncMessage(
    weather: WeatherCurrent | null,
    state: WeatherRefreshState | null
): string | null {
    if (!state) return null;
    if (state.status === 'refreshing') return 'Refreshing weather…';
    if (state.status === 'retry') {
        return weather
            ? 'Stale weather shown; an automatic retry is scheduled.'
            : 'Weather is unavailable; an automatic retry is scheduled.';
    }
    if (state.status === 'failed') {
        return weather
            ? 'Stale weather shown; refresh needs attention.'
            : 'Weather is currently unavailable.';
    }
    if (state.source_observed_at) {
        const observedAt = new Date(state.source_observed_at);
        if (!Number.isNaN(observedAt.getTime())) {
            return `Observed ${observedAt.toLocaleString('en-CA', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            })}`;
        }
    }
    return null;
}

function operationalStatusMessage(
    weather: WeatherCurrent | null,
    state: WeatherRefreshState | null
): string | null {
    if (!state) return null;
    if (state.status === 'refreshing') return 'Refreshing weather…';
    if (state.status === 'retry') {
        return weather
            ? 'Stale weather shown; an automatic retry is scheduled.'
            : 'Weather is unavailable; an automatic retry is scheduled.';
    }
    if (state.status === 'failed') {
        return weather
            ? 'Stale weather shown; refresh needs attention.'
            : 'Weather is currently unavailable.';
    }
    return null;
}

function updatedTime(
    weather: WeatherCurrent | null,
    state: WeatherRefreshState | null
): string | null {
    const timestamp = state?.source_observed_at ?? weather?.updated_at;
    if (!timestamp) return null;

    const updatedAt = new Date(timestamp);
    if (Number.isNaN(updatedAt.getTime())) return null;

    return `Updated ${updatedAt.toLocaleTimeString('en-CA', {
        hour: 'numeric',
        minute: '2-digit',
    })}`;
}

function dayLabel(date: string): string {
    const parsed = new Date(`${date}T12:00:00`);
    return Number.isNaN(parsed.getTime())
        ? date
        : parsed.toLocaleDateString('en-CA', { weekday: 'short' });
}

interface WeatherGlyphProps {
    icon: string | null;
    condition: string;
    size: number;
    className: string;
}

function WeatherGlyph({
    icon,
    condition,
    size,
    className,
}: WeatherGlyphProps) {
    const normalizedIcon = icon?.toLowerCase() ?? '';
    const normalizedCondition = condition.toLowerCase();
    const iconProps = { size, className, 'aria-hidden': true as const };

    if (normalizedIcon.includes('lightning') || normalizedCondition.includes('thunder')) {
        return <CloudLightning {...iconProps} />;
    }
    if (normalizedIcon.includes('snow') || normalizedCondition.includes('snow')) {
        return normalizedIcon === 'snowflake'
            ? <Snowflake {...iconProps} />
            : <CloudSnow {...iconProps} />;
    }
    if (normalizedIcon.includes('drizzle') || normalizedCondition.includes('drizzle')) {
        return <CloudDrizzle {...iconProps} />;
    }
    if (
        normalizedIcon.includes('rain')
        || normalizedCondition.includes('rain')
        || normalizedCondition.includes('shower')
    ) {
        return <CloudRain {...iconProps} />;
    }
    if (normalizedIcon.includes('fog') || normalizedCondition.includes('fog')) {
        return <CloudFog {...iconProps} />;
    }
    if (normalizedIcon.includes('cloud-sun') || normalizedCondition.includes('partly')) {
        return <CloudSun {...iconProps} />;
    }
    if (normalizedIcon === 'cloud' || normalizedCondition.includes('overcast')) {
        return <Cloud {...iconProps} />;
    }
    return <Sun {...iconProps} />;
}

export default function WeatherCard({
    tripId,
    weather,
    weatherRefresh,
    astro,
    forecast = [],
    variant = 'default',
}: WeatherCardProps) {
    const { labels } = useTheme();
    const { canEdit } = useTrip();
    const [refreshState, setRefreshState] = useState<RefreshState>('idle');
    const [localNow, setLocalNow] = useState<Date | null>(null);
    const statusMessage = syncMessage(weather, weatherRefresh);

    useEffect(() => {
        if (variant !== 'home') return;

        const updateLocalTime = () => setLocalNow(new Date());
        updateLocalTime();
        const interval = window.setInterval(updateLocalTime, 60_000);
        return () => window.clearInterval(interval);
    }, [variant]);

    async function handleRefresh() {
        if (refreshState === 'loading') return;
        setRefreshState('loading');

        try {
            const result = await fetch('/api/refresh-weather', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tripId }),
            });
            if (!result.ok) {
                setRefreshState('error');
                return;
            }
            setRefreshState('success');
            window.setTimeout(() => window.location.reload(), 800);
        } catch {
            setRefreshState('error');
        }
    }

    const refreshLabel: Record<RefreshState, string> = {
        idle: 'Refresh Weather',
        loading: 'Fetching…',
        success: 'Updated',
        error: 'Refresh failed — try again',
    };

    const HeaderRefreshIcon = refreshState === 'success'
        ? Check
        : refreshState === 'error'
            ? AlertCircle
            : RefreshCw;
    const homeUpdatedTime = updatedTime(weather, weatherRefresh);
    const homeHeaderAction = variant === 'home' ? (
        <div className="home-weather-header-action">
            {homeUpdatedTime && (
                <span className="home-weather-updated">{homeUpdatedTime}</span>
            )}
            {canEdit && (
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshState === 'loading' || refreshState === 'success'}
                    className="home-weather-refresh"
                    aria-label={refreshLabel[refreshState]}
                    title={refreshLabel[refreshState]}
                >
                    <HeaderRefreshIcon
                        size={14}
                        aria-hidden="true"
                        className={refreshState === 'loading' ? 'animate-spin' : ''}
                    />
                </button>
            )}
        </div>
    ) : null;

    const refreshControl = canEdit ? (
        <div className="weather-refresh-control mt-4 border-t border-border-subtle pt-4">
            <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshState === 'loading' || refreshState === 'success'}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded border border-border-subtle px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-card-hover hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-60"
            >
                {refreshState === 'error' && (
                    <AlertCircle size={14} className="text-accent-red" />
                )}
                {refreshLabel[refreshState]}
            </button>
        </div>
    ) : null;

    if (variant === 'home') {
        const homeStatusMessage = operationalStatusMessage(weather, weatherRefresh);
        const daylightWindow = weather
            ? getDaylightWindow(weather.sunrise_time, weather.sunset_time)
            : null;
        const daylightSummary = weather && localNow
            ? getDaylightSummary(weather.sunrise_time, weather.sunset_time, localNow)
            : null;
        const homeStats = weather ? [
            { icon: Wind, label: 'Wind', value: valueOrDash(weather.wind_kph), unit: weather.wind_kph === null ? '' : 'km/h' },
            { icon: Droplets, label: 'Humidity', value: valueOrDash(weather.humidity), unit: weather.humidity === null ? '' : '%' },
            { icon: CloudRain, label: 'Rain Chance', value: valueOrDash(weather.rain_chance), unit: weather.rain_chance === null ? '' : '%' },
        ] : [];
        return (
            <Card
                title="Weather"
                icon={CloudRain}
                action={homeHeaderAction}
                className="home-weather-card"
            >
                <div className="home-weather-current">
                    {weather ? (
                        <>
                            <div className="home-weather-primary">
                                <WeatherGlyph
                                    icon={weather.icon}
                                    condition={weather.condition_label}
                                    size={34}
                                    className="home-weather-primary__icon"
                                />
                                <div className="min-w-0">
                                    <div className="home-weather-temperature">
                                        {Math.round(weather.temperature_c)}
                                        <span>°C</span>
                                    </div>
                                    <p className="home-weather-condition">
                                        {weather.condition_label}
                                    </p>
                                </div>
                            </div>
                            <div className="home-weather-stats">
                                {homeStats.map((stat) => (
                                    <div key={stat.label} className="home-weather-stat">
                                        <span className="home-weather-stat__label">
                                            <stat.icon size={13} aria-hidden="true" />
                                            {stat.label}
                                        </span>
                                        <span className="home-weather-stat__value">
                                            {stat.value}
                                            {stat.unit && <small>{stat.unit}</small>}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p className="home-weather-unavailable">
                            Weather has not been refreshed for this campsite yet.
                        </p>
                    )}
                </div>

                {homeStatusMessage && (
                    <p className="weather-current-status home-weather-status">
                        {homeStatusMessage}
                    </p>
                )}

                {daylightWindow && (
                    <div
                        className="home-weather-daylight"
                        data-daylight-state={daylightSummary?.state}
                    >
                        <div className="home-weather-daylight__heading">
                            <span>
                                <Sun size={11} aria-hidden="true" />
                                Daylight
                            </span>
                            <span className="home-weather-daylight__duration">
                                {daylightWindow.durationLabel}
                            </span>
                        </div>
                        <div
                            className="home-weather-daylight__track"
                            role="img"
                            aria-label={`Daylight from ${daylightWindow.sunriseLabel} to ${daylightWindow.sunsetLabel}; ${daylightWindow.durationLabel}`}
                        >
                            <span
                                className="home-weather-daylight__segment"
                                style={{
                                    left: `${daylightWindow.sunrisePercent}%`,
                                    width: `${daylightWindow.daylightPercent}%`,
                                }}
                            />
                            {daylightSummary && (
                                <span
                                    className="home-weather-daylight__marker"
                                    data-state={daylightSummary.state}
                                    style={{ left: `${daylightSummary.currentPercent}%` }}
                                    aria-hidden="true"
                                />
                            )}
                        </div>
                        <div className="home-weather-daylight__times">
                            <span>
                                <Sunrise size={11} aria-hidden="true" />
                                {daylightWindow.sunriseLabel}
                            </span>
                            <span>
                                {daylightWindow.sunsetLabel}
                                <Sunset size={11} aria-hidden="true" />
                            </span>
                        </div>
                    </div>
                )}

                <div className="home-weather-forecast">
                    <p className="home-weather-forecast__label">5-day forecast</p>
                    {forecast.length > 0 ? (
                        <div className="home-weather-forecast__days">
                            {forecast.slice(0, 5).map((day, index) => {
                                return (
                                    <div
                                        key={day.id}
                                        className={`home-weather-forecast-day ${
                                            index === 3
                                                ? 'hidden sm:flex'
                                                : index === 4
                                                    ? 'hidden lg:flex'
                                                    : 'flex'
                                        }`}
                                    >
                                        <p className="home-weather-forecast-day__name">
                                            {dayLabel(day.forecast_date)}
                                        </p>
                                        <WeatherGlyph
                                            icon={day.icon}
                                            condition={day.condition_label}
                                            size={21}
                                            className="home-weather-forecast-day__icon"
                                        />
                                        <p className="home-weather-forecast-day__temperature">
                                            <strong>
                                                {day.high_c === null
                                                    ? '—'
                                                    : `${Math.round(day.high_c)}°`}
                                            </strong>
                                            <span>
                                                / {day.low_c === null
                                                    ? '—'
                                                    : `${Math.round(day.low_c)}°`}
                                            </span>
                                        </p>
                                        <p className="home-weather-forecast-day__rain">
                                            <CloudRain size={11} aria-hidden="true" />
                                            {day.rain_chance === null
                                                ? '—'
                                                : `${day.rain_chance}%`}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="home-weather-forecast__empty">
                            Forecast unavailable.
                        </p>
                    )}
                </div>
            </Card>
        );
    }

    if (!weather) {
        return (
            <Card title={labels.weather} icon={CloudRain} className="h-full">
                <div className="min-h-48 flex items-center justify-center text-center text-sm text-text-muted">
                    Weather has not been refreshed for this campsite yet.
                </div>
                {statusMessage && (
                    <p className="text-xs text-text-muted text-center">{statusMessage}</p>
                )}
                {refreshControl}
            </Card>
        );
    }

    const skyQualityString = astro ? getSkyQuality(weather, astro) : 'Unavailable';
    const [skyQuality, skyQualityDescription = ''] = skyQualityString.split(' — ');
    const visibility = typeof weather.visibility === 'number'
        ? {
            value: weather.visibility >= 1000
                ? (weather.visibility / 1000).toFixed(1)
                : String(weather.visibility),
            unit: weather.visibility >= 1000 ? 'km' : 'm',
        }
        : { value: '—', unit: '' };
    const stats = [
        { icon: Wind, label: 'Wind', value: valueOrDash(weather.wind_kph), unit: weather.wind_kph === null ? '' : 'km/h' },
        { icon: Droplets, label: 'Humidity', value: valueOrDash(weather.humidity), unit: weather.humidity === null ? '' : '%' },
        { icon: CloudRain, label: 'Rain Chance', value: valueOrDash(weather.rain_chance), unit: weather.rain_chance === null ? '' : '%' },
        { icon: Sunrise, label: 'Sunrise', value: valueOrDash(weather.sunrise_time), unit: '' },
        { icon: Sunset, label: 'Sunset', value: valueOrDash(weather.sunset_time), unit: '' },
        { icon: Eye, label: 'Visibility', value: visibility.value, unit: visibility.unit },
    ];

    return (
        <Card title={labels.weather} icon={CloudRain} className="h-full">
            <div className="weather-current-summary mb-6 flex items-center gap-4">
                <Star
                    size={48}
                    className="shrink-0 fill-accent-yellow text-accent-yellow"
                />
                <div>
                    <div className="text-4xl font-bold tracking-tighter text-text-main">
                        {Math.round(weather.temperature_c)}
                        <span className="text-2xl text-text-muted font-normal">°C</span>
                    </div>
                    <div className="text-sm text-text-muted font-mono">
                        {weather.condition_label}
                    </div>
                </div>
            </div>

            <div className="weather-current-stats flex-1 space-y-3">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="flex items-center justify-between border-b border-border-subtle/50 py-2 last:border-0"
                    >
                        <div className="flex items-center gap-3 text-text-muted text-sm">
                            <stat.icon size={16} />
                            {stat.label}
                        </div>
                        <div className="font-mono text-sm">
                            <span className="text-text-main font-medium">{stat.value}</span>
                            {stat.unit && (
                                <span className="text-text-muted text-xs ml-1">{stat.unit}</span>
                            )}
                        </div>
                    </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-3 text-sm text-accent-yellow">
                        <Star size={16} />
                        Sky Quality
                    </div>
                    <div className="text-right">
                        <div className="font-mono text-sm font-medium text-text-main">
                            {skyQuality}
                        </div>
                        {skyQualityDescription && (
                            <div className="text-xs text-text-muted">
                                {skyQualityDescription}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {statusMessage && (
                <p className="weather-current-status mt-4 text-xs text-text-muted">
                    {statusMessage}
                </p>
            )}
            {refreshControl}
        </Card>
    );
}
