'use client';

import React, { useState } from 'react';
import type { Alert } from '@/types';
import { Card, Badge } from '@/components/ui/Primitives';
import AlertFormSheet from '@/components/cards/AlertFormSheet';
import { AlertTriangle, Plus, Info, X, Trash2, ExternalLink } from 'lucide-react';

interface AlertsCardProps {
    alerts: Alert[];
    onAddManual?: (data: { title: string; body: string; severity: Alert['severity']; source: string; is_active: boolean }) => Promise<void>;
    onDeleteManual?: (id: string) => Promise<void>;
}

export default function AlertsCard({ alerts, onAddManual, onDeleteManual }: AlertsCardProps) {
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [sheetOpen, setSheetOpen] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const active = alerts.filter((a) => a.is_active && !dismissed.has(a.id));
    const criticalCount = active.filter((a) => a.severity === 'critical').length;

    const systemAlerts = active.filter((a) => a.source !== 'manual');
    const manualAlerts = active.filter((a) => a.source === 'manual');

    function dismiss(id: string) {
        setDismissed((prev) => new Set([...prev, id]));
    }

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        await onDeleteManual?.(pendingDeleteId);
        setPendingDeleteId(null);
    }

    function renderAlert(alert: Alert, isManual: boolean) {
        let bg = 'bg-accent-yellow/5 border-accent-yellow/20';
        let text = 'text-accent-yellow';
        let icon = AlertTriangle;

        if (alert.severity === 'info') {
            bg = 'bg-accent-blue/5 border-accent-blue/20';
            text = 'text-accent-blue';
            icon = Info;
        } else if (alert.severity === 'critical') {
            bg = 'bg-accent-red/5 border-accent-red/20';
            text = 'text-accent-red';
            icon = AlertTriangle;
        }

        const Icon = icon;

        return (
            <div key={alert.id} className={`${bg} border rounded-xl p-4 relative group transition-colors`}>
                <div className="flex justify-between items-start mb-2 pr-6">
                    <h4 className={`text-sm font-bold ${text} flex items-center gap-2`}>
                        <Icon size={16} /> {alert.title}
                    </h4>
                    <Badge variant={alert.severity === 'info' ? 'info' : alert.severity === 'critical' ? 'critical' : 'warning'}>
                        {alert.severity}
                    </Badge>
                </div>
                <p className="text-sm text-text-main mb-3 leading-relaxed">{alert.body}</p>
                <div className="text-[10px] text-text-muted uppercase tracking-wider">
                    {isManual ? '📝 Manual note' : alert.source}
                </div>
                
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isManual && onDeleteManual ? (
                        <button 
                            onClick={() => setPendingDeleteId(alert.id)}
                            className="p-1.5 text-text-muted hover:text-accent-red hover:bg-black/20 rounded transition-colors"
                            aria-label="Delete note"
                        >
                            <Trash2 size={14} />
                        </button>
                    ) : (
                        <button 
                            onClick={() => dismiss(alert.id)}
                            className="p-1.5 text-text-muted hover:text-text-main hover:bg-black/20 rounded transition-colors"
                            aria-label="Dismiss alert"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <Card 
            title={`Alerts ${active.length > 0 ? `(${active.length})` : ''}`} 
            icon={AlertTriangle} 
            className="h-full"
            action={onAddManual && (
                <button onClick={() => setSheetOpen(true)} className="p-1 hover:bg-card-hover rounded text-text-muted transition-colors">
                    <Plus size={16} />
                </button>
            )}
        >
            {pendingDeleteId && (() => {
                const note = alerts.find(a => a.id === pendingDeleteId);
                return (
                    <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red p-3 mb-4 rounded-xl flex items-center justify-between text-sm">
                        <span>Delete note: <strong>{note?.title ?? 'this note'}</strong>?</span>
                        <div className="flex gap-2">
                            <button className="px-3 py-1 bg-card-bg rounded border border-border-subtle hover:bg-card-hover text-text-muted text-xs" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                            <button className="px-3 py-1 bg-accent-red text-bg-main rounded hover:bg-accent-red/80 font-bold text-xs" onClick={confirmDelete}>Delete</button>
                        </div>
                    </div>
                );
            })()}

            <div className="space-y-4">
                {active.length === 0 ? (
                    <div className="flex items-center justify-center p-6 text-sm text-text-muted font-mono bg-card-bg/50 border border-border-subtle border-dashed rounded-xl">
                        <span>✅ No active alerts</span>
                    </div>
                ) : (
                    <>
                        {systemAlerts.map(a => renderAlert(a, false))}
                        {manualAlerts.map(a => renderAlert(a, true))}
                    </>
                )}
            </div>

            <div className="mt-6 pt-4 border-t border-border-subtle flex flex-col gap-2">
                <h5 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">External Resources</h5>
                <a href="https://www.algonquinpark.on.ca/news/algonquin_park_advisories.php" target="_blank" rel="noopener noreferrer" className="text-sm text-text-main hover:text-accent-blue transition-colors flex items-center gap-1.5">
                    <ExternalLink size={14} /> Algonquin Park Advisories
                </a>
                <a href="https://x.com/PreparedON" target="_blank" rel="noopener noreferrer" className="text-sm text-text-main hover:text-accent-blue transition-colors flex items-center gap-1.5">
                    <ExternalLink size={14} /> @PreparedON
                </a>
                <a href="https://x.com/Algonquin_PP" target="_blank" rel="noopener noreferrer" className="text-sm text-text-main hover:text-accent-blue transition-colors flex items-center gap-1.5">
                    <ExternalLink size={14} /> @Algonquin_PP
                </a>
            </div>

            <AlertFormSheet
                isOpen={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSubmit={async (data) => {
                    await onAddManual?.(data);
                }}
            />
        </Card>
    );
}
