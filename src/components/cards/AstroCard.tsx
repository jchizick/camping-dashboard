'use client';

import React from 'react';
import type { AstroData, WeatherCurrent } from '@/types';
import { getSkyQuality, getHeadlampTime, getGoldenHourLabel } from '@/lib/helpers';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import MetricRow from '@/components/ui/MetricRow';
import ProgressBar from '@/components/ui/ProgressBar';

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
        <GlassCard className="astro-card">
            <SectionHeader title="Night Sky" icon="🌌" />

            <div className="astro-card__moon">
                <span className="astro-card__moon-icon">{moonIcon}</span>
                <div className="astro-card__moon-info">
                    <p className="astro-card__moon-phase">{astro.moon_phase}</p>
                    <ProgressBar
                        value={astro.moon_illumination}
                        label="Illumination"
                        variant="default"
                        size="sm"
                    />
                </div>
            </div>

            <div className="astro-card__metrics">
                <MetricRow icon="🌅" label="Golden Hour" value={goldenHour} />
                <MetricRow icon="🔵" label="Blue Hour Ends" value={astro.blue_hour_end} />
                <MetricRow icon="🔦" label="Headlamp Time" value={headlampTime} />
                <MetricRow icon="⭐" label="Sky Quality" value={skyQuality} />
                <MetricRow icon="🌌" label="Milky Way" value={astro.milky_way_visibility} />
            </div>

            {astro.stargazing_notes && (
                <div className="astro-card__notes">
                    <p>{astro.stargazing_notes}</p>
                </div>
            )}
        </GlassCard>
    );
}
