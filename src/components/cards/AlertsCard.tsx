'use client';

import React, { useState } from 'react';
import type { Alert } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import StatusPill from '@/components/ui/StatusPill';

interface AlertsCardProps {
    alerts: Alert[];
}

const severityIcon: Record<string, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
};

export default function AlertsCard({ alerts }: AlertsCardProps) {
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    const active = alerts.filter((a) => a.is_active && !dismissed.has(a.id));
    const criticalCount = active.filter((a) => a.severity === 'critical').length;

    function dismiss(id: string) {
        setDismissed((prev) => new Set([...prev, id]));
    }

    return (
        <GlassCard className="alerts-card">
            <SectionHeader
                title={`Alerts ${active.length > 0 ? `(${active.length})` : ''}`}
                icon={criticalCount > 0 ? '🚨' : '📣'}
                subtitle={criticalCount > 0 ? `${criticalCount} critical` : undefined}
            />

            {active.length === 0 ? (
                <div className="alerts-card__clear">
                    <span>✅</span>
                    <p>No active alerts</p>
                </div>
            ) : (
                <div className="alerts-card__list">
                    {active.map((alert) => (
                        <div key={alert.id} className={`alerts-card__alert alerts-card__alert--${alert.severity}`}>
                            <div className="alerts-card__alert-header">
                                <span className="alerts-card__alert-icon">{severityIcon[alert.severity]}</span>
                                <span className="alerts-card__alert-title">{alert.title}</span>
                                <StatusPill label={alert.severity} variant={alert.severity} size="sm" />
                            </div>
                            <p className="alerts-card__alert-body">{alert.body}</p>
                            <div className="alerts-card__alert-footer">
                                <span className="alerts-card__alert-source">{alert.source}</span>
                                <button
                                    className="alerts-card__dismiss"
                                    onClick={() => dismiss(alert.id)}
                                    aria-label={`Dismiss alert: ${alert.title}`}
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </GlassCard>
    );
}
