'use client';

import React, { useState, useEffect } from 'react';
import type { WeatherCurrent, AstroData } from '@/types';
import { getSkyQuality } from '@/lib/helpers';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import MetricRow from '@/components/ui/MetricRow';

interface WeatherCardProps {
    weather: WeatherCurrent;
    astro: AstroData;
}

type RefreshState = 'idle' | 'loading' | 'success' | 'error';

export default function WeatherCard({ weather, astro }: WeatherCardProps) {
    const skyQuality = getSkyQuality(weather, astro);

    // ── Dev-mode refresh button ──────────────────────────────────────────────
    const [isDevMode, setIsDevMode] = useState(false);
    const [refreshState, setRefreshState] = useState<RefreshState>('idle');
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            setIsDevMode(params.get('dev') === 'true');
        }
    }, []);

    async function handleRefresh() {
        if (refreshState === 'loading') return;

        setRefreshState('loading');
        try {
            const secret = process.env.NEXT_PUBLIC_WEATHER_REFRESH_SECRET ?? '';
            const res = await fetch(`/api/refresh-weather?secret=${encodeURIComponent(secret)}`);
            const json = await res.json();

            if (!res.ok || !json.ok) {
                console.error('[WeatherCard] Refresh failed:', json);
                setRefreshState('error');
            } else {
                setRefreshState('success');
                // Show a friendly timestamp
                setLastUpdated(
                    new Date(json.updated_at).toLocaleTimeString('en-CA', {
                        hour: '2-digit',
                        minute: '2-digit',
                    })
                );
                // Reload the page after a short delay so the new data is visible
                setTimeout(() => window.location.reload(), 1200);
            }
        } catch (err) {
            console.error('[WeatherCard] Refresh threw:', err);
            setRefreshState('error');
        }

        // Reset error state after a few seconds
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
        <GlassCard className="weather-card">
            <SectionHeader title="Conditions" icon="🌤" />

            <div className="weather-card__hero">
                <span className="weather-card__icon">{weather.icon}</span>
                <div className="weather-card__temp-block">
                    <span className="weather-card__temp">{Math.round(weather.temperature_c)}°</span>
                    <span className="weather-card__unit">C</span>
                </div>
                <span className="weather-card__condition">{weather.condition_label}</span>
            </div>

            <div className="weather-card__metrics">
                <MetricRow icon="💨" label="Wind" value={weather.wind_kph} unit=" km/h" />
                <MetricRow icon="💧" label="Humidity" value={weather.humidity} unit="%" />
                <MetricRow icon="🌧" label="Rain Chance" value={weather.rain_chance} unit="%" highlight={weather.rain_chance > 50} />
                <MetricRow icon="🌅" label="Sunrise" value={weather.sunrise_time} />
                <MetricRow icon="🌇" label="Sunset" value={weather.sunset_time} />
                <MetricRow 
                    icon="👁️" 
                    label="Visibility" 
                    value={typeof weather.visibility === 'number' && weather.visibility >= 1000 ? (weather.visibility / 1000).toFixed(1) : weather.visibility ?? '--'} 
                    unit={typeof weather.visibility === 'number' && weather.visibility >= 1000 ? " km" : typeof weather.visibility === 'number' ? " m" : ""} 
                />
                <MetricRow icon="⭐" label="Sky Quality" value={skyQuality} />
            </div>

            {/* ── Dev-only refresh button ────────────────────────────────── */}
            {isDevMode && (
                <div className="weather-card__dev-refresh">
                    <button
                        id="weather-refresh-btn"
                        className={`weather-card__refresh-btn weather-card__refresh-btn--${refreshState}`}
                        onClick={handleRefresh}
                        disabled={refreshState === 'loading'}
                        aria-label="Refresh weather data from Open-Meteo"
                    >
                        {refreshLabel[refreshState]}
                    </button>
                    <span className="weather-card__dev-badge">DEV</span>
                </div>
            )}
        </GlassCard>
    );
}
