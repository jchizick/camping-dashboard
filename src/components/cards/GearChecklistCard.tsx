'use client';

import React, { useState, useMemo } from 'react';
import type { GearItem } from '@/types';
import { calculateGearReadiness, groupBy } from '@/lib/helpers';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import ProgressBar from '@/components/ui/ProgressBar';
import ChecklistItem from '@/components/ui/ChecklistItem';
import GearFormSheet from '@/components/cards/GearFormSheet';

interface GearChecklistCardProps {
    gear: GearItem[];
    onToggle?: (id: string) => void;
    onAdd?: (item: Omit<GearItem, 'id' | 'trip_id'>) => Promise<void>;
    onUpdate?: (id: string, patch: Partial<Omit<GearItem, 'id' | 'trip_id'>>) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
}

type FilterMode = 'all' | 'needed' | 'critical';

export default function GearChecklistCard({ gear, onToggle, onAdd, onUpdate, onDelete }: GearChecklistCardProps) {
    const [filter, setFilter] = useState<FilterMode>('all');
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<GearItem | undefined>(undefined);
    // Inline confirm state — stores the id of the item pending deletion
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const readiness = useMemo(() => calculateGearReadiness(gear), [gear]);

    const filtered = useMemo(() => {
        if (filter === 'needed') return gear.filter((g) => !g.packed);
        if (filter === 'critical') return gear.filter((g) => g.priority === 'critical');
        return gear;
    }, [gear, filter]);

    const grouped = useMemo(() => groupBy(filtered, (g) => g.category), [filtered]);

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

    return (
        <GlassCard className="gear-card">
            <SectionHeader
                title="Gear Checklist"
                icon="🎒"
                subtitle={`${packedCount} / ${gear.length} packed`}
                onAdd={onAdd ? openAdd : undefined}
                addLabel="Add gear item"
            />

            <ProgressBar value={readiness} label="Readiness" variant={readiness >= 80 ? 'success' : readiness >= 50 ? 'default' : 'danger'} />

            <div className="gear-card__filters">
                {(['all', 'needed', 'critical'] as FilterMode[]).map((f) => (
                    <button
                        key={f}
                        className={`gear-card__filter-btn ${filter === f ? 'gear-card__filter-btn--active' : ''}`}
                        onClick={() => setFilter(f)}
                    >
                        {f === 'all' ? 'All' : f === 'needed' ? '⭕ Needed' : '🔴 Critical'}
                    </button>
                ))}
            </div>

            {/* Inline delete confirmation banner */}
            {pendingDeleteId && (() => {
                const item = gear.find(g => g.id === pendingDeleteId);
                return (
                    <div className="gear-card__delete-confirm">
                        <span>Remove <strong>{item?.name ?? 'this item'}</strong>?</span>
                        <div className="gear-card__delete-confirm-actions">
                            <button
                                className="gear-card__delete-confirm-btn gear-card__delete-confirm-btn--cancel"
                                onClick={() => setPendingDeleteId(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="gear-card__delete-confirm-btn gear-card__delete-confirm-btn--confirm"
                                onClick={confirmDelete}
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                );
            })()}

            <div className="gear-card__list">
                {Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="gear-card__category">
                        <button
                            className="gear-card__category-header"
                            onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                            aria-expanded={expandedCategory === category || expandedCategory === null}
                        >
                            <span className="gear-card__category-name">{category}</span>
                            <span className="gear-card__category-count">
                                {items.filter((i) => i.packed).length}/{items.length}
                            </span>
                            <span className="gear-card__category-chevron">
                                {expandedCategory === category ? '▲' : '▼'}
                            </span>
                        </button>
                        {(expandedCategory === category || expandedCategory === null) && (
                            <div className="gear-card__category-items">
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
                    <div className="gear-card__empty">✅ All items packed for this filter</div>
                )}
            </div>

            <GearFormSheet
                isOpen={sheetOpen}
                onClose={() => setSheetOpen(false)}
                onSubmit={handleFormSubmit}
                initialItem={editingItem}
            />
        </GlassCard>
    );
}
