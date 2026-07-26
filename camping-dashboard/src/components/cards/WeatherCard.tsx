'use client';

import React, { useState, useSyncExternalStore } from 'react';
import type { WeatherCurrent, AstroData } from '@/types';
import { getSkyQuality } from '@/lib/helpers';
import { Card } from '@/components/ui/Primitives';
import { useTheme } from '@/lib/themeContext';
import { CloudRain, Star, Wind, Droplets, Sunrise, Sunset, Eye, AlertCircle } from 'lucide-react';

interface WeatherCardProps {
    tripId: string;
    weather: WeatherCurrent | null;
    astro: AstroData | null;
}

type RefreshState = 'idle' | 'loading' | 'success' | 'error';

const subscribeToLocation = () => () => {};
const getLocationSnapshot = () => new URLSearchParams(window.location.search).get('dev') === 'true';
const getServerLocationSnapshot = () => false;

export default function WeatherCard({ tripId, weather, astro }: WeatherCardProps) {
    const { labels } = useTheme();
    // ── Dev-mode refresh button ──
    const isDevMode = useSyncExternalStore(
        subscribeToLocation,
        getLocationSnapshot,
        getServerLocationSnapshot
    );
    const [refreshState, setRefreshState] = useState<RefreshState>('idle');
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    if (!weather) {
        return (
            <Card title={labels.weather} icon={CloudRain} className="h-full">
                <div className="min-h-48 flex items-center justify-center text-center text-sm text-text-muted">
                    Weather has not been refreshed for this campsite yet.
                </div>
                {isDevMode && (
                    <div className="mt-4 pt-4 border-t border-border-subtle">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshState === 'loading'}
                            className="w-full text-xs font-mono px-3 py-2 rounded border border-border-subtle text-text-muted hover:text-text-main hover:bg-card-hover transition-colors flex justify-center items-center gap-2"
                        >
                            {refreshState === 'error' && <AlertCircle size={14} className="text-accent-red" />}
                            {refreshState === 'loading'
                                ? 'Fetching…'
                                : refreshState === 'error'
                                    ? 'Refresh failed — try again'
                                    : 'Refresh Weather'}
                        </button>
                    </div>
                )}
            </Card>
        );
    }

    const skyQualityStr = astro ? getSkyQuality(weather, astro) : 'Unavailable';
    const [skyQuality, skyQualityDesc] = skyQualityStr.split(' — ').length > 1 ? skyQualityStr.split(' — ') : [skyQualityStr, ''];

    async function handleRefresh() {
        if (refreshState === 'loading') return;

        setRefreshState('loading');
        try {
            const secret = process.env.NEXT_PUBLIC_WEATHER_REFRESH_SECRET ?? '';
            const params = new URLSearchParams({ secret, trip_id: tripId });
            const res = await fetch(`/api/refresh-weather?${params.toString()}`);
            const json = await res.json();

            if (!res.ok || !json.ok) {
                console.error('[WeatherCard] Refresh failed:', json);
                setRefreshState('error');
            } else {
                setRefreshState('success');
                setLastUpdated(
                    new Date(json.updated_at).toLocaleTimeString('en-CA', {
                        hour: '2-digit',
                        minute: '2-digit',
                    })
                );
                setTimeout(() => window.location.reload(), 1200);
            }
        } catch (err) {
            console.error('[WeatherCard] Refresh threw:', err);
            setRefreshState('error');
        }

        if (refreshState !== 'success') {
            setTimeout(() => setRefreshState('idle'), 4000);
        }
    }

    const refreshLabel: Record<RefreshState, string> = {
        idle: '⟳ Refresh Weather',
        loading: 'Fetching…',
        success: lastUpdated ? `✓ Updated ${lastUpdated}` : '✓ Updated',
        error: '✗ Refresh Failed',
    };

    return (
        <Card title={labels.weather} icon={CloudRain} className="h-full">
            <div className="flex items-center gap-4 mb-6">
                <Star size={48} className="text-accent-yellow fill-accent-yellow shrink-0" />
                <div>
                    <div className="text-4xl font-bold text-text-main tracking-tighter">
                        {Math.round(weather.temperature_c)}<span className="text-2xl text-text-muted font-normal">°C</span>
                    </div>
                    <div className="text-sm text-text-muted font-mono">{weather.condition_label}</div>
                </div>
            </div>
            
            <div className="space-y-3 flex-1">
                {[
                    { icon: Wind, label: 'Wind', value: weather.wind_kph.toString(), unit: 'km/h' },
                    { icon: Droplets, label: 'Humidity', value: weather.humidity.toString(), unit: '%' },
                    { icon: CloudRain, label: 'Rain Chance', value: weather.rain_chance.toString(), unit: '%' },
                    { icon: Sunrise, label: 'Sunrise', value: weather.sunrise_time, unit: '' },
                    { icon: Sunset, label: 'Sunset', value: weather.sunset_time, unit: '' },
                    { 
                        icon: Eye, 
                        label: 'Visibility', 
                        value: typeof weather.visibility === 'number' && weather.visibility >= 1000 ? (weather.visibility / 1000).toFixed(1) : (weather.visibility ?? '--').toString(), 
                        unit: typeof weather.visibility === 'number' && weather.visibility >= 1000 ? "km" : typeof weather.visibility === 'number' ? "m" : ""
                    },
                ].map((stat, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border-subtle/50 last:border-0">
                        <div className="flex items-center gap-3 text-text-muted text-sm">
                            <stat.icon size={16} />
                            {stat.label}
                        </div>
                        <div className="font-mono text-sm">
                            <span className="text-text-main font-medium">{stat.value}</span>
                            <span className="text-text-muted text-xs ml-1">{stat.unit}</span>
                        </div>
                    </div>
                ))}
                
                <div className="pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-accent-yellow text-sm">
                        <Star size={16} />
                        Sky Quality
                    </div>
                    <div className="text-right">
                        <div className="font-mono text-sm text-text-main font-medium">{skyQuality}</div>
                        {skyQualityDesc && <div className="text-xs text-text-muted">{skyQualityDesc}</div>}
                    </div>
                </div>
            </div>

            {isDevMode && (
                <div className="mt-4 pt-4 border-t border-border-subtle">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshState === 'loading'}
                        className="w-full text-xs font-mono px-3 py-2 rounded border border-border-subtle text-text-muted hover:text-text-main hover:bg-card-hover transition-colors flex justify-center items-center gap-2"
                    >
                        {refreshState === 'error' && <AlertCircle size={14} className="text-accent-red" />}
                        {refreshLabel[refreshState]}
                    </button>
                </div>
            )}
        </Card>
    );
}
