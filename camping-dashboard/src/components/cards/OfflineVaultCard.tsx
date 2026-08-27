'use client';

import React from 'react';
import type { OfflineStatus } from '@/types';
import { evaluateOfflineCategory } from '@/lib/readiness';
import { Card, ProgressBar } from '@/components/ui/Primitives';
import { FIELD_PREP_CHECKS } from '@/components/field/fieldPrepChecklist';
import { ShieldAlert, CheckCircle2, Radio, Circle, FolderCode } from 'lucide-react';

interface OfflineVaultCardProps {
    status: OfflineStatus | null;
    onToggle?: (key: keyof OfflineStatus) => void;
    onInitialize?: () => Promise<void>;
    onOpenIntel?: () => void;
}

export default function OfflineVaultCard({ status, onToggle, onInitialize, onOpenIntel }: OfflineVaultCardProps) {
    const [initializing, setInitializing] = React.useState(false);
    const [initializationError, setInitializationError] = React.useState<string | null>(null);
    const displayStatus: OfflineStatus = status ?? {
        trip_id: '',
        maps_cached: false,
        permit_saved: false,
        daily_vehicle_permit_saved: false,
        route_downloaded: false,
        satellite_device_connected: false,
        satellite_device_name: '',
        emergency_contact_ready: false,
        updated_at: '',
    };
    const readiness = evaluateOfflineCategory(displayStatus, true).score ?? 0;
    const readinessColor = readiness >= 80 ? 'bg-accent-green' : readiness >= 60 ? 'bg-accent-yellow' : 'bg-accent-red';

    return (
        <Card title="Field Prep" icon={ShieldAlert} className="h-full flex flex-col">
            {status ? (
                <>
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-xs text-text-muted">Field Prep completion</span>
                        <span className="text-sm font-mono text-text-main">{readiness}%</span>
                    </div>
                    <ProgressBar value={readiness} colorClass={readinessColor} className="mb-6 shrink-0" />
                </>
            ) : (
                <div className="flex flex-1 flex-col justify-center rounded-xl border border-border-subtle bg-app-bg/50 p-4">
                    <h3 className="text-sm font-semibold text-text-main">Field Prep hasn’t been set up yet</h3>
                    <p className="mt-1 text-sm leading-relaxed text-text-muted">
                        {onInitialize
                            ? 'Set up the manual checklist when you are ready to confirm field preparations.'
                            : 'This saved trip is read-only. Field Prep can be set up when editing is available.'}
                    </p>
                    {onInitialize ? (
                        <button
                            type="button"
                            disabled={initializing}
                            onClick={async () => {
                                if (initializing) return;
                                setInitializing(true);
                                setInitializationError(null);
                                try {
                                    await onInitialize();
                                } catch (error) {
                                    setInitializationError(error instanceof Error ? error.message : 'Field Prep could not be set up.');
                                } finally {
                                    setInitializing(false);
                                }
                            }}
                            className="mt-4 min-h-11 rounded-lg border border-border-subtle bg-card-hover px-4 text-sm font-semibold text-text-main"
                        >
                            {initializing ? 'Setting up…' : 'Set up Field Prep'}
                        </button>
                    ) : null}
                    {initializationError ? <p className="mt-2 text-xs text-accent-red" role="alert">{initializationError}</p> : null}
                </div>
            )}

            {status ? <div className="space-y-2 flex-1">
                {FIELD_PREP_CHECKS.map(({ key, label, icon: Icon }) => {
                    const done = displayStatus[key];
                    return (
                        <div 
                            key={key} 
                            onClick={onToggle ? () => onToggle(key) : undefined}
                            className={`flex items-center justify-between p-3 rounded-xl border border-border-subtle transition-colors bg-app-bg/50 ${
                                onToggle ? 'hover:bg-card-hover cursor-pointer' : ''
                            }`}
                            role={onToggle ? 'button' : undefined}
                            tabIndex={onToggle ? 0 : undefined}
                            onKeyDown={onToggle ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onToggle(key);
                                }
                            } : undefined}
                        >
                            <div className="flex items-center gap-3">
                                <Icon size={16} className={done ? 'text-accent-green' : 'text-text-muted'} />
                                <span className={`text-sm ${done ? 'text-text-main' : 'text-text-muted'}`}>{label}</span>
                            </div>
                            {done ? (
                                <CheckCircle2 size={16} className="text-accent-green" />
                            ) : (
                                <Circle size={16} className="text-border-subtle" />
                            )}
                        </div>
                    );
                })}
            </div> : null}

            {displayStatus.satellite_device_connected && displayStatus.satellite_device_name && (
                <div className="mt-4 flex justify-between items-center px-4 py-2 border border-border-subtle rounded-xl bg-card-hover/50 text-xs font-mono shrink-0">
                    <span className="text-text-muted flex items-center gap-2"><Radio size={14} className="text-accent-blue" /> Satellite Active</span>
                    <span className="text-text-main">{displayStatus.satellite_device_name}</span>
                </div>
            )}

            <div className="mt-6 text-center text-[10px] font-mono shrink-0">
                <button
                    onClick={onOpenIntel}
                    className="text-accent-yellow/70 hover:text-accent-yellow transition-colors uppercase tracking-widest flex items-center justify-center gap-1.5 w-full mx-auto p-1"
                >
                    <FolderCode size={10} />
                    ACCESS PROJECT INTEL
                </button>
            </div>
        </Card>
    );
}
