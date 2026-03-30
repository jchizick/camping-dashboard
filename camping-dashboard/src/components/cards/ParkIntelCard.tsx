'use client';

import React, { useState } from 'react';
import type { ParkIntel } from '@/types';
import { Card, ProgressBar } from '@/components/ui/Primitives';
import ParkIntelFormSheet from './ParkIntelFormSheet';
import { Info, Flame, Trees, Thermometer, Droplets, Radio, MapPin, Pencil } from 'lucide-react';

interface ParkIntelCardProps {
    intel: ParkIntel;
    onUpdate?: (patch: Partial<Omit<ParkIntel, 'id' | 'trip_id' | 'updated_at'>>) => Promise<void>;
}

export default function ParkIntelCard({ intel, onUpdate }: ParkIntelCardProps) {
    const [sheetOpen, setSheetOpen] = useState(false);

    return (
        <Card 
            title="Park Intelligence" 
            icon={Info} 
            className="h-full"
            action={onUpdate && (
                <button 
                    onClick={() => setSheetOpen(true)} 
                    className="flex justify-center items-center text-xs font-mono px-3 py-1 rounded-full border border-border-subtle bg-card-bg text-text-muted hover:text-text-main hover:bg-card-hover transition-colors gap-2"
                >
                    <Pencil size={12} /> Edit
                </button>
            )}
        >
            <div className="space-y-6">
                <div>
                    <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-accent-yellow uppercase mb-2">
                        <Flame size={14} /> Fire Status
                    </h3>
                    <p className="text-sm text-text-main">{intel.fire_restriction}</p>
                </div>

                <div>
                    <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-accent-yellow uppercase mb-2">
                        <Trees size={14} /> Wildlife
                    </h3>
                    <p className="text-sm text-text-muted leading-relaxed">
                        {intel.wildlife_notes}
                    </p>
                </div>

                <div>
                    <div className="flex justify-between items-end mb-2">
                        <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-accent-yellow uppercase">
                            <Thermometer size={14} /> Firewood Availability
                        </h3>
                        <span className="text-xs font-mono text-text-main">{intel.firewood_percent}%</span>
                    </div>
                    <ProgressBar 
                        value={intel.firewood_percent} 
                        colorClass={intel.firewood_percent > 60 ? 'bg-accent-green' : intel.firewood_percent > 30 ? 'bg-accent-yellow' : 'bg-accent-red'} 
                    />
                </div>

                <div>
                    <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-accent-blue uppercase mb-2">
                        <Droplets size={14} /> Water
                    </h3>
                    <p className="text-sm text-text-main">{intel.water_notes}</p>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-border-subtle">
                    <div className="flex items-center gap-2 text-sm text-text-muted">
                        <Radio size={14} /> Ranger Station
                    </div>
                    <div className="font-mono text-sm text-text-main">{intel.ranger_station}</div>
                </div>

                {intel.custom_notes && (
                    <div className="bg-card-hover rounded-xl p-4 border border-border-subtle border-l-4 border-l-accent-yellow">
                        <h3 className="text-xs font-bold tracking-widest text-text-muted uppercase mb-1 flex items-center gap-2">
                            <MapPin size={12} /> Site Notes
                        </h3>
                        <p className="text-sm text-text-main italic">{intel.custom_notes}</p>
                    </div>
                )}
            </div>

            {onUpdate && (
                <ParkIntelFormSheet
                    isOpen={sheetOpen}
                    onClose={() => setSheetOpen(false)}
                    onSubmit={onUpdate}
                    intel={intel}
                />
            )}
        </Card>
    );
}
