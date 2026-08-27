'use client';

import React, { useState } from 'react';
import type { Alert, AlertRefreshState } from '@/types';
import { Card, Badge } from '@/components/ui/Primitives';
import AlertFormSheet from '@/components/cards/AlertFormSheet';
import {
    AlertTriangle,
    Plus,
    Info,
    X,
    Trash2,
    ExternalLink,
    RefreshCw,
} from 'lucide-react';

interface AlertsCardProps {
    alerts: Alert[];
    refreshStates: AlertRefreshState[] | null;
    onAddManual?: (data: { title: string; body: string; severity: Alert['severity']; source: string; is_active: boolean }) => Promise<void>;
    onDeleteManual?: (id: string) => Promise<void>;
    onDismissSystem?: (id: string) => Promise<void>;
    onRefresh?: () => Promise<void>;
}

export default function AlertsCard({
    alerts,
    refreshStates,
    onAddManual,
    onDeleteManual,
    onDismissSystem,
    onRefresh,
}: AlertsCardProps) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

    const active = alerts.filter((alert) => alert.is_active && !alert.dismissed_at);
    const systemAlerts = active.filter((alert) => alert.provider !== 'manual');
    const manualAlerts = active.filter((alert) => alert.provider === 'manual');
    const states = refreshStates ?? [];
    const processing = states.some((state) => state.status === 'processing');
    const failed = states.some((state) => state.status === 'failed' || state.status === 'retry');
    const unsupported = refreshStates !== null && (
        states.length === 0 || states.every((state) => state.status === 'unsupported')
    );
    const hasSuccessfulRefresh = states.some((state) => state.last_success_at);

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        await onDeleteManual?.(pendingDeleteId);
        setPendingDeleteId(null);
    }

    async function refresh() {
        if (!onRefresh || refreshing) return;
        setRefreshing(true);
        setRefreshMessage(null);
        try {
            await onRefresh();
            setRefreshMessage('Notice sources refreshed.');
        } catch (error) {
            setRefreshMessage(error instanceof Error ? error.message : 'Notices could not be refreshed.');
        } finally {
            setRefreshing(false);
        }
    }

    function renderAlert(alert: Alert, isManual: boolean) {
        let bg = 'bg-accent-yellow/5 border-accent-yellow/20';
        let text = 'text-accent-yellow';
        let icon = AlertTriangle;
        if (alert.severity === 'info' || alert.severity === 'advisory') {
            bg = 'bg-accent-blue/5 border-accent-blue/20';
            text = 'text-accent-blue';
            icon = Info;
        } else if (alert.severity === 'critical') {
            bg = 'bg-accent-red/5 border-accent-red/20';
            text = 'text-accent-red';
        }
        const Icon = icon;
        return (
            <div key={alert.id} className={`${bg} border rounded-xl p-4 relative group transition-colors`}>
                <div className="flex justify-between items-start mb-2 pr-6">
                    <h4 className={`text-sm font-bold ${text} flex items-center gap-2`}>
                        <Icon size={16} /> {alert.title}
                    </h4>
                    <Badge variant={alert.severity === 'info' || alert.severity === 'advisory' ? 'info' : alert.severity === 'critical' ? 'critical' : 'warning'}>
                        {alert.severity}
                    </Badge>
                </div>
                <p className="text-sm text-text-main mb-3 leading-relaxed">{alert.body}</p>
                <div className="flex items-center gap-2 text-[10px] text-text-muted uppercase tracking-wider">
                    <span>{isManual ? 'Manual note' : alert.source}</span>
                    {!isManual && alert.source_url && (
                        <a href={alert.source_url} target="_blank" rel="noopener noreferrer" aria-label="Open notice source">
                            <ExternalLink size={12} />
                        </a>
                    )}
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isManual && onDeleteManual ? (
                        <button onClick={() => setPendingDeleteId(alert.id)} className="p-1.5 text-text-muted hover:text-accent-red hover:bg-hover-bg rounded" aria-label="Delete note">
                            <Trash2 size={14} />
                        </button>
                    ) : onDismissSystem ? (
                        <button onClick={() => onDismissSystem(alert.id)} className="p-1.5 text-text-muted hover:text-text-main hover:bg-hover-bg rounded" aria-label="Dismiss notice">
                            <X size={14} />
                        </button>
                    ) : null}
                </div>
            </div>
        );
    }

    let emptyMessage = 'No active notices were reported by the configured sources.';
    if (refreshStates === null) emptyMessage = 'Notice synchronization status could not be loaded.';
    else if (unsupported) emptyMessage = 'No automated notice source is configured for this trip.';
    else if (processing) emptyMessage = 'Notice sources are refreshing.';
    else if (failed && !hasSuccessfulRefresh) emptyMessage = 'Notice sources could not be checked yet.';
    else if (!hasSuccessfulRefresh) emptyMessage = 'Notice sources have not been checked yet.';

    return (
        <Card
            title={`Notices ${active.length > 0 ? `(${active.length})` : ''}`}
            icon={AlertTriangle}
            className="h-full"
            action={(onAddManual || onRefresh) && (
                <div className="flex items-center gap-1">
                    {onRefresh && !unsupported && (
                        <button onClick={refresh} disabled={refreshing || processing} className="p-1 hover:bg-card-hover rounded text-text-muted disabled:opacity-50" aria-label="Refresh notices">
                            <RefreshCw size={16} className={refreshing || processing ? 'animate-spin' : ''} />
                        </button>
                    )}
                    {onAddManual && (
                        <button onClick={() => setSheetOpen(true)} className="p-1 hover:bg-card-hover rounded text-text-muted" aria-label="Add manual notice">
                            <Plus size={16} />
                        </button>
                    )}
                </div>
            )}
        >
            {pendingDeleteId && (
                <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red p-3 mb-4 rounded-xl flex items-center justify-between text-sm">
                    <span>Delete this manual note?</span>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 bg-card-bg rounded border border-border-subtle text-xs" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                        <button className="px-3 py-1 bg-accent-red text-bg-main rounded font-bold text-xs" onClick={confirmDelete}>Delete</button>
                    </div>
                </div>
            )}
            {failed && hasSuccessfulRefresh && (
                <p className="mb-3 text-xs text-accent-yellow">Latest refresh failed; previously confirmed notices are retained and may be stale.</p>
            )}
            {refreshMessage && <p className="mb-3 text-xs text-text-muted">{refreshMessage}</p>}
            <div className="space-y-4">
                {active.length === 0 ? (
                    <div className="flex items-center justify-center p-6 text-sm text-text-muted font-mono bg-card-bg/50 border border-border-subtle border-dashed rounded-xl text-center">
                        {emptyMessage}
                    </div>
                ) : (
                    <>
                        {systemAlerts.map((alert) => renderAlert(alert, false))}
                        {manualAlerts.map((alert) => renderAlert(alert, true))}
                    </>
                )}
            </div>
            <AlertFormSheet
                isOpen={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSubmit={async (data) => onAddManual?.(data)}
            />
        </Card>
    );
}
