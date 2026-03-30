'use client';

import React, { useState, useMemo } from 'react';
import type { GearItem } from '@/types';
import { calculateGearReadiness, groupBy } from '@/lib/helpers';
import { Card, ProgressBar } from '@/components/ui/Primitives';
import ChecklistItem from '@/components/ui/ChecklistItem';
import GearFormSheet from '@/components/cards/GearFormSheet';
import { Tent, Plus, ChevronDown } from 'lucide-react';

interface GearChecklistCardProps {
    gear: GearItem[];
    onToggle?: (id: string) => void;
    onAdd?: (item: Omit<GearItem, 'id' | 'trip_id'>) => Promise<void>;
    onUpdate?: (id: string, patch: Partial<Omit<GearItem, 'id' | 'trip_id'>>) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
}

type FilterMode = 'all' | 'needed' | 'critical';

const CATEGORY_ORDER = [
    'Shelter',
    'Navigation',
    'Cooking',
    'Safety',
    'Clothing',
    'Lighting',
    'Camp',
    'Admin',
    'Extras',
];

export default function GearChecklistCard({ gear, onToggle, onAdd, onUpdate, onDelete }: GearChecklistCardProps) {
    const [filter, setFilter] = useState<FilterMode>('all');
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<GearItem | undefined>(undefined);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const readiness = useMemo(() => calculateGearReadiness(gear), [gear]);

    const filtered = useMemo(() => {
        if (filter === 'needed') return gear.filter((g) => !g.packed);
        if (filter === 'critical') return gear.filter((g) => g.priority === 'critical');
        return gear;
    }, [gear, filter]);

    const grouped = useMemo(() => {
        const normalizedGear = filtered.map(g => {
            const rawCat = g.category || 'Extras';
            const cat = rawCat.charAt(0).toUpperCase() + rawCat.slice(1).toLowerCase();
            return { ...g, category: cat };
        });
        return groupBy(normalizedGear, (g) => g.category);
    }, [filtered]);

    const packedCount = gear.filter((g) => g.packed).length;

    function openAdd() {
        setEditingItem(undefined);
        setSheetOpen(true);
    }

    function openEdit(item: GearItem) {
        setEditingItem(item);
        setSheetOpen(true);
    }

    async function handleFormSubmit(data: Omit<GearItem, 'id' | 'trip_id'>) {
        if (editingItem) {
            await onUpdate?.(editingItem.id, data);
        } else {
            await onAdd?.(data);
        }
    }

    async function confirmDelete() {
        if (!pendingDeleteId) return;
        await onDelete?.(pendingDeleteId);
        setPendingDeleteId(null);
    }

    const readinessColor = readiness >= 80 ? 'bg-accent-green' : readiness >= 50 ? 'bg-accent-yellow' : 'bg-accent-red';

    return (
        <Card 
            title="Gear Checklist" 
            icon={Tent} 
            className="h-full max-h-[600px] flex flex-col"
            action={onAdd && (
                <button onClick={openAdd} className="p-1 hover:bg-card-hover rounded text-text-muted transition-colors">
                    <Plus size={16} />
                </button>
            )}
        >
            <div className="flex justify-between items-end mb-6 shrink-0">
                <div>
                    <div className="text-2xl font-mono text-text-main">
                        {packedCount} / {gear.length} <span className="text-sm text-text-muted font-sans">packed</span>
                    </div>
                </div>
                <div className="text-right w-1/2">
                    <div className="text-xs font-mono text-text-muted mb-1 flex justify-between">
                        <span>Readiness</span>
                        <span className="text-text-main">{readiness}%</span>
                    </div>
                    <ProgressBar value={readiness} colorClass={readinessColor} />
                </div>
            </div>

            <div className="flex gap-2 mb-6 border-b border-border-subtle pb-4 shrink-0">
                {(['all', 'needed', 'critical'] as FilterMode[]).map((f) => {
                    const isActive = filter === f;
                    const labels = {
                        all: 'All',
                        needed: <><div className="w-2 h-2 rounded-full bg-accent-yellow" /> Needed</>,
                        critical: <><div className="w-2 h-2 rounded-full bg-accent-red" /> Critical</>
                    };
                    
                    return (
                        <button
                            key={f}
                            className={`px-4 py-1.5 rounded-full text-xs font-mono border transition-colors flex items-center gap-2 ${
                                isActive 
                                    ? 'bg-border-subtle text-text-main border-border-subtle' 
                                    : 'bg-card-bg text-text-muted border-border-subtle hover:bg-card-hover'
                            }`}
                            onClick={() => setFilter(f)}
                        >
                            {labels[f]}
                        </button>
                    );
                })}
            </div>

            {pendingDeleteId && (() => {
                const item = gear.find(g => g.id === pendingDeleteId);
                return (
                    <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red p-3 mb-4 rounded-xl flex items-center justify-between text-sm shrink-0">
                        <span>Remove <strong>{item?.name ?? 'this item'}</strong>?</span>
                        <div className="flex gap-2">
                            <button className="px-3 py-1 bg-card-bg rounded border border-border-subtle hover:bg-card-hover text-text-muted text-xs" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                            <button className="px-3 py-1 bg-accent-red text-bg-main rounded hover:bg-accent-red/80 font-bold text-xs" onClick={confirmDelete}>Remove</button>
                        </div>
                    </div>
                );
            })()}

            <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-0 pb-4">
                {Object.entries(grouped)
                    .sort(([a], [b]) => {
                        const ai = CATEGORY_ORDER.indexOf(a);
                        const bi = CATEGORY_ORDER.indexOf(b);
                        const aIdx = ai === -1 ? CATEGORY_ORDER.indexOf('Extras') - 0.5 : ai;
                        const bIdx = bi === -1 ? CATEGORY_ORDER.indexOf('Extras') - 0.5 : bi;
                        return aIdx - bIdx;
                    })
                    .map(([category, items]) => (
                    <div key={category}>
                        <div 
                            className="flex justify-between items-center mb-3 cursor-pointer group"
                            onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                        >
                            <h3 className="text-xs font-bold tracking-widest text-text-muted uppercase transition-colors group-hover:text-text-main">
                                {category}
                            </h3>
                            <div className="flex items-center gap-2 text-xs font-mono text-text-muted transition-colors group-hover:text-text-main">
                                {items.filter((i) => i.packed).length}/{items.length} 
                                <ChevronDown size={14} className={`transform transition-transform ${expandedCategory === category || expandedCategory === null ? 'rotate-180' : ''}`} />
                            </div>
                        </div>
                        {(expandedCategory === category || expandedCategory === null) && (
                            <div className="space-y-1">
                                {items.map((item) => (
                                    <ChecklistItem
                                        key={item.id}
                                        item={item}
                                        onToggle={onToggle}
                                        onEdit={onUpdate ? () => openEdit(item) : undefined}
                                        onDelete={onDelete ? () => setPendingDeleteId(item.id) : undefined}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="text-center text-sm text-text-muted py-8 font-mono opacity-50">
                        ✅ All items packed for this filter
                    </div>
                )}
            </div>

            <GearFormSheet
                isOpen={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSubmit={handleFormSubmit}
                initialItem={editingItem}
            />
        </Card>
    );
}
