'use client';

import React from 'react';
import type { OfflineStatus } from '@/types';
import { calculateOfflineReadiness } from '@/lib/helpers';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import ProgressBar from '@/components/ui/ProgressBar';

interface OfflineVaultCardProps {
    status: OfflineStatus;
}

const checks = [
    { key: 'maps_cached' as const, label: 'Maps Cached', icon: '🗺' },
    { key: 'permit_saved' as const, label: 'Permit Saved', icon: '📄' },
    { key: 'route_downloaded' as const, label: 'Route Downloaded', icon: '📍' },
    { key: 'satellite_device_connected' as const, label: 'Satellite Device', icon: '📡' },
    { key: 'emergency_contact_ready' as const, label: 'Emergency Contact', icon: '🆘' },
];

export default function OfflineVaultCard({ status }: OfflineVaultCardProps) {
    const readiness = calculateOfflineReadiness(status);

    return (
        <GlassCard className="offline-card">
            <SectionHeader title="Offline Vault" icon="📡" />

            <ProgressBar
                value={readiness}
                label="Safety Readiness"
                variant={readiness >= 80 ? 'success' : readiness >= 60 ? 'default' : 'danger'}
            />

            <div className="offline-card__checks">
                {checks.map(({ key, label, icon }) => {
                    const done = status[key];
                    return (
                        <div key={key} className={`offline-card__check ${done ? 'offline-card__check--done' : 'offline-card__check--missing'}`}>
                            <span className="offline-card__check-icon">{icon}</span>
                            <span className="offline-card__check-label">{label}</span>
                            <span className="offline-card__check-status">{done ? '✓' : '○'}</span>
                        </div>
                    );
                })}
            </div>

            {status.satellite_device_connected && status.satellite_device_name && (
                <p className="offline-card__device-name">
                    📡 {status.satellite_device_name}
                </p>
            )}

            <p className="offline-card__updated">
                Updated {new Date(status.updated_at).toLocaleDateString('en-CA')}
            </p>
        </GlassCard>
    );
}
