'use client';

import React, { useState, useMemo } from 'react';
import type { GearItem } from '@/types';
import { calculateGearReadiness, groupBy } from '@/lib/helpers';
import GlassCard from '@/components/ui/GlassCard';
import SectionHeader from '@/components/ui/SectionHeader';
import ProgressBar from '@/components/ui/ProgressBar';
import ChecklistItem from '@/components/ui/ChecklistItem';

interface GearChecklistCardProps {
    gear: GearItem[];
    onToggle?: (id: string) => void;
}

type FilterMode = 'all' | 'needed' | 'critical';

export default function GearChecklistCard({ gear, onToggle }: GearChecklistCardProps) {
    const [filter, setFilter] = useState<FilterMode>('all');
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    const readiness = useMemo(() => calculateGearReadiness(gear), [gear]);

    const filtered = useMemo(() => {
        if (filter === 'needed') return gear.filter((g) => !g.packed);
        if (filter === 'critical') return gear.filter((g) => g.priority === 'critical');
        return gear;
    }, [gear, filter]);

    const grouped = useMemo(() => groupBy(filtered, (g) => g.category), [filtered]);

    const packedCount = gear.filter((g) => g.packed).length;

    return (
        <GlassCard className="gear-card">
            <SectionHeader title="Gear Checklist" icon="🎒" subtitle={`${packedCount} / ${gear.length} packed`} />

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
                                    <ChecklistItem key={item.id} item={item} onToggle={onToggle} />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="gear-card__empty">✅ All items packed for this filter</div>
                )}
            </div>
        </GlassCard>
    );
}
