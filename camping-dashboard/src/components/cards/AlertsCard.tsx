'use client';

import React, { useState } from 'react';
import type { Alert } from '@/types';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import StatusPill from '@/components/ui/StatusPill';
import AlertFormSheet from '@/components/cards/AlertFormSheet';

interface AlertsCardProps {
    alerts: Alert[];
    onAddManual?: (data: { title: string; body: string; severity: Alert['severity']; source: string; is_active: boolean }) => Promise<void>;
    onDeleteManual?: (id: string) => Promise<void>;
}

const severityIcon: Record<string, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
};

export default function AlertsCard({ alerts, onAddManual, onDeleteManual }: AlertsCardProps) {
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [sheetOpen, setSheetOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const active = alerts.filter((a) => a.is_active && !dismissed.has(a.id));
    const criticalCount = active.filter((a) => a.severity === 'critical').length;

    // System alerts: non-manual source; dismiss only
    // Manual alerts: source === 'manual'; full delete
    const systemAlerts = active.filter((a) => a.source !== 'manual');
    const manualAlerts = active.filter((a) => a.source === 'manual');

    function dismiss(id: string) {
        setDismissed((prev) => new Set([...prev, id]));
    }

    function handleDelete(id: string) {
        setPendingDeleteId(id);
    }

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        await onDeleteManual?.(pendingDeleteId);
        setPendingDeleteId(null);
    }

    function renderAlert(alert: Alert, isManual: boolean) {
        return (
            <div key={alert.id} className={`alerts-card__alert alerts-card__alert--${alert.severity}`}>
                <div className="alerts-card__alert-header">
                    <span className="alerts-card__alert-icon">{severityIcon[alert.severity]}</span>
                    <span className="alerts-card__alert-title">{alert.title}</span>
                    <StatusPill label={alert.severity} variant={alert.severity} size="sm" />
                </div>
                <p className="alerts-card__alert-body">{alert.body}</p>
                <div className="alerts-card__alert-footer">
                    <span className="alerts-card__alert-source">
                        {isManual ? '📝 Manual note' : alert.source}
                    </span>
                    <div className="row-actions">
                        {isManual && onDeleteManual ? (
                            <button
                                className="row-actions__btn row-actions__btn--delete"
                                onClick={() => handleDelete(alert.id)}
                                aria-label={`Delete note: ${alert.title}`}
                                title="Delete note"
                            >
                                🗑️
                            </button>
                        ) : (
                            <button
                                className="alerts-card__dismiss"
                                onClick={() => dismiss(alert.id)}
                                aria-label={`Dismiss alert: ${alert.title}`}
                            >
                                Dismiss
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <GlassCard className="alerts-card">
            <SectionHeader
                title={`Alerts ${active.length > 0 ? `(${active.length})` : ''}`}
                icon={criticalCount > 0 ? '🚨' : '📣'}
                subtitle={criticalCount > 0 ? `${criticalCount} critical` : undefined}
                onAdd={onAddManual ? () => setSheetOpen(true) : undefined}
                addLabel="Add manual note"
            />

            {pendingDeleteId && (() => {
                const note = alerts.find(a => a.id === pendingDeleteId);
                return (
                    <div className="gear-card__delete-confirm">
                        <span>Delete note: <strong>{note?.title ?? 'this note'}</strong>?</span>
                        <div className="gear-card__delete-confirm-actions">
                            <button className="gear-card__delete-confirm-btn gear-card__delete-confirm-btn--cancel" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                            <button className="gear-card__delete-confirm-btn gear-card__delete-confirm-btn--confirm" onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                );
            })()}

            {active.length === 0 ? (
                <div className="alerts-card__clear">
                    <span>✅</span>
                    <p>No active alerts</p>
                </div>
            ) : (
                <div className="alerts-card__list">
                    {systemAlerts.map((a) => renderAlert(a, false))}
                    {manualAlerts.map((a) => renderAlert(a, true))}
                </div>
            )}

            <AlertFormSheet
                isOpen={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSubmit={async (data) => {
                    await onAddManual?.(data);
                }}
            />
        </GlassCard>
    );
}
