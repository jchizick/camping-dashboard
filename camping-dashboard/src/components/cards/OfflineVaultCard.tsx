'use client';

import React from 'react';
import type { OfflineStatus } from '@/types';
import { calculateOfflineReadiness } from '@/lib/helpers';
import { Card, ProgressBar } from '@/components/ui/Primitives';
import { ShieldAlert, Map, CheckCircle2, Navigation, Radio, AlertTriangle, Circle, FolderCode } from 'lucide-react';

interface OfflineVaultCardProps {
    status: OfflineStatus;
    onToggle?: (key: keyof OfflineStatus) => void;
    onOpenIntel?: () => void;
}

const checks = [
    { key: 'maps_cached' as const, label: 'Maps Cached', icon: Map },
    { key: 'permit_saved' as const, label: 'Permit Saved', icon: CheckCircle2 },
    { key: 'route_downloaded' as const, label: 'Route Downloaded', icon: Navigation },
    { key: 'satellite_device_connected' as const, label: 'Satellite Device', icon: Radio },
    { key: 'emergency_contact_ready' as const, label: 'Emergency Contact', icon: AlertTriangle },
];

export default function OfflineVaultCard({ status, onToggle, onOpenIntel }: OfflineVaultCardProps) {
    const readiness = calculateOfflineReadiness(status);
    const readinessColor = readiness >= 80 ? 'bg-accent-green' : readiness >= 60 ? 'bg-accent-yellow' : 'bg-accent-red';

    return (
        <Card title="Offline Vault" icon={ShieldAlert} className="h-full flex flex-col">
            <div className="flex justify-between items-end mb-2">
                <span className="text-xs text-text-muted">Safety Readiness</span>
                <span className="text-sm font-mono text-text-main">{readiness}%</span>
            </div>
            <ProgressBar value={readiness} colorClass={readinessColor} className="mb-6 shrink-0" />

            <div className="space-y-2 flex-1">
                {checks.map(({ key, label, icon: Icon }) => {
                    const done = status[key];
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
            </div>

            {status.satellite_device_connected && status.satellite_device_name && (
                <div className="mt-4 flex justify-between items-center px-4 py-2 border border-border-subtle rounded-xl bg-card-hover/50 text-xs font-mono shrink-0">
                    <span className="text-text-muted flex items-center gap-2"><Radio size={14} className="text-accent-blue" /> Satellite Active</span>
                    <span className="text-text-main">{status.satellite_device_name}</span>
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
