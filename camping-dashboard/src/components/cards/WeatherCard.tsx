'use client';

import React, { useState } from 'react';
import type { AstroData, WeatherCurrent, WeatherRefreshState } from '@/types';
import { getSkyQuality } from '@/lib/helpers';
import { Card } from '@/components/ui/Primitives';
import { useTheme } from '@/lib/themeContext';
import { useTrip } from '@/lib/tripContext';
import {
    AlertCircle,
    CloudRain,
    Droplets,
    Eye,
    Star,
    Sunrise,
    Sunset,
    Wind,
} from 'lucide-react';

interface WeatherCardProps {
    tripId: string;
    weather: WeatherCurrent | null;
    weatherRefresh: WeatherRefreshState | null;
    astro: AstroData | null;
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

export default function WeatherCard({
    tripId,
    weather,
    weatherRefresh,
    astro,
}: WeatherCardProps) {
    const { labels } = useTheme();
    const { canEdit } = useTrip();
    const [refreshState, setRefreshState] = useState<RefreshState>('idle');
    const statusMessage = syncMessage(weather, weatherRefresh);

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

    const refreshControl = canEdit ? (
        <div className="mt-4 pt-4 border-t border-border-subtle">
            <button
                onClick={handleRefresh}
                disabled={refreshState === 'loading' || refreshState === 'success'}
                className="w-full text-xs font-mono px-3 py-2 rounded border border-border-subtle text-text-muted hover:text-text-main hover:bg-card-hover transition-colors flex justify-center items-center gap-2 disabled:opacity-60"
            >
                {refreshState === 'error' && (
                    <AlertCircle size={14} className="text-accent-red" />
                )}
                {refreshLabel[refreshState]}
            </button>
        </div>
    ) : null;

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
            <div className="flex items-center gap-4 mb-6">
                <Star size={48} className="text-accent-yellow fill-accent-yellow shrink-0" />
                <div>
                    <div className="text-4xl font-bold text-text-main tracking-tighter">
                        {Math.round(weather.temperature_c)}
                        <span className="text-2xl text-text-muted font-normal">°C</span>
                    </div>
                    <div className="text-sm text-text-muted font-mono">
                        {weather.condition_label}
                    </div>
                </div>
            </div>

            <div className="space-y-3 flex-1">
                {stats.map((stat) => (
                    <div
                        key={stat.label}
                        className="flex items-center justify-between py-2 border-b border-border-subtle/50 last:border-0"
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

                <div className="pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-accent-yellow text-sm">
                        <Star size={16} />
                        Sky Quality
                    </div>
                    <div className="text-right">
                        <div className="font-mono text-sm text-text-main font-medium">
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
                <p className="mt-4 text-xs text-text-muted">{statusMessage}</p>
            )}
            {refreshControl}
        </Card>
    );
}
