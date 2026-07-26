'use client';

import React, { useState } from 'react';
import type { ParkIntel } from '@/types';
import { Card, ProgressBar } from '@/components/ui/Primitives';
import ParkIntelFormSheet from './ParkIntelFormSheet';
import { useTheme } from '@/lib/themeContext';
import { Info, Flame, Trees, Thermometer, Droplets, Radio, MapPin, Pencil } from 'lucide-react';

interface ParkIntelCardProps {
    intel: ParkIntel | null;
    onUpdate?: (patch: Partial<Omit<ParkIntel, 'trip_id' | 'updated_at'>>) => Promise<void>;
}

export default function ParkIntelCard({ intel, onUpdate }: ParkIntelCardProps) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const { labels } = useTheme();
    const displayIntel: ParkIntel = intel ?? {
        trip_id: '',
        fire_restriction: 'Unknown',
        wildlife_notes: '',
        ranger_station: '',
        firewood_percent: 0,
        water_notes: '',
        custom_notes: '',
        updated_at: '',
    };

    return (
        <Card 
            title={labels.parkIntel} 
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
            <div className="park-intel-scroll">
                {!intel ? (
                    <div className="min-h-48 flex items-center justify-center px-6 text-center text-sm text-text-muted">
                        Park intelligence has not been added yet.
                    </div>
                ) : (
                <div className="space-y-6">
                    <div>
                        <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-accent-yellow uppercase mb-2">
                            <Flame size={14} /> Fire Status
                        </h3>
                        <p className="text-sm text-text-main">{displayIntel.fire_restriction}</p>
                    </div>

                    <div>
                        <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-accent-yellow uppercase mb-2">
                            <Trees size={14} /> Wildlife
                        </h3>
                        <p className="text-sm text-text-muted leading-relaxed">
                            {displayIntel.wildlife_notes || 'No wildlife notes yet.'}
                        </p>
                    </div>

                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-accent-yellow uppercase">
                                <Thermometer size={14} /> Firewood Availability
                            </h3>
                            <span className="text-xs font-mono text-text-main">{displayIntel.firewood_percent}%</span>
                        </div>
                        <ProgressBar 
                            value={displayIntel.firewood_percent}
                            colorClass={displayIntel.firewood_percent > 60 ? 'bg-accent-green' : displayIntel.firewood_percent > 30 ? 'bg-accent-yellow' : 'bg-accent-red'}
                        />
                    </div>

                    <div>
                        <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-accent-blue uppercase mb-2">
                            <Droplets size={14} /> Water
                        </h3>
                        <p className="text-sm text-text-main">{displayIntel.water_notes || 'No water notes yet.'}</p>
                    </div>

                    <div className="flex items-center justify-between py-3 border-t border-border-subtle">
                        <div className="flex items-center gap-2 text-sm text-text-muted">
                            <Radio size={14} /> Ranger Station
                        </div>
                        <div className="font-mono text-sm text-text-main">{displayIntel.ranger_station || 'Not set'}</div>
                    </div>

                    {displayIntel.custom_notes && (
                        <div className="bg-card-hover rounded-xl p-4 border border-border-subtle border-l-4 border-l-accent-yellow">
                            <h3 className="text-xs font-bold tracking-widest text-text-muted uppercase mb-1 flex items-center gap-2">
                                <MapPin size={12} /> Site Notes
                            </h3>
                            <p className="text-sm text-text-main italic">{displayIntel.custom_notes}</p>
                        </div>
                    )}
                </div>
                )}
            </div>

            {onUpdate && (
                <ParkIntelFormSheet
                    isOpen={sheetOpen}
                    onClose={() => setSheetOpen(false)}
                    onSubmit={onUpdate}
                    intel={displayIntel}
                />
            )}
        </Card>
    );
}
