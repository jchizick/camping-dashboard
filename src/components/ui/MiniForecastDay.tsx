'use client';

import React from 'react';
import type { WeatherForecast } from '@/types';

interface MiniForecastDayProps {
    forecast: WeatherForecast;
}

function getShortDay(dateStr: string): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[new Date(dateStr + 'T12:00:00').getDay()];
}

export default function MiniForecastDay({ forecast }: MiniForecastDayProps) {
    return (
        <div className="mini-forecast-day">
            <span className="mini-forecast-day__day">{getShortDay(forecast.forecast_date)}</span>
            <span className="mini-forecast-day__icon">{forecast.icon}</span>
            <span className="mini-forecast-day__high">{Math.round(forecast.high_c)}°</span>
            <span className="mini-forecast-day__low">{Math.round(forecast.low_c)}°</span>
            <span className="mini-forecast-day__rain">
                <span className="mini-forecast-day__rain-icon">💧</span>
                {forecast.rain_chance}%
            </span>
        </div>
    );
}
