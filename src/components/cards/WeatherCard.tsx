'use client';

import React from 'react';
import type { WeatherCurrent, AstroData } from '@/types';
import { getSkyQuality } from '@/lib/helpers';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import MetricRow from '@/components/ui/MetricRow';

interface WeatherCardProps {
    weather: WeatherCurrent;
    astro: AstroData;
}

export default function WeatherCard({ weather, astro }: WeatherCardProps) {
    const skyQuality = getSkyQuality(weather, astro);

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
                <MetricRow icon="🌙" label="Moonrise" value={weather.moonrise_time} />
                <MetricRow icon="⭐" label="Sky Quality" value={skyQuality} />
            </div>
        </GlassCard>
    );
}
