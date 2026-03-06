'use client';

import React from 'react';
import type { WeatherForecast } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import MiniForecastDay from '@/components/ui/MiniForecastDay';

interface ForecastCardProps {
    forecast: WeatherForecast[];
}

export default function ForecastCard({ forecast }: ForecastCardProps) {
    return (
        <GlassCard className="forecast-card">
            <SectionHeader title="5-Day Forecast" icon="📅" />
            <div className="forecast-card__strip">
                {forecast.map((day) => (
                    <MiniForecastDay key={day.id} forecast={day} />
                ))}
            </div>
        </GlassCard>
    );
}
