'use client';

import React from 'react';
import type { WeatherForecast } from '@/types';
import { Card } from '@/components/ui/Primitives';
import { Calendar, Droplets, Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, HelpCircle } from 'lucide-react';

interface ForecastCardProps {
    forecast: WeatherForecast[];
}

function getWeatherIcon(condition: string) {
    const lower = condition.toLowerCase();
    if (lower.includes('thunderstorm')) return <CloudLightning size={32} className="stroke-[1.5]" />;
    if (lower.includes('snow')) return <CloudSnow size={32} className="stroke-[1.5]" />;
    if (lower.includes('drizzle')) return <CloudDrizzle size={32} className="stroke-[1.5]" />;
    if (lower.includes('rain') || lower.includes('shower')) return <CloudRain size={32} className="stroke-[1.5]" />;
    if (lower.includes('fog')) return <CloudFog size={32} className="stroke-[1.5]" />;
    if (lower.includes('overcast')) return <Cloud size={32} className="stroke-[1.5]" />;
    if (lower.includes('partly')) return <CloudSun size={32} className="stroke-[1.5]" />;
    if (lower.includes('clear')) return <Sun size={32} className="stroke-[1.5]" />;
    return <Sun size={32} className="stroke-[1.5]" />;
}

export default function ForecastCard({ forecast }: ForecastCardProps) {
    if (!forecast || forecast.length === 0) return null;

    return (
        <Card title="5-Day Forecast" icon={Calendar} className="h-full">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 h-full">
                {forecast.map((day, i) => {
                    // Try to extract Day string properly
                    let dayName = day.forecast_date;
                    try {
                        dayName = new Date(day.forecast_date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                    } catch (e) { }

                    const isTomorrow = i === 1;
                    const IconComponent = getWeatherIcon(day.condition_label);

                    return (
                        <div key={day.id} className={`flex flex-col items-center justify-center p-4 rounded-xl border ${isTomorrow ? 'bg-card-hover border-border-subtle' : 'border-transparent bg-card-bg/50'}`}>
                            <div className="text-xs font-mono text-text-muted mb-3">{dayName}</div>
                            <div className={`mb-4 flex items-center justify-center ${isTomorrow ? 'drop-shadow-sm text-text-main' : 'opacity-70 text-text-muted'}`}>
                                {IconComponent}
                            </div>
                            <div className="font-mono text-lg text-text-main font-medium mb-1">{Math.round(day.high_c)}°</div>
                            <div className="font-mono text-sm text-text-muted mb-3">{Math.round(day.low_c)}°</div>
                            <div className="flex items-center gap-1 text-xs font-mono text-accent-blue">
                                <Droplets size={10} /> {day.rain_chance}%
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
