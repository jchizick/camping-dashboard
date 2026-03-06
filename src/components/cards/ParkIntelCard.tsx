'use client';

import React from 'react';
import type { ParkIntel } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import MetricRow from '@/components/ui/MetricRow';
import ProgressBar from '@/components/ui/ProgressBar';

interface ParkIntelCardProps {
    intel: ParkIntel;
}

function getFireIcon(restriction: string): string {
    if (restriction.toLowerCase().includes('ban')) return '🚫';
    if (restriction.toLowerCase().includes('level 2')) return '⚠️';
    return '🔥';
}

export default function ParkIntelCard({ intel }: ParkIntelCardProps) {
    const fireIcon = getFireIcon(intel.fire_restriction);

    return (
        <GlassCard className="park-intel-card">
            <SectionHeader title="Park Intelligence" icon="🌲" />

            <div className="park-intel-card__section">
                <h3 className="park-intel-card__section-title">
                    {fireIcon} Fire Status
                </h3>
                <p className="park-intel-card__text">{intel.fire_restriction}</p>
            </div>

            <div className="park-intel-card__section">
                <h3 className="park-intel-card__section-title">🐻 Wildlife</h3>
                <p className="park-intel-card__text">{intel.wildlife_notes}</p>
            </div>

            <div className="park-intel-card__section">
                <h3 className="park-intel-card__section-title">🪵 Firewood Availability</h3>
                <ProgressBar
                    value={intel.firewood_percent}
                    label="Availability"
                    variant={intel.firewood_percent > 60 ? 'success' : intel.firewood_percent > 30 ? 'default' : 'danger'}
                    size="sm"
                />
            </div>

            <div className="park-intel-card__section">
                <h3 className="park-intel-card__section-title">💧 Water</h3>
                <p className="park-intel-card__text">{intel.water_notes}</p>
            </div>

            <div className="park-intel-card__metrics">
                <MetricRow icon="📞" label="Ranger Station" value={intel.ranger_station} />
            </div>

            {intel.custom_notes && (
                <div className="park-intel-card__section park-intel-card__section--notes">
                    <h3 className="park-intel-card__section-title">📝 Site Notes</h3>
                    <p className="park-intel-card__text">{intel.custom_notes}</p>
                </div>
            )}
        </GlassCard>
    );
}
