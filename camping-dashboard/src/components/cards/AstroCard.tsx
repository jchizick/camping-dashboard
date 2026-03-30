'use client';

import React from 'react';
import type { AstroData, WeatherCurrent } from '@/types';
import { getSkyQuality, getHeadlampTime, getGoldenHourLabel } from '@/lib/helpers';
import { Card, ProgressBar } from '@/components/ui/Primitives';
import { Star, Sunset, Flashlight, Eye, Navigation } from 'lucide-react';

interface AstroCardProps {
    astro: AstroData;
    weather: WeatherCurrent;
}

const moonPhaseIcon: Record<string, string> = {
    'New Moon': '🌑',
    'Waxing Crescent': '🌒',
    'First Quarter': '🌓',
    'Waxing Gibbous': '🌔',
    'Full Moon': '🌕',
    'Waning Gibbous': '🌖',
    'Last Quarter': '🌗',
    'Waning Crescent': '🌘',
};

export default function AstroCard({ astro, weather }: AstroCardProps) {
    const skyQuality = getSkyQuality(weather, astro);
    const headlampTime = getHeadlampTime(astro);
    const goldenHour = getGoldenHourLabel(astro);
    const moonIcon = moonPhaseIcon[astro.moon_phase] || '🌙';

    return (
        <Card title="Night Sky" icon={Star} className="h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <div className="flex items-center gap-4 mb-6">
                        <span className="text-5xl">{moonIcon}</span>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-text-main mb-2">{astro.moon_phase}</p>
                            <div className="flex justify-between text-xs font-mono text-text-muted mb-1">
                                <span>Illumination</span>
                                <span>{astro.moon_illumination}%</span>
                            </div>
                            <ProgressBar value={astro.moon_illumination} />
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    {[
                        { icon: Sunset, label: 'Golden Hour', value: goldenHour },
                        { icon: Eye, label: 'Blue Hour Ends', value: astro.blue_hour_end },
                        { icon: Flashlight, label: 'Headlamp Time', value: headlampTime },
                        { icon: Star, label: 'Sky Quality', value: skyQuality },
                        { icon: Navigation, label: 'Milky Way', value: astro.milky_way_visibility },
                    ].map((stat, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-border-subtle/50 last:border-0">
                            <div className="flex items-center gap-3 text-text-muted text-sm">
                                <stat.icon size={16} />
                                {stat.label}
                            </div>
                            <div className="font-mono text-sm text-text-main font-medium">
                                {stat.value}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {astro.stargazing_notes && (
                <div className="mt-6 pt-4 border-t border-border-subtle">
                    <p className="text-sm text-text-muted italic leading-relaxed">
                        {astro.stargazing_notes}
                    </p>
                </div>
            )}
        </Card>
    );
}
